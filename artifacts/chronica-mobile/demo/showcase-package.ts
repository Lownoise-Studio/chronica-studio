import {
  MANIFEST_PATH,
  STORY_PATH,
  buildAssetsManifest,
  planChronicaPackage,
  validatePackageManifest,
  validatePackageStory,
  verifyPackageAssetsManifest,
} from '@/engine/chronica-package';
import { decodeZip, encodeZip, getZipTextFile, zipEntryMap } from '@/storage/zip-store';
import { DEMO_PNG_BYTES, getShowcaseProject } from './showcase-project';

/** Build an in-memory .chronica package for the bundled showcase demo. */
export function buildShowcasePackageBytes(exportedAt = new Date().toISOString()): Uint8Array {
  const project = getShowcaseProject();
  const plan = planChronicaPackage(project, () => true, exportedAt);

  const assetEntries = plan.assetFiles.map(file => ({
    path: file.packagePath,
    data: DEMO_PNG_BYTES,
  }));

  const manifest = {
    ...plan.manifest,
    assetsManifest: buildAssetsManifest(assetEntries),
    assetCount: assetEntries.length,
  };

  const entries = [
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

  return encodeZip(entries);
}

/** Validate manifest/story/asset integrity for the bundled showcase package. */
export function validateShowcasePackageBytes(bytes: Uint8Array) {
  const map = zipEntryMap(decodeZip(bytes));
  const manifest = validatePackageManifest(JSON.parse(getZipTextFile(map, MANIFEST_PATH)!));
  const story = validatePackageStory(JSON.parse(getZipTextFile(map, STORY_PATH)!));
  const assets = manifest.ok
    ? verifyPackageAssetsManifest(path => map.get(path), manifest.manifest.assetsManifest ?? [])
    : { ok: false as const, code: 'invalid-manifest' as const, message: 'Invalid manifest.' };

  return { manifest, story, assets, map };
}
