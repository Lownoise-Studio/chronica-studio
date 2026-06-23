import { resolveSceneBackgroundUri } from '../engine/asset-resolver';
import { isChronicaPackageBytes } from '../engine/chronica-package';
import { buildShowcasePackageBytes } from '../demo/showcase-package';
import { parseChronicaPackage } from '../storage/chronica-package-io';

jest.mock('@/storage/fileSystem', () => ({
  assetDir: (id: string) => `/data/mock/pse_assets/${id}/`,
  ensureDir: jest.fn().mockResolvedValue(undefined),
  writeBytes: jest.fn().mockResolvedValue(undefined),
  readBytes: jest.fn(),
  fileExists: jest.fn().mockResolvedValue(true),
  toLocalFileUri: (path: string) => (path.startsWith('file://') ? path : `file://${path}`),
  documentDirectory: '/data/mock/',
}));

describe('showcase demo package', () => {
  test('builds valid .chronica with backgrounds and imports for play', async () => {
    const bytes = buildShowcasePackageBytes('2026-06-22T12:00:00.000Z');
    expect(isChronicaPackageBytes(bytes)).toBe(true);

    const result = await parseChronicaPackage(bytes, 'demo-import');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.project.fragments.length).toBe(4);
    expect(result.project.assets.length).toBeGreaterThanOrEqual(3);
    expect(
      resolveSceneBackgroundUri(result.project.assets, result.project.fragments[0].backgroundImage),
    ).toContain('file://');
    expect(result.project.fragments[0].choices.length).toBe(3);
  });
});
