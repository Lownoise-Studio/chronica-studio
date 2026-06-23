import {
  MANIFEST_PATH,
  STORY_PATH,
  planChronicaPackage,
} from '@/engine/chronica-package';
import { encodeZip } from '@/storage/zip-store';
import { DEMO_PNG_BYTES, getShowcaseProject } from './showcase-project';

/** Build an in-memory .chronica package for the bundled showcase demo. */
export function buildShowcasePackageBytes(exportedAt = new Date().toISOString()): Uint8Array {
  const project = getShowcaseProject();
  const plan = planChronicaPackage(project, () => true, exportedAt);

  const entries = [
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
    entries.push({ path: file.packagePath, data: DEMO_PNG_BYTES });
  }

  return encodeZip(entries);
}
