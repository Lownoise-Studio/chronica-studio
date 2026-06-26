import { compileProject } from '../engine/compiler';
import { buildCompiledGame } from '../engine/compiler/build-compiled-game';
import { PlayerHost } from '../runtime/player-host';
import { validateRuntimeSave } from '../runtime/validate-runtime-save';
import { Project, Fragment } from '../engine/types';
import { RuntimeSave } from '../runtime/chronica-runtime';

function makeProject(fragments: Fragment[], overrides: Partial<Project> = {}): Project {
  return {
    schemaVersion: 2,
    gameId: 'a0000001-0000-4000-8000-000000000099',
    id: 'install-1',
    title: 'Test',
    description: '',
    startLocation: 'intro',
    initialVariables: {},
    initialMemory: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    assets: [],
    fragments,
    ...overrides,
  };
}

function compileOrThrow(project: Project) {
  const result = compileProject(project);
  if (!result.ok) throw new Error('compile failed');
  return result.game;
}

const fragments: Fragment[] = [
  {
    uid: 'f1',
    title: 'Intro',
    locationId: 'intro',
    priority: 0,
    conditions: [],
    effects: [],
    text: 'Welcome.',
    choices: [{ uid: 'c1', label: 'Forest', action: 'goto:forest', conditions: [] }],
  },
  {
    uid: 'f2',
    title: 'Forest',
    locationId: 'forest',
    priority: 0,
    conditions: [],
    effects: [],
    text: 'Trees.',
    choices: [],
  },
];

function makeSave(game: ReturnType<typeof compileOrThrow>, overrides: Partial<RuntimeSave> = {}): RuntimeSave {
  return {
    projectId: 'install-1',
    gameId: game.gameId,
    contentHash: game.contentHash,
    state: { location: 'forest', instability: 0, reality_layer: 0, memory: {}, variables: {} },
    history: [
      { locationId: 'intro', title: 'Intro' },
      { locationId: 'forest', title: 'Forest' },
    ],
    savedAt: '2026-06-22T12:00:00.000Z',
    ...overrides,
  };
}

describe('validateRuntimeSave', () => {
  test('accepts matching gameId and contentHash', () => {
    const game = compileOrThrow(makeProject(fragments));
    expect(validateRuntimeSave(makeSave(game), game)).toEqual({ ok: true });
  });

  test('rejects wrong gameId', () => {
    const game = compileOrThrow(makeProject(fragments));
    const save = makeSave(game, { gameId: 'other-game-id' });
    expect(validateRuntimeSave(save, game)).toEqual({ ok: false, reason: 'wrong-game' });
  });

  test('rejects stale contentHash after project edit', () => {
    const game = compileOrThrow(makeProject(fragments));
    const save = makeSave(game);
    const edited = compileOrThrow(makeProject([
      { ...fragments[0], text: 'Edited intro text.' },
      fragments[1],
    ]));
    expect(validateRuntimeSave(save, edited)).toEqual({ ok: false, reason: 'stale-content' });
  });

  test('rejects corrupt state payload', () => {
    const game = compileOrThrow(makeProject(fragments));
    const save = makeSave(game, { state: null as unknown as RuntimeSave['state'] });
    expect(validateRuntimeSave(save, game)).toEqual({ ok: false, reason: 'corrupt-state' });
  });
});

describe('PlayerHost', () => {
  test('startNew and snapshot expose scene data', () => {
    const host = PlayerHost.create(compileOrThrow(makeProject(fragments)));
    expect(host.startNew()).toBe(true);
    const snap = host.snapshot();
    expect(snap.started).toBe(true);
    expect(snap.fragment?.locationId).toBe('intro');
    expect(snap.visibleChoices).toHaveLength(1);
    expect(snap.backgroundUri).toBeUndefined();
  });

  test('tryResume succeeds when save matches compiled game', () => {
    const game = compileOrThrow(makeProject(fragments));
    const host = PlayerHost.create(game);
    host.startNew();
    host.choose(host.snapshot().visibleChoices[0]);
    const save = host.toSave('install-1')!;

    const host2 = PlayerHost.create(game);
    expect(host2.tryResume(save)).toEqual({ ok: true });
    expect(host2.snapshot().fragment?.locationId).toBe('forest');
    expect(host2.snapshot().history).toHaveLength(2);
  });

  test('tryResume rejects stale save after project edit', () => {
    const original = compileOrThrow(makeProject(fragments));
    const host = PlayerHost.create(original);
    host.startNew();
    const save = host.toSave('install-1')!;

    const edited = compileOrThrow(makeProject([
      { ...fragments[0], text: 'Changed.' },
      fragments[1],
    ]));
    const host2 = PlayerHost.create(edited);
    expect(host2.tryResume(save)).toEqual({ ok: false, reason: 'stale-content' });
  });

  test('snapshot reports asset warnings for empty uri', () => {
    const project = makeProject([
      { ...fragments[0], backgroundImage: 'forest.jpg' },
      fragments[1],
    ], {
      assets: [{
        id: 'a-empty',
        name: 'forest.jpg',
        type: 'image',
        uri: '',
        mimeType: 'image/jpeg',
        size: 0,
        importedAt: '',
      }],
    });
    const host = PlayerHost.create(buildCompiledGame(project));
    host.startNew();
    expect(host.snapshot().assetWarnings.some(w => w.includes('forest.jpg'))).toBe(true);
  });
});
