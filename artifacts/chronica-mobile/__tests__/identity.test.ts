import { createId } from '../engine/identity';
import { migrateProject, PROJECT_SCHEMA_VERSION, resolveStartLocation } from '../engine/project-migration';
import { compileProject, buildCompiledGame } from '../engine/compiler';
import { validateProject } from '../engine/validator';
import { createPackageManifest, validatePackageManifest } from '../engine/chronica-package';
import { parseChronicaPackage } from '../storage/chronica-package-io';
import { buildChronicaPackageBytes } from '../storage/chronica-package-io';
import { ChronicaRuntime } from '../runtime/chronica-runtime';
import { Project, Fragment } from '../engine/types';
import { SHOWCASE_GAME_ID } from '../demo/showcase-project';

jest.mock('@/storage/fileSystem', () => ({
  assetDir: (id: string) => `/data/mock/pse_assets/${id}/`,
  ensureDir: jest.fn().mockResolvedValue(undefined),
  writeBytes: jest.fn(),
  readBytes: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
  fileExists: jest.fn().mockResolvedValue(true),
  toLocalFileUri: (path: string) => (path.startsWith('file://') ? path : `file://${path}`),
  documentDirectory: '/data/mock/',
}));

function makeProject(overrides: Partial<Project> = {}): Project {
  const gameId = overrides.gameId ?? 'e1000003-0000-4000-8000-000000000003';
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    gameId,
    id: 'install-original',
    title: 'Identity Test',
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
        text: 'Hi',
        choices: [{ uid: 'c1', label: 'End', action: 'goto:intro', conditions: [] }],
      } as Fragment,
    ],
    ...overrides,
  };
}

describe('createId', () => {
  test('returns unique uuid-like strings', () => {
    const a = createId();
    const b = createId();
    expect(a).not.toBe(b);
    expect(a).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});

describe('migrateProject', () => {
  test('assigns gameId to legacy projects', () => {
    const legacy = {
      schemaVersion: 1,
      id: 'old-install',
      title: 'Legacy',
      description: '',
      startLocation: 'intro',
      initialVariables: {},
      initialMemory: {},
      createdAt: '',
      updatedAt: '',
      fragments: [],
      assets: [],
      characters: [],
    } as Omit<Project, 'gameId'> as Project;

    const migrated = migrateProject(legacy);
    expect(migrated.gameId).toBeTruthy();
    expect(migrated.gameId).toMatch(/-/);
  });

  test('maps legacy startLocation title to canonical locationId', () => {
    const legacy = {
      schemaVersion: 1,
      id: 'old-install',
      title: 'Legacy Story',
      description: '',
      startLocation: 'The Crossroads',
      initialVariables: {},
      initialMemory: {},
      createdAt: '',
      updatedAt: '',
      fragments: [
        {
          uid: 'f1',
          title: 'The Crossroads',
          locationId: 'intro',
          priority: 0,
          conditions: [],
          effects: [],
          text: 'Start here',
          choices: [{ uid: 'c1', label: 'Go', action: 'goto:Forest Path', conditions: [] }],
        },
        {
          uid: 'f2',
          title: 'Forest Path',
          locationId: 'forest',
          priority: 0,
          conditions: [],
          effects: [],
          text: 'Trees',
          choices: [],
        },
      ],
      assets: [],
      characters: [],
    } as Omit<Project, 'gameId'> as Project;

    const migrated = migrateProject(legacy);
    expect(migrated.startLocation).toBe('intro');
    expect(migrated.fragments[0].choices[0].action).toBe('goto:forest');

    const validation = validateProject(migrated);
    expect(validation.filter(e => e.type === 'missing-start')).toHaveLength(0);
    expect(validation.filter(e => e.type === 'broken-link')).toHaveLength(0);

    const compiled = compileProject(migrated);
    expect(compiled.ok).toBe(true);
    if (compiled.ok) {
      expect(compiled.game.startLocation).toBe('intro');
    }
  });

  test('resolveStartLocation keeps canonical ids', () => {
    const fragments = [
      { uid: 'f1', title: 'Intro Scene', locationId: 'intro', priority: 0, conditions: [], effects: [], text: '', choices: [] },
    ] as Fragment[];
    expect(resolveStartLocation(fragments, 'intro')).toBe('intro');
    expect(resolveStartLocation(fragments, 'Intro Scene')).toBe('intro');
  });
});

describe('CompiledGame identity', () => {
  test('includes gameId and installId from project', () => {
    const project = makeProject({
      gameId: 'game-abc',
      id: 'install-xyz',
    });
    const compiled = buildCompiledGame(project);
    expect(compiled.gameId).toBe('game-abc');
    expect(compiled.installId).toBe('install-xyz');
    expect(compiled.projectId).toBe('install-xyz');
  });

  test('compileProject succeeds with identity fields', () => {
    const result = compileProject(makeProject());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.game.gameId).toBe('e1000003-0000-4000-8000-000000000003');
    expect(result.game.installId).toBe('install-original');
  });
});

describe('package gameId round-trip', () => {
  const stableGameId = 'f4000004-0000-4000-8000-000000000004';

  test('manifest includes gameId on export', async () => {
    const project = makeProject({ gameId: stableGameId });
    const manifest = createPackageManifest(project, 0, '2026-06-22T12:00:00.000Z');
    expect(manifest.gameId).toBe(stableGameId);
    expect(validatePackageManifest(manifest).ok).toBe(true);
  });

  test('export → import preserves gameId but mints new install id', async () => {
    const project = makeProject({
      gameId: stableGameId,
      id: 'export-install-1',
      assets: [
        {
          id: 'a1',
          name: 'bg.jpg',
          type: 'image',
          uri: 'file:///device/bg.jpg',
          mimeType: 'image/jpeg',
          size: 3,
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
          text: 'Hi',
          choices: [],
          backgroundImage: 'bg.jpg',
        },
      ],
    });

    const built = await buildChronicaPackageBytes(project);
    expect(built.ok).toBe(true);
    if (!built.ok) return;

    const newInstallId = 'import-install-99';
    const imported = await parseChronicaPackage(built.bytes, newInstallId);
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;

    expect(imported.project.gameId).toBe(stableGameId);
    expect(imported.project.id).toBe(newInstallId);
    expect(imported.project.id).not.toBe(project.id);

    const reExport = await buildChronicaPackageBytes(imported.project);
    expect(reExport.ok).toBe(true);
    if (!reExport.ok) return;
    expect(reExport.plan.manifest.gameId).toBe(stableGameId);
  });
});

describe('RuntimeSave identity', () => {
  test('includes gameId and contentHash', () => {
    const project = makeProject({ id: 'play-install' });
    const compiled = compileProject(project);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    const rt = new ChronicaRuntime(compiled.game);
    rt.start();
    const save = rt.toSave('play-install');
    expect(save).not.toBeNull();
    expect(save!.gameId).toBe(project.gameId);
    expect(save!.contentHash).toBe(compiled.game.contentHash);
    expect(save!.projectId).toBe('play-install');
  });
});

describe('showcase demo', () => {
  test('has stable showcase gameId', () => {
    expect(SHOWCASE_GAME_ID).toMatch(/-/);
  });
});

describe('JSON import compatibility', () => {
  test('legacy JSON without gameId gains gameId via migration', () => {
    const json = JSON.stringify({
      schemaVersion: 1,
      id: 'json-install',
      title: 'JSON Story',
      description: '',
      startLocation: 'intro',
      initialVariables: {},
      initialMemory: {},
      createdAt: '',
      updatedAt: '',
      fragments: [],
      assets: [],
    });
    const parsed = JSON.parse(json) as Project;
    const migrated = migrateProject(parsed);
    expect(migrated.gameId).toBeTruthy();
    expect(migrated.id).toBe('json-install');
  });
});
