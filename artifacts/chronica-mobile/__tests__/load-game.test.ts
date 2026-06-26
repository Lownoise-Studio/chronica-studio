import { encodeZip } from '../storage/zip-store';
import { loadGameFromBytes } from '../engine/load-game';
import {
  CHRONICA_PACKAGE_FORMAT,
  MANIFEST_PATH,
  STORY_PATH,
} from '../engine/chronica-package';
import { Project } from '../engine/types';

const STORY: Project = {
  schemaVersion: 2,
    gameId: 'a0000001-0000-4000-8000-000000000099',
  id: 'imported-id',
  title: 'Loaded Tale',
  description: '',
  startLocation: 'intro',
  initialVariables: {},
  initialMemory: {},
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  assets: [],
    characters: [],
  fragments: [
    {
      uid: 'f1',
      title: 'Intro',
      locationId: 'intro',
      priority: 0,
      conditions: [],
      effects: [],
      text: 'Hello.',
      choices: [],
    },
  ],
};

function makePackageBytes(): Uint8Array {
  return encodeZip([
    {
      path: MANIFEST_PATH,
      data: new TextEncoder().encode(JSON.stringify({
        format: CHRONICA_PACKAGE_FORMAT,
        version: 1,
        app: 'Chronica Studio',
        exportedAt: '2026-06-22T12:00:00.000Z',
        title: 'Loaded Tale',
        gameId: 'a0000001-0000-4000-8000-000000000099',
        assetCount: 0,
        storySchemaVersion: 2,
      })),
    },
    {
      path: STORY_PATH,
      data: new TextEncoder().encode(JSON.stringify(STORY)),
    },
  ]);
}

describe('loadGameFromBytes', () => {
  test('imports .chronica package bytes', async () => {
    const importProjectPackage = jest.fn().mockResolvedValue({ ok: true, project: STORY });
    const importProject = jest.fn();

    const result = await loadGameFromBytes(makePackageBytes(), {
      importProject,
      importProjectPackage,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.kind).toBe('package');
    expect(result.project.title).toBe('Loaded Tale');
    expect(importProjectPackage).toHaveBeenCalledTimes(1);
    expect(importProject).not.toHaveBeenCalled();
  });

  test('imports legacy JSON backup', async () => {
    const json = JSON.stringify(STORY);
    const importProject = jest.fn().mockReturnValue({ ok: true, project: STORY });
    const importProjectPackage = jest.fn();

    const result = await loadGameFromBytes(new TextEncoder().encode(json), {
      importProject,
      importProjectPackage,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.kind).toBe('json');
    expect(importProject).toHaveBeenCalledWith(json);
    expect(importProjectPackage).not.toHaveBeenCalled();
  });

  test('returns error for invalid file', async () => {
    const result = await loadGameFromBytes(new TextEncoder().encode('not a game'), {
      importProject: () => ({ ok: false, error: 'Missing schemaVersion.' }),
      importProjectPackage: jest.fn(),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('schemaVersion');
  });
});
