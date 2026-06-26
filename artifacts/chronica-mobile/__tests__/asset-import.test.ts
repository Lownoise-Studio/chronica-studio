import {
  assetNameFromZipPath,
  collectImportableAssetsFromZipMap,
  inferAssetType,
  inferAssetTypeFromFilename,
  isSkippableAssetZipEntry,
  MAX_ASSET_BATCH_BYTES,
  MAX_ASSET_FILE_BYTES,
  MAX_ASSET_IMPORT_COUNT,
  planProjectAssetsFromImport,
  sanitizeAssetFilename,
  uniqueAssetName,
  validateAssetImportPlan,
} from '../storage/asset-import';

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

describe('asset-import', () => {
  test('infers image and audio types from filenames', () => {
    expect(inferAssetTypeFromFilename('button.png')).toBe('image');
    expect(inferAssetTypeFromFilename('theme.mp3')).toBe('audio');
    expect(inferAssetTypeFromFilename('readme.txt')).toBeNull();
  });

  test('infers type from mime when extension is missing', () => {
    expect(inferAssetType('asset', 'image/png')).toBe('image');
    expect(inferAssetType('asset', 'audio/mpeg')).toBe('audio');
  });

  test('skips macOS metadata and hidden zip entries', () => {
    expect(isSkippableAssetZipEntry('__MACOSX/._button.png')).toBe(true);
    expect(isSkippableAssetZipEntry('sprites/button.png')).toBe(false);
    expect(isSkippableAssetZipEntry('folder/')).toBe(true);
  });

  test('builds unique asset names from nested zip paths', () => {
    expect(assetNameFromZipPath('UI/button_blue.png')).toBe('UI_button_blue.png');
    expect(sanitizeAssetFilename('weird name!.png')).toBe('weird name_.png');
  });

  test('deduplicates asset names against existing library entries', () => {
    const taken = new Set(['button.png']);
    expect(uniqueAssetName('button.png', taken)).toBe('button_2.png');
    expect(uniqueAssetName('hero.png', taken)).toBe('hero.png');
  });

  test('collects importable image and audio files from zip map', () => {
    const plan = collectImportableAssetsFromZipMap({
      'sprites/button.png': PNG_BYTES,
      'audio/theme.mp3': new Uint8Array([0x49, 0x44, 0x33]),
      'docs/license.txt': new Uint8Array([76, 73, 67]),
      '__MACOSX/._button.png': PNG_BYTES,
    });

    expect(plan.files).toHaveLength(2);
    expect(plan.files.map(f => f.name)).toEqual(['audio_theme.mp3', 'sprites_button.png']);
    expect(plan.skipped).toBe(2);
  });

  test('rejects batches with no supported files', () => {
    const result = validateAssetImportPlan({ files: [], skipped: 3 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('No supported image or audio files');
  });

  test('rejects oversized single files with a friendly message', () => {
    const result = validateAssetImportPlan({
      files: [{
        name: 'huge.png',
        type: 'image',
        bytes: new Uint8Array(MAX_ASSET_FILE_BYTES + 1),
        mimeType: 'image/png',
      }],
      skipped: 0,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('huge.png');
    expect(result.error).toContain('too large');
  });

  test('rejects batches over total byte limit', () => {
    const chunk = Math.floor(MAX_ASSET_BATCH_BYTES / 2) + 1;
    const result = validateAssetImportPlan({
      files: [
        { name: 'a.png', type: 'image', bytes: new Uint8Array(chunk), mimeType: 'image/png' },
        { name: 'b.png', type: 'image', bytes: new Uint8Array(chunk), mimeType: 'image/png' },
      ],
      skipped: 0,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('too large');
  });

  test('rejects batches over file count limit', () => {
    const files = Array.from({ length: MAX_ASSET_IMPORT_COUNT + 1 }, (_, i) => ({
      name: `file_${i}.png`,
      type: 'image' as const,
      bytes: PNG_BYTES,
      mimeType: 'image/png',
    }));
    const result = validateAssetImportPlan({ files, skipped: 0 });
    expect(result.ok).toBe(false);
  });

  test('plans project assets with unique names', () => {
    const { assets } = planProjectAssetsFromImport(
      [{
        name: 'button.png',
        type: 'image',
        bytes: PNG_BYTES,
        mimeType: 'image/png',
      }],
      ['button.png'],
      () => 'asset-id-1',
      '2026-06-22T00:00:00.000Z',
    );

    expect(assets).toHaveLength(1);
    expect(assets[0]?.name).toBe('button_2.png');
    expect(assets[0]?.type).toBe('image');
    expect(assets[0]?.size).toBe(PNG_BYTES.byteLength);
  });
});
