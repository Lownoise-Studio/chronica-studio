import { resolveSceneBackgroundUri } from '../engine/asset-resolver';
import {
  CHRONICA_PACKAGE_FORMAT,
  MANIFEST_PATH,
  STORY_PATH,
  planChronicaPackage,
} from '../engine/chronica-package';
import { parseChronicaPackage } from '../storage/chronica-package-io';
import { encodeZip } from '../storage/zip-store';

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

describe('parseChronicaPackage', () => {
  beforeEach(() => {
    mockWritten.clear();
  });

  test('writes zip assets to storage and hydrates playable file URIs', async () => {
    const project = {
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
          size: 8,
          importedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
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

    const plan = planChronicaPackage(project, () => true, '2026-06-22T12:00:00.000Z');
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const bytes = encodeZip([
      { path: MANIFEST_PATH, data: new TextEncoder().encode(JSON.stringify(plan.manifest)) },
      { path: STORY_PATH, data: new TextEncoder().encode(JSON.stringify(plan.story)) },
      { path: 'assets/forest.jpg', data: png },
    ]);

    const result = await parseChronicaPackage(bytes, 'imported-1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(mockWritten.size).toBe(1);
    expect([...mockWritten.values()][0]).toEqual(png);

    const bgUri = resolveSceneBackgroundUri(
      result.project.assets,
      result.project.fragments[0].backgroundImage,
    );
    expect(bgUri).toBe('file:///data/mock/pse_assets/imported-1/forest.jpg');
    expect(result.project.assets[0].uri).toBe('file:///data/mock/pse_assets/imported-1/forest.jpg');
  });

  test('imports assets when story.json asset list is empty but zip has files', async () => {
    const story = {
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
      assets: [],
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
});
