import * as FS from 'expo-file-system/legacy';
import { compileProject } from '../engine/compiler';
import { buildCompiledGame } from '../engine/compiler/build-compiled-game';
import { PlayerHost } from '../runtime/player-host';
import { validateRuntimeSave } from '../runtime/validate-runtime-save';
import { Project, Fragment } from '../engine/types';
import { RuntimeSave } from '../runtime/chronica-runtime';

const mockGetInfoAsync = FS.getInfoAsync as jest.Mock;

beforeEach(() => {
  mockGetInfoAsync.mockImplementation(async (uri: string) => ({
    exists: !uri.includes('/does/not/exist/'),
  }));
});

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
    characters: [],
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
    expect(host.snapshot().assetWarnings.some(w => w.message.includes('forest.jpg'))).toBe(true);
  });

  test('choose returns structured failure when runtime throws (stale choice reference)', () => {
    const host = PlayerHost.create(compileOrThrow(makeProject(fragments)));
    host.startNew();
    const staleChoice = { uid: 'not-a-real-choice', label: 'Ghost', action: '', conditions: [] };
    const result = host.choose(staleChoice as any);
    expect(result).toEqual({
      ok: false,
      reason: 'runtime-invariant',
      message: expect.stringContaining('not-a-real-choice'),
    });
    expect(host.snapshot().runtimeWarnings).toHaveLength(1);
    expect(host.snapshot().runtimeWarnings[0].code).toBe('runtime-invariant');
  });

  test('activateHotspot returns structured failure when hotspot does not belong to active fragment', () => {
    const fragmentsWithHotspot: Fragment[] = [
      { ...fragments[0], hotspots: [{ uid: 'h1', label: 'Door', x: 0.1, y: 0.1, width: 0.2, height: 0.2, action: 'goto:forest', conditions: [] }] },
      fragments[1],
    ];
    const host = PlayerHost.create(compileOrThrow(makeProject(fragmentsWithHotspot)));
    host.startNew();
    const foreignHotspot = { uid: 'foreign-hotspot', label: 'Ghost door', action: '', conditions: [] };
    const result = host.activateHotspot(foreignHotspot as any);
    expect(result).toEqual({
      ok: false,
      reason: 'runtime-invariant',
      message: expect.stringContaining('foreign-hotspot'),
    });
  });

  test('advanceDialogue returns structured failure on out-of-bounds dialogue index', () => {
    const host = PlayerHost.create(compileOrThrow(makeProject(fragments)));
    host.startNew();
    host.setRuntimeState({ ...host.snapshot().state!, dialogueLineIndex: -1 });
    const result = host.advanceDialogue();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('runtime-invariant');
    }
  });

  test('snapshot omits missing background asset after verifyAssets and adds a warning', async () => {
    const project = makeProject([
      { ...fragments[0], backgroundImage: 'forest.jpg' },
      fragments[1],
    ], {
      assets: [{
        id: 'a-bg',
        name: 'forest.jpg',
        type: 'image',
        uri: 'file:///does/not/exist/forest.jpg',
        mimeType: 'image/jpeg',
        size: 0,
        importedAt: '',
      }],
    });
    const host = PlayerHost.create(buildCompiledGame(project));
    host.startNew();
    expect(host.snapshot().backgroundUri).toBe('file:///does/not/exist/forest.jpg');

    await host.verifyAssets();

    const snap = host.snapshot();
    expect(snap.backgroundUri).toBeUndefined();
    expect(snap.assetWarnings.some(w => w.field === 'backgroundImage' && w.reference.includes('forest.jpg'))).toBe(true);
  });

  test('verifyAssets keeps asset:// backgrounds without calling getInfoAsync', async () => {
    const project = makeProject([
      { ...fragments[0], backgroundImage: 'pasture.jpg' },
      fragments[1],
    ], {
      assets: [{
        id: 'a-bg',
        name: 'pasture.jpg',
        type: 'image',
        uri: 'asset:///pasture-morning.jpg',
        mimeType: 'image/jpeg',
        size: 0,
        importedAt: '',
      }],
    });
    const host = PlayerHost.create(buildCompiledGame(project));
    host.startNew();
    mockGetInfoAsync.mockClear();

    await host.verifyAssets();

    expect(mockGetInfoAsync).not.toHaveBeenCalled();
    expect(host.snapshot().backgroundUri).toBe('asset:///pasture-morning.jpg');
    expect(host.snapshot().assetWarnings).toHaveLength(0);
  });

  test('verifyAssets keeps content:// backgrounds without calling getInfoAsync', async () => {
    const project = makeProject([
      { ...fragments[0], backgroundImage: 'pasture.jpg' },
      fragments[1],
    ], {
      assets: [{
        id: 'a-bg',
        name: 'pasture.jpg',
        type: 'image',
        uri: 'content://media/external/images/1',
        mimeType: 'image/jpeg',
        size: 0,
        importedAt: '',
      }],
    });
    const host = PlayerHost.create(buildCompiledGame(project));
    host.startNew();
    mockGetInfoAsync.mockClear();

    await host.verifyAssets();

    expect(mockGetInfoAsync).not.toHaveBeenCalled();
    expect(host.snapshot().backgroundUri).toBe('content://media/external/images/1');
  });

  test('snapshot omits missing background audio after verifyAssets and adds a warning', async () => {
    const project = makeProject([
      { ...fragments[0], backgroundAudio: 'theme.mp3' },
      fragments[1],
    ], {
      assets: [{
        id: 'a-audio',
        name: 'theme.mp3',
        type: 'audio',
        uri: 'file:///does/not/exist/theme.mp3',
        mimeType: 'audio/mpeg',
        size: 0,
        importedAt: '',
      }],
    });
    const host = PlayerHost.create(buildCompiledGame(project));
    host.startNew();

    await host.verifyAssets();

    const snap = host.snapshot();
    expect(snap.audioUri).toBeUndefined();
    expect(snap.assetWarnings.some(w => w.field === 'backgroundAudio' && w.reference.includes('theme.mp3'))).toBe(true);
  });

  test('snapshot omits missing portrait after verifyAssets and adds a warning, dialogue continues', async () => {
    const project = makeProject([
      {
        ...fragments[0],
        dialogue: [{ uid: 'd1', speakerId: 'mara', text: 'Hello.' }],
      },
      fragments[1],
    ], {
      assets: [{
        id: 'a-portrait',
        name: 'mara.png',
        type: 'image',
        uri: 'file:///does/not/exist/mara.png',
        mimeType: 'image/png',
        size: 0,
        importedAt: '',
      }],
      characters: [{ uid: 'mara-uid', characterId: 'mara', displayName: 'Mara', defaultPortrait: 'mara.png' }],
    });
    const host = PlayerHost.create(buildCompiledGame(project));
    host.startNew();

    await host.verifyAssets();

    const snap = host.snapshot();
    expect(snap.dialogue?.portraitUri).toBeUndefined();
    expect(snap.assetWarnings.some(w => w.field === 'portrait')).toBe(true);
    expect(snap.started).toBe(true);
    expect(snap.dialogue?.text).toBeTruthy();
  });

  test('resume with deleted asset still resumes and reports the missing asset as a warning, not a crash', async () => {
    const project = makeProject([
      { ...fragments[0], backgroundImage: 'forest.jpg' },
      fragments[1],
    ], {
      assets: [{
        id: 'a-bg',
        name: 'forest.jpg',
        type: 'image',
        uri: 'file:///does/not/exist/forest.jpg',
        mimeType: 'image/jpeg',
        size: 0,
        importedAt: '',
      }],
    });
    const game = buildCompiledGame(project);
    const host = PlayerHost.create(game);
    host.startNew();
    const save = host.toSave('install-1')!;

    const host2 = PlayerHost.create(game);
    expect(host2.tryResume(save)).toEqual({ ok: true });
    await host2.verifyAssets();
    const snap = host2.snapshot();
    expect(snap.backgroundUri).toBeUndefined();
    expect(snap.assetWarnings.length).toBeGreaterThan(0);
  });

  test('PlayerHost never throws to its caller when runtime invariants are violated', () => {
    const host = PlayerHost.create(compileOrThrow(makeProject(fragments)));
    host.startNew();
    expect(() => host.choose({ uid: 'ghost', label: 'x', action: '', conditions: [] } as any)).not.toThrow();
    expect(() => host.activateHotspot({ uid: 'ghost', label: 'x', action: '', conditions: [] } as any)).not.toThrow();
  });

  test('tryResume never throws even with corrupt state payload', () => {
    const game = compileOrThrow(makeProject(fragments));
    const host = PlayerHost.create(game);
    const save = makeSave(game, { state: null as unknown as RuntimeSave['state'] });
    expect(() => host.tryResume(save)).not.toThrow();
    expect(host.tryResume(save)).toEqual({ ok: false, reason: 'corrupt-state' });
  });
});
