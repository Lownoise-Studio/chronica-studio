import { validateRuntimeSave } from '../runtime/validate-runtime-save';
import {
  loadRuntimeSave,
  loadRuntimeSaveResult,
  loadSaveFailureMessage,
  persistRuntimeSave,
} from '../runtime/save-store';
import type { RuntimeSave } from '../runtime/chronica-runtime';
import type { CompiledGame } from '../engine/compiler/types';

// Controllable AsyncStorage mock: a backing map plus an optional throw switch.
// Names are `mock`-prefixed so jest's factory-hoist allows the references.
const mockStore = new Map<string, string>();
const mockFlags = { throwOnGet: false, throwOnSet: false };

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => {
      if (mockFlags.throwOnGet) throw new Error('storage unavailable');
      return mockStore.has(key) ? mockStore.get(key)! : null;
    }),
    setItem: jest.fn(async (key: string, value: string) => {
      if (mockFlags.throwOnSet) throw new Error('storage unavailable');
      mockStore.set(key, value);
    }),
  },
}));

const KEY = (projectId: string) => `pse_save_${projectId}`;

function makeSave(overrides: Partial<RuntimeSave> = {}): RuntimeSave {
  return {
    projectId: 'p1',
    gameId: 'a0000001-0000-4000-8000-000000000099',
    contentHash: 'abc123',
    state: { location: 'intro', instability: 0, reality_layer: 0, memory: {}, variables: {} },
    history: [{ locationId: 'intro', title: 'Intro' }],
    savedAt: '2026-06-22T12:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  mockStore.clear();
  mockFlags.throwOnGet = false;
  mockFlags.throwOnSet = false;
});

describe('loadRuntimeSaveResult — distinguishes absent from unreadable', () => {
  test('no save exists -> no-save', async () => {
    const result = await loadRuntimeSaveResult('p1');
    expect(result).toEqual({ ok: false, reason: 'no-save' });
  });

  test('malformed JSON -> corrupt-save', async () => {
    mockStore.set(KEY('p1'), '{ not valid json');
    const result = await loadRuntimeSaveResult('p1');
    expect(result).toEqual({ ok: false, reason: 'corrupt-save' });
  });

  test('valid JSON but invalid shape -> invalid-save', async () => {
    mockStore.set(KEY('p1'), JSON.stringify({ hello: 'world' }));
    const result = await loadRuntimeSaveResult('p1');
    expect(result).toEqual({ ok: false, reason: 'invalid-save' });
  });

  test('valid JSON of wrong primitive type -> invalid-save', async () => {
    mockStore.set(KEY('p1'), JSON.stringify('just a string'));
    const result = await loadRuntimeSaveResult('p1');
    expect(result).toEqual({ ok: false, reason: 'invalid-save' });
  });

  test('storage read throws -> storage-error', async () => {
    mockFlags.throwOnGet = true;
    const result = await loadRuntimeSaveResult('p1');
    expect(result).toEqual({ ok: false, reason: 'storage-error' });
  });

  test('well-formed save -> ok with the save', async () => {
    const save = makeSave();
    await persistRuntimeSave(save);
    const result = await loadRuntimeSaveResult('p1');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.save).toEqual(save);
  });

  test('round-trips through persistRuntimeSave', async () => {
    await persistRuntimeSave(makeSave({ projectId: 'p2', contentHash: 'xyz' }));
    const result = await loadRuntimeSaveResult('p2');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.save.contentHash).toBe('xyz');
  });
});

describe('loadRuntimeSave — back-compat wrapper', () => {
  test('returns null for any failure', async () => {
    expect(await loadRuntimeSave('p1')).toBeNull(); // no-save
    mockStore.set(KEY('p1'), '{ broken');
    expect(await loadRuntimeSave('p1')).toBeNull(); // corrupt-save
  });

  test('returns the save when present and valid', async () => {
    const save = makeSave();
    await persistRuntimeSave(save);
    expect(await loadRuntimeSave('p1')).toEqual(save);
  });
});

describe('resume validation — mismatch reasons (resume layer, not load layer)', () => {
  const game = { gameId: 'a0000001-0000-4000-8000-000000000099', contentHash: 'abc123' } as CompiledGame;

  test('gameId mismatch -> wrong-game', () => {
    const save = makeSave({ gameId: 'b0000002-0000-4000-8000-000000000000' });
    expect(validateRuntimeSave(save, game)).toEqual({ ok: false, reason: 'wrong-game' });
  });

  test('contentHash mismatch -> stale-content', () => {
    const save = makeSave({ contentHash: 'different-hash' });
    expect(validateRuntimeSave(save, game)).toEqual({ ok: false, reason: 'stale-content' });
  });

  test('matching save -> ok', () => {
    expect(validateRuntimeSave(makeSave(), game)).toEqual({ ok: true });
  });
});

describe('loadSaveFailureMessage', () => {
  test('corrupt and invalid share the damaged-data message', () => {
    expect(loadSaveFailureMessage('corrupt-save')).toBe(loadSaveFailureMessage('invalid-save'));
    expect(loadSaveFailureMessage('corrupt-save')).toMatch(/damaged/i);
  });

  test('storage-error mentions the device', () => {
    expect(loadSaveFailureMessage('storage-error')).toMatch(/device/i);
  });
});
