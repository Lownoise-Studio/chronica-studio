import { Project } from '../engine/types';
import { resolveSceneBackgroundUri } from '../engine/asset-resolver';
import {
  CHRONICA_PACKAGE_FORMAT,
  MANIFEST_PATH,
  STORY_PATH,
  buildPackageStory,
  createPackageManifest,
  findMissingPackageAssets,
  hydrateImportedPackageProject,
  isChronicaPackageBytes,
  planChronicaPackage,
  validatePackageManifest,
  validatePackageStory,
} from '../engine/chronica-package';
import { decodeZip, encodeZip, getZipTextFile, zipEntryMap } from '../storage/zip-store';

const SCHEMA_VERSION = 1;

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: 'story-1',
    title: 'Forest Tale',
    description: 'Test',
    startLocation: 'intro',
    initialVariables: {},
    initialMemory: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    assets: [
      {
        id: 'a1',
        name: 'forest.jpg',
        type: 'image',
        uri: 'file:///device/pse_assets/story-1/forest.jpg',
        mimeType: 'image/jpeg',
        size: 2048,
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
    ...overrides,
  };
}

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('createPackageManifest', () => {
  test('includes required fields', () => {
    const manifest = createPackageManifest(makeProject(), 1, '2026-06-22T12:00:00.000Z');
    expect(manifest).toEqual({
      format: CHRONICA_PACKAGE_FORMAT,
      version: 1,
      app: 'Chronica Studio',
      exportedAt: '2026-06-22T12:00:00.000Z',
      title: 'Forest Tale',
      assetCount: 1,
      storySchemaVersion: 1,
    });
  });
});

describe('asset reference rewriting', () => {
  test('story.json uses portable assets/ paths, scene refs unchanged', () => {
    const project = makeProject();
    const plan = planChronicaPackage(project, () => true, '2026-01-01T00:00:00.000Z');
    expect(plan.story.assets[0].uri).toBe('assets/forest.jpg');
    expect(plan.story.fragments[0].backgroundImage).toBe('forest.jpg');
    expect(plan.assetFiles[0].packagePath).toBe('assets/forest.jpg');
  });

  test('hydrate restores local URIs for playtest', () => {
    const story = buildPackageStory(makeProject(), [
      {
        packagePath: 'assets/forest.jpg',
        asset: makeProject().assets[0],
        sourceUri: 'file:///device/pse_assets/story-1/forest.jpg',
      },
    ]);
    const hydrated = hydrateImportedPackageProject(story, {
      'assets/forest.jpg': 'file:///device/pse_assets/new-id/forest.jpg',
      'forest.jpg': 'file:///device/pse_assets/new-id/forest.jpg',
    });
    expect(resolveSceneBackgroundUri(hydrated.assets, hydrated.fragments[0].backgroundImage))
      .toBe('file:///device/pse_assets/new-id/forest.jpg');
  });

  test('hydrate adds missing asset records from extracted files', () => {
    const story = {
      ...makeProject(),
      assets: [],
    };
    const hydrated = hydrateImportedPackageProject(story, {
      'assets/forest.jpg': 'file:///device/pse_assets/new-id/forest.jpg',
    });
    expect(hydrated.assets).toHaveLength(1);
    expect(hydrated.assets[0].name).toBe('forest.jpg');
    expect(resolveSceneBackgroundUri(hydrated.assets, 'forest.jpg'))
      .toBe('file:///device/pse_assets/new-id/forest.jpg');
  });
});

describe('missing asset reporting', () => {
  test('reports missing file on disk', () => {
    const project = makeProject();
    const missing = findMissingPackageAssets(project, uri => !uri.includes('missing'));
    expect(missing).toHaveLength(0);

    const bad = findMissingPackageAssets(
      makeProject({
        assets: [{ ...makeProject().assets[0], uri: 'file:///missing/forest.jpg' }],
      }),
      () => false,
    );
    expect(bad[0].reason).toBe('missing-file');
    expect(bad[0].name).toBe('forest.jpg');
  });

  test('reports asset not in library', () => {
    const missing = findMissingPackageAssets(
      makeProject({ assets: [] }),
      () => true,
    );
    expect(missing[0].reason).toBe('not-in-library');
  });
});

describe('package validation', () => {
  test('validates manifest', () => {
    const manifest = createPackageManifest(makeProject(), 1, '2026-01-01T00:00:00.000Z');
    expect(validatePackageManifest(manifest).ok).toBe(true);
    expect(validatePackageManifest({ format: 'wrong' }).ok).toBe(false);
  });

  test('validates story', () => {
    const story = buildPackageStory(makeProject(), []);
    expect(validatePackageStory(story).ok).toBe(true);
    expect(validatePackageStory({ title: 'x' }).ok).toBe(false);
  });
});

describe('zip package round-trip', () => {
  test('encodes and decodes .chronica archive with manifest, story, and assets', () => {
    const project = makeProject();
    const plan = planChronicaPackage(project, () => true, '2026-06-22T12:00:00.000Z');
    const bytes = encodeZip([
      { path: MANIFEST_PATH, data: new TextEncoder().encode(JSON.stringify(plan.manifest)) },
      { path: STORY_PATH, data: new TextEncoder().encode(JSON.stringify(plan.story)) },
      { path: 'assets/forest.jpg', data: PNG_BYTES },
    ]);

    expect(isChronicaPackageBytes(bytes)).toBe(true);

    const map = zipEntryMap(decodeZip(bytes));
    const manifest = validatePackageManifest(JSON.parse(getZipTextFile(map, MANIFEST_PATH)!));
    const storyResult = validatePackageStory(JSON.parse(getZipTextFile(map, STORY_PATH)!));
    expect(manifest.ok).toBe(true);
    expect(storyResult.ok).toBe(true);
    if (!manifest.ok || !storyResult.ok) return;
    expect(map.get('assets/forest.jpg')).toEqual(PNG_BYTES);

    const hydrated = hydrateImportedPackageProject(storyResult.story, {
      'assets/forest.jpg': 'file:///imported/forest.jpg',
    });
    expect(hydrated.fragments[0].backgroundImage).toBe('forest.jpg');
    expect(resolveSceneBackgroundUri(hydrated.assets, 'forest.jpg'))
      .toBe('file:///imported/forest.jpg');
  });
});

describe('old JSON export compatibility', () => {
  test('plain JSON without zip signature is not a chronica package', () => {
    const json = JSON.stringify({ schemaVersion: 1, id: 'x', title: 't', fragments: [], assets: [] });
    const bytes = new TextEncoder().encode(json);
    expect(isChronicaPackageBytes(bytes)).toBe(false);
  });
});
