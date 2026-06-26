import { compileProject } from '../engine/compiler';
import { computeProjectContentHash } from '../engine/compiler/build-compiled-game';
import { resolveSceneBackgroundUri } from '../engine/asset-resolver';
import {
  CHRONICA_PACKAGE_FORMAT,
  MANIFEST_PATH,
  STORY_PATH,
  buildAssetsManifest,
  planChronicaPackage,
} from '../engine/chronica-package';
import { buildChronicaPackageBytes, parseChronicaPackage } from '../storage/chronica-package-io';
import { encodeZip } from '../storage/zip-store';
import { readBytes, fileExists } from '../storage/fileSystem';
import type { Project } from '../engine/types';

const mockWritten = new Map<string, Uint8Array>();

jest.mock('@/storage/fileSystem', () => ({
  assetDir: (id: string) => `/data/mock/pse_assets/${id}/`,
  ensureDir: jest.fn().mockResolvedValue(undefined),
  writeBytes: jest.fn(async (uri: string, data: Uint8Array) => {
    mockWritten.set(uri, data);
  }),
  readBytes: jest.fn(),
  fileExists: jest.fn().mockResolvedValue(true),
  toLocalFileUri: (path: string) => (path.startsWith('file://') ? path : `file://${path}`),
  documentDirectory: '/data/mock/',
}));

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function makeProject(): Project {
  return {
    schemaVersion: 2,
    gameId: 'a0000001-0000-4000-8000-000000000099',
    id: 'story-1',
    title: 'Forest Tale',
    description: '',
    startLocation: 'intro',
    initialVariables: {},
    initialMemory: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    assets: [
      {
        id: 'a1',
        name: 'forest.jpg',
        type: 'image' as const,
        uri: 'file:///device/pse_assets/story-1/forest.jpg',
        mimeType: 'image/jpeg',
        size: PNG_BYTES.length,
        importedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    characters: [],
    fragments: [
      {
        uid: 'f1',
        title: 'Intro',
        locationId: 'intro',
        priority: 0,
        conditions: [],
        effects: [],
        text: 'Welcome.',
        choices: [],
        backgroundImage: 'forest.jpg',
      },
    ],
  };
}

function packageBytesWithManifest(
  plan: ReturnType<typeof planChronicaPackage>,
  assetData: Uint8Array,
  manifestOverrides: Record<string, unknown> = {},
  manifestAssetData: Uint8Array = assetData,
) {
  const assetEntry = { path: 'assets/forest.jpg', data: assetData };
  const manifest = {
    ...plan.manifest,
    assetsManifest: buildAssetsManifest([{ path: assetEntry.path, data: manifestAssetData }]),
    assetCount: 1,
    ...manifestOverrides,
  };
  return encodeZip([
    { path: MANIFEST_PATH, data: new TextEncoder().encode(JSON.stringify(manifest)) },
    { path: STORY_PATH, data: new TextEncoder().encode(JSON.stringify(plan.story)) },
    assetEntry,
  ]);
}

describe('parseChronicaPackage', () => {
  beforeEach(() => {
    mockWritten.clear();
  });

  test('writes zip assets to storage and hydrates playable file URIs', async () => {
    const project = makeProject();
    const plan = planChronicaPackage(project, () => true, '2026-06-22T12:00:00.000Z');
    const bytes = packageBytesWithManifest(plan, PNG_BYTES);

    const result = await parseChronicaPackage(bytes, 'imported-1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(mockWritten.size).toBe(1);
    expect([...mockWritten.values()][0]).toEqual(PNG_BYTES);

    const bgUri = resolveSceneBackgroundUri(
      result.project.assets,
      result.project.fragments[0].backgroundImage,
    );
    expect(bgUri).toBe('file:///data/mock/pse_assets/imported-1/forest.jpg');
    expect(compileProject(result.project).ok).toBe(true);
  });

  test('imports legacy packages without assetsManifest', async () => {
    const story = makeProject();
    story.assets = [];
    const bytes = encodeZip([
      {
        path: MANIFEST_PATH,
        data: new TextEncoder().encode(JSON.stringify({
          format: CHRONICA_PACKAGE_FORMAT,
          version: 1,
          app: 'Chronica Studio',
          exportedAt: '2026-06-22T12:00:00.000Z',
          title: 'Forest Tale',
          gameId: 'a0000001-0000-4000-8000-000000000099',
          assetCount: 1,
          storySchemaVersion: 2,
        })),
      },
      { path: STORY_PATH, data: new TextEncoder().encode(JSON.stringify(story)) },
      { path: 'assets/forest.jpg', data: new Uint8Array([1, 2, 3, 4]) },
    ]);

    const result = await parseChronicaPackage(bytes, 'imported-2');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(resolveSceneBackgroundUri(result.project.assets, 'forest.jpg'))
      .toBe('file:///data/mock/pse_assets/imported-2/forest.jpg');
  });

  test('rejects asset checksum mismatch when assetsManifest present', async () => {
    const project = makeProject();
    const plan = planChronicaPackage(project, () => true, '2026-06-22T12:00:00.000Z');
    const tampered = new Uint8Array(PNG_BYTES);
    tampered[0] = 0x00;
    const bytes = packageBytesWithManifest(plan, tampered, {}, PNG_BYTES);

    const result = await parseChronicaPackage(bytes, 'imported-3');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('checksum mismatch');
  });

  test('rejects storyContentHash mismatch', async () => {
    const project = makeProject();
    const plan = planChronicaPackage(project, () => true, '2026-06-22T12:00:00.000Z');
    const bytes = packageBytesWithManifest(plan, PNG_BYTES, { storyContentHash: 'bad-hash' });

    const result = await parseChronicaPackage(bytes, 'imported-4');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('story content');
  });

  test('rejects packages that fail compileProject', async () => {
    const project = makeProject();
    project.fragments[0].choices = [{
      uid: 'c1',
      label: 'Broken',
      action: 'goto:missing',
      conditions: [],
    }];
    const plan = planChronicaPackage(project, () => true, '2026-06-22T12:00:00.000Z');
    const bytes = packageBytesWithManifest(plan, PNG_BYTES, {
      storyContentHash: computeProjectContentHash(plan.story),
    });

    const result = await parseChronicaPackage(bytes, 'imported-5');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('does not compile');
    expect(result.diagnostics?.length).toBeGreaterThan(0);
  });
});

describe('buildChronicaPackageBytes', () => {
  beforeEach(() => {
    (readBytes as jest.Mock).mockResolvedValue(PNG_BYTES);
    (fileExists as jest.Mock).mockResolvedValue(true);
  });

  test('embeds assetsManifest and round-trips through import', async () => {
    const built = await buildChronicaPackageBytes(makeProject());
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.plan.manifest.assetsManifest).toHaveLength(1);
    expect(built.plan.manifest.assetsManifest![0].path).toBe('assets/forest.jpg');

    const imported = await parseChronicaPackage(built.bytes, 'round-trip-1');
    expect(imported.ok).toBe(true);
  });

  test('blocks export when referenced asset is missing from library', async () => {
    const project = makeProject();
    project.fragments[0].backgroundImage = 'ghost.jpg';
    const built = await buildChronicaPackageBytes(project);
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.diagnostics?.length).toBe(1);
    expect(built.diagnostics![0].type).toBe('not-in-library');
  });

  test('blocks export when asset file missing on disk', async () => {
    (fileExists as jest.Mock).mockResolvedValue(false);
    const built = await buildChronicaPackageBytes(makeProject());
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.error).toContain('referenced asset(s) missing');
    expect(built.diagnostics?.[0].type).toBe('missing-file');
  });
});
