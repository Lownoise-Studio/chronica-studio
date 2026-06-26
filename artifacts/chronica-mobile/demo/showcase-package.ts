import {
  MANIFEST_PATH,
  STORY_PATH,
  buildAssetsManifest,
  planChronicaPackage,
} from '@/engine/chronica-package';
import { encodeZip } from '@/storage/zip-store';
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
