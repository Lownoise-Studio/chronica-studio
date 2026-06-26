import {
  ASSETS_PREFIX,
  BuildPackagePlan,
  MANIFEST_PATH,
  STORY_PATH,
  buildAssetsManifest,
  findUnresolvedImportAssets,
  hydrateImportedPackageProject,
  missingAssetsToDiagnostics,
  packageAssetPath,
  planChronicaPackage,
  sanitizePackageFilename,
  validatePackageManifest,
  validatePackageStory,
  verifyPackageAssetsManifest,
  type PackageExportDiagnostic,
} from '@/engine/chronica-package';
import { compileProject } from '@/engine/compiler';
import { computeProjectContentHash } from '@/engine/compiler/build-compiled-game';
import { migrateProject } from '@/engine/project-migration';
import { Project, ValidationError } from '@/engine/types';
import {
  assetDir,
  ensureDir,
  fileExists,
  readBytes,
  toLocalFileUri,
  writeBytes,
} from '@/storage/fileSystem';
import {
  decodeZip,
  encodeZip,
  getZipBinaryFile,
  getZipTextFile,
  normalizeZipPath,
  zipEntryMap,
  type ZipEntry,
} from '@/storage/zip-store';

export type BuildChronicaPackageResult = {
  ok: true;
  bytes: Uint8Array;
  plan: BuildPackagePlan;
} | {
  ok: false;
  error: string;
  plan?: BuildPackagePlan;
  diagnostics?: PackageExportDiagnostic[];
};

export type ImportChronicaPackageResult = {
  ok: true;
  project: Project;
  manifestTitle: string;
} | {
  ok: false;
  error: string;
  diagnostics?: ValidationError[];
};

export async function extractPackageAssets(
  map: Map<string, Uint8Array>,
  projectId: string,
): Promise<Record<string, string>> {
  const dir = assetDir(projectId);
  await ensureDir(dir);

  const localUriByPackagePath: Record<string, string> = {};
  const written = new Set<string>();

  for (const [entryPath, zipData] of map) {
    const normalized = normalizeZipPath(entryPath);
    if (!normalized.startsWith(ASSETS_PREFIX)) continue;

    const filename = sanitizePackageFilename(normalized.slice(ASSETS_PREFIX.length));
    if (!filename) continue;

    const destUri = toLocalFileUri(`${dir}${filename}`);
    if (!written.has(destUri)) {
      await writeBytes(destUri, zipData);
      written.add(destUri);
    }

    const keys = new Set([
      normalized,
      `${ASSETS_PREFIX}${filename}`,
      packageAssetPath(filename),
      filename,
    ]);
    for (const key of keys) {
      localUriByPackagePath[key] = destUri;
      localUriByPackagePath[key.toLowerCase()] = destUri;
    }
  }

  return localUriByPackagePath;
}

export async function buildChronicaPackageBytes(
  project: Project,
  exportedAt = new Date().toISOString(),
): Promise<BuildChronicaPackageResult> {
  const uriExists = new Map<string, boolean>();
  for (const asset of project.assets) {
    if (asset.uri?.trim()) {
      uriExists.set(asset.uri, await fileExists(asset.uri));
    }
  }

  const plan = planChronicaPackage(
    project,
    uri => uriExists.get(uri) ?? false,
    exportedAt,
  );

  if (plan.missingAssets.length > 0) {
    const diagnostics = missingAssetsToDiagnostics(plan.missingAssets);
    return {
      ok: false,
      error: `Cannot export: ${plan.missingAssets.length} referenced asset(s) missing.`,
      plan,
      diagnostics,
    };
  }

  const missingOnDisk = plan.assetFiles.filter(f => !uriExists.get(f.sourceUri));
  if (missingOnDisk.length) {
    const diagnostics: PackageExportDiagnostic[] = missingOnDisk.map(f => ({
      type: 'missing-file',
      assetName: f.asset.name,
      message: `Asset file missing on device: "${f.asset.name}"`,
      referencedBy: [],
    }));
    return {
      ok: false,
      error: `Cannot export: asset file(s) missing on device: ${missingOnDisk.map(f => f.asset.name).join(', ')}`,
      plan,
      diagnostics,
    };
  }

  const assetEntries: ZipEntry[] = [];
  for (const file of plan.assetFiles) {
    const data = await readBytes(file.sourceUri);
    assetEntries.push({ path: file.packagePath, data });
  }

  const assetsManifest = buildAssetsManifest(assetEntries);
  const manifest = {
    ...plan.manifest,
    assetsManifest,
    assetCount: assetsManifest.length,
  };

  const entries: ZipEntry[] = [
    {
      path: MANIFEST_PATH,
      data: new TextEncoder().encode(JSON.stringify(manifest, null, 2)),
    },
    {
      path: STORY_PATH,
      data: new TextEncoder().encode(JSON.stringify(plan.story, null, 2)),
    },
    ...assetEntries,
  ];

  return {
    ok: true,
    bytes: encodeZip(entries),
    plan: { ...plan, manifest },
  };
}

export async function parseChronicaPackage(
  bytes: Uint8Array,
  targetProjectId: string,
): Promise<ImportChronicaPackageResult> {
  let entries;
  try {
    entries = decodeZip(bytes);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Invalid package archive.';
    return { ok: false, error: msg };
  }

  const map = zipEntryMap(entries);
  const manifestJson = getZipTextFile(map, MANIFEST_PATH);
  const storyJson = getZipTextFile(map, STORY_PATH);

  if (!manifestJson) return { ok: false, error: 'Package missing manifest.json.' };
  if (!storyJson) return { ok: false, error: 'Package missing story.json.' };

  let manifestData: unknown;
  let storyData: unknown;
  try {
    manifestData = JSON.parse(manifestJson);
    storyData = JSON.parse(storyJson);
  } catch {
    return { ok: false, error: 'Package contains invalid JSON.' };
  }

  const manifestResult = validatePackageManifest(manifestData);
  if (!manifestResult.ok) return { ok: false, error: manifestResult.error };

  const storyResult = validatePackageStory(storyData);
  if (!storyResult.ok) return { ok: false, error: storyResult.error };

  const manifest = manifestResult.manifest;
  if (storyResult.story.gameId !== manifest.gameId) {
    return { ok: false, error: 'Package story gameId does not match manifest.' };
  }

  const storyHash = computeProjectContentHash(storyResult.story);
  if (storyHash !== manifest.storyContentHash) {
    return { ok: false, error: 'Package story content does not match manifest hash.' };
  }

  const assetCheck = verifyPackageAssetsManifest(
    path => getZipBinaryFile(map, path),
    manifest.assetsManifest,
  );
  if (!assetCheck.ok) {
    return { ok: false, error: assetCheck.error };
  }

  const localUriByPackagePath = await extractPackageAssets(map, targetProjectId);
  const hydrated = hydrateImportedPackageProject(storyResult.story, localUriByPackagePath);
  const unresolvedAssets = findUnresolvedImportAssets(hydrated);
  if (unresolvedAssets.length > 0) {
    return {
      ok: false,
      error: `Package is missing referenced asset(s): ${unresolvedAssets.join(', ')}`,
    };
  }

  const project = migrateProject({
    ...hydrated,
    id: targetProjectId,
    updatedAt: new Date().toISOString(),
  });

  const compiled = compileProject(project);
  if (!compiled.ok) {
    return {
      ok: false,
      error: 'Imported package story does not compile.',
      diagnostics: compiled.diagnostics,
    };
  }

  return {
    ok: true,
    project,
    manifestTitle: manifest.title,
  };
}
