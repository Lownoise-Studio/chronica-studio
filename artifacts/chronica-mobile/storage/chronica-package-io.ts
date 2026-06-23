import {
  ASSETS_PREFIX,
  BuildPackagePlan,
  MANIFEST_PATH,
  STORY_PATH,
  hydrateImportedPackageProject,
  packageAssetPath,
  planChronicaPackage,
  sanitizePackageFilename,
  validatePackageManifest,
  validatePackageStory,
} from '@/engine/chronica-package';
import { Project } from '@/engine/types';
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
  getZipTextFile,
  normalizeZipPath,
  zipEntryMap,
  type ZipEntry,
} from '@/storage/zip-store';

export type BuildChronicaPackageResult = {
  ok: true;
  bytes: Uint8Array;
  plan: BuildPackagePlan;
  warnings: string[];
} | {
  ok: false;
  error: string;
  plan?: BuildPackagePlan;
};

export type ImportChronicaPackageResult = {
  ok: true;
  project: Project;
  manifestTitle: string;
} | {
  ok: false;
  error: string;
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

  const warnings: string[] = plan.missingAssets.map(
    m => `Missing asset "${m.name}" (${m.reason}) referenced by: ${m.referencedBy.join(', ')}`,
  );

  const missingOnDisk = plan.assetFiles.filter(f => !uriExists.get(f.sourceUri));
  if (missingOnDisk.length) {
    return {
      ok: false,
      error: `Cannot export: asset file(s) missing on device: ${missingOnDisk.map(f => f.asset.name).join(', ')}`,
      plan,
    };
  }

  const entries: ZipEntry[] = [
    {
      path: MANIFEST_PATH,
      data: new TextEncoder().encode(JSON.stringify(plan.manifest, null, 2)),
    },
    {
      path: STORY_PATH,
      data: new TextEncoder().encode(JSON.stringify(plan.story, null, 2)),
    },
  ];

  for (const file of plan.assetFiles) {
    const data = await readBytes(file.sourceUri);
    entries.push({ path: file.packagePath, data });
  }

  return {
    ok: true,
    bytes: encodeZip(entries),
    plan,
    warnings,
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

  const localUriByPackagePath = await extractPackageAssets(map, targetProjectId);
  const project = hydrateImportedPackageProject(storyResult.story, localUriByPackagePath);
  return {
    ok: true,
    project: { ...project, id: targetProjectId, updatedAt: new Date().toISOString() },
    manifestTitle: manifestResult.manifest.title,
  };
}
