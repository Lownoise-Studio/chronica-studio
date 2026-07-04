import {
  ASSETS_PREFIX,
  BuildPackagePlan,
  MANIFEST_PATH,
  PACKAGE_LIMITS,
  STORY_PATH,
  buildAssetsManifest,
  findUnlistedPackageAssets,
  findUnresolvedImportAssets,
  hydrateImportedPackageProject,
  missingAssetsToDiagnostics,
  packageAssetPath,
  planChronicaPackage,
  sanitizePackageFilename,
  validatePackageEntryStructure,
  validatePackageManifest,
  validatePackageStory,
  verifyPackageAssetsManifest,
  type PackageExportDiagnostic,
  type PackageImportReason,
} from '@/engine/chronica-package';
import { packagePathForAsset } from '@/engine/model-assets';
import { compileProject } from '@/engine/compiler';
import { computeProjectContentHash } from '@/engine/compiler/build-compiled-game';
import { migrateProject } from '@/engine/project-migration';
import {
  checkProjectPlayCompatibility,
} from '@/engine/package-compatibility';
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
  /** Present when strict compile validation fails before export. */
  validationErrors?: ValidationError[];
};

export type ImportChronicaPackageResult = {
  ok: true;
  project: Project;
  manifestTitle: string;
} | {
  ok: false;
  /** Typed, user-facing failure reason — never a raw exception. */
  reason: PackageImportReason;
  error: string;
  diagnostics?: ValidationError[];
};

function importFailure(
  reason: PackageImportReason,
  error: string,
  diagnostics?: ValidationError[],
): ImportChronicaPackageResult {
  return { ok: false, reason, error, diagnostics };
}

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

    const relativePath = normalized.slice(ASSETS_PREFIX.length);
    const filename = sanitizePackageFilename(relativePath);
    if (!filename) continue;

    const destUri = toLocalFileUri(`${dir}${relativePath.includes('/') ? relativePath.replace(/\//g, '_') : filename}`);
    if (!written.has(destUri)) {
      await writeBytes(destUri, zipData);
      written.add(destUri);
    }

    const keys = new Set([
      normalized,
      `${ASSETS_PREFIX}${relativePath}`,
      packageAssetPath(filename),
      packagePathForAsset({ name: filename, type: relativePath.startsWith('models/') ? 'model' : 'image' }),
      filename,
      relativePath,
    ]);
    for (const key of keys) {
      localUriByPackagePath[key] = destUri;
      localUriByPackagePath[key.toLowerCase()] = destUri;
    }
  }

  return localUriByPackagePath;
}

export type BuildChronicaPackageOptions = {
  /** When true, run strict compile validation before export. Default preserves existing export checks only. */
  strictValidation?: boolean;
};

export async function buildChronicaPackageBytes(
  project: Project,
  exportedAt = new Date().toISOString(),
  options?: BuildChronicaPackageOptions,
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

  if (options?.strictValidation) {
    const compiled = compileProject(project, { strictValidation: true });
    if (!compiled.ok) {
      return {
        ok: false,
        error: 'Cannot export: project fails strict validation.',
        plan,
        validationErrors: compiled.diagnostics,
      };
    }
  }

  // Guard: two library assets whose names collapse to the same package path
  // would produce a manifest that fails its own re-import. Fail loudly instead.
  const seenPaths = new Set<string>();
  for (const file of plan.assetFiles) {
    const key = file.packagePath.toLowerCase();
    if (seenPaths.has(key)) {
      return {
        ok: false,
        error: `Cannot export: two assets map to the same package path "${file.packagePath}". Rename one before exporting.`,
        plan,
      };
    }
    seenPaths.add(key);
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
  // Cheapest guard first: reject an oversized archive before allocating to decode it.
  if (bytes.length > PACKAGE_LIMITS.maxPackageBytes) {
    return importFailure('oversized-package', 'Package exceeds the maximum allowed size.');
  }

  let entries;
  try {
    entries = decodeZip(bytes);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Invalid package archive.';
    return importFailure('invalid-zip', msg);
  }

  // Structural validation: single manifest/story, no duplicates, no traversal,
  // no unexpected entries, per-entry/aggregate size ceilings.
  const structure = validatePackageEntryStructure(entries);
  if (!structure.ok) return importFailure(structure.reason, structure.error);

  const map = zipEntryMap(entries);
  const manifestJson = getZipTextFile(map, MANIFEST_PATH);
  const storyJson = getZipTextFile(map, STORY_PATH);

  if (!manifestJson) return importFailure('missing-manifest', 'Package missing manifest.json.');
  if (!storyJson) return importFailure('missing-story', 'Package missing story.json.');

  let manifestData: unknown;
  let storyData: unknown;
  try {
    manifestData = JSON.parse(manifestJson);
    storyData = JSON.parse(storyJson);
  } catch {
    return importFailure('invalid-json', 'Package contains invalid JSON.');
  }

  const manifestResult = validatePackageManifest(manifestData);
  if (!manifestResult.ok) return importFailure(manifestResult.reason, manifestResult.error);

  const storyResult = validatePackageStory(storyData);
  if (!storyResult.ok) return importFailure(storyResult.reason, storyResult.error);

  const manifest = manifestResult.manifest;
  if (storyResult.story.gameId !== manifest.gameId) {
    return importFailure('gameid-mismatch', 'Package story gameId does not match manifest.');
  }

  const storyHash = computeProjectContentHash(storyResult.story);
  if (storyHash !== manifest.storyContentHash) {
    return importFailure('hash-mismatch', 'Package story content does not match manifest hash.');
  }

  // Every embedded asset must be declared in the manifest (manifest is the
  // source of truth — unlisted files are rejected, not silently imported).
  const unlisted = findUnlistedPackageAssets(entries, manifest.assetsManifest);
  if (unlisted.length > 0) {
    return importFailure('unexpected-entry', `Package contains asset(s) not listed in the manifest: ${unlisted.join(', ')}.`);
  }

  const assetCheck = verifyPackageAssetsManifest(
    path => getZipBinaryFile(map, path),
    manifest.assetsManifest,
  );
  if (!assetCheck.ok) {
    return importFailure(assetCheck.code, assetCheck.error);
  }

  const localUriByPackagePath = await extractPackageAssets(map, targetProjectId);
  const hydrated = hydrateImportedPackageProject(storyResult.story, localUriByPackagePath);
  const unresolvedAssets = findUnresolvedImportAssets(hydrated);
  if (unresolvedAssets.length > 0) {
    return importFailure('missing-asset', `Package is missing referenced asset(s): ${unresolvedAssets.join(', ')}`);
  }

  const project = migrateProject({
    ...hydrated,
    id: targetProjectId,
    updatedAt: new Date().toISOString(),
  });

  const featureCompatibility = checkProjectPlayCompatibility(project);
  if (!featureCompatibility.compatible) {
    return importFailure(
      'incompatible-features',
      featureCompatibility.blockers.join(' '),
      featureCompatibility.blockers.map(message => ({
        fragmentUid: '',
        fragmentTitle: 'Package compatibility',
        type: 'type-mismatch' as const,
        message,
      })),
    );
  }

  const compiled = compileProject(project);
  if (!compiled.ok) {
    return importFailure('compile-failed', 'Imported package story does not compile.', compiled.diagnostics);
  }

  return {
    ok: true,
    project,
    manifestTitle: manifest.title,
  };
}
