import {
  BuildPackagePlan,
  MANIFEST_PATH,
  STORY_PATH,
  hydrateImportedPackageProject,
  planChronicaPackage,
  validatePackageManifest,
  validatePackageStory,
} from '@/engine/chronica-package';
import { Project } from '@/engine/types';
import {
  assetDir,
  ensureDir,
  fileExists,
  readBytes,
  writeBytes,
} from '@/storage/fileSystem';
import { decodeZip, encodeZip, getZipTextFile, zipEntryMap, type ZipEntry } from '@/storage/zip-store';

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

  const dir = assetDir(targetProjectId);
  await ensureDir(dir);

  const localUriByPackagePath: Record<string, string> = {};
  for (const asset of storyResult.story.assets) {
    const pkgPath = asset.uri?.startsWith('assets/')
      ? asset.uri
      : `assets/${asset.name}`;
    const zipData = map.get(pkgPath);
    if (!zipData) continue;
    const destUri = `${dir}${asset.name.replace(/[/\\]/g, '_')}`;
    await writeBytes(destUri, zipData);
    localUriByPackagePath[pkgPath] = destUri;
  }

  const project = hydrateImportedPackageProject(storyResult.story, localUriByPackagePath);
  return {
    ok: true,
    project: { ...project, id: targetProjectId, updatedAt: new Date().toISOString() },
    manifestTitle: manifestResult.manifest.title,
  };
}
