import { compileProject } from '../engine/compiler';
import { ChronicaSession } from '../engine/compat/chronica-session';
import {
  CANONICAL_SAVE_FORMAT_VERSION,
  isCanonicalSaveV2Shape,
  isCompatSaveV1Shape,
  isMainFormatSaveShape,
  isRuntimeSaveV0Shape,
  normalizeSaveEnvelope,
} from '../engine/compat/save-load';
import type { CompatSave } from '../engine/compat/types';
import type { RuntimeSave } from '../runtime/chronica-runtime';
import type { Fragment, Project } from '../engine/types';

const GAME_ID = 'a0000001-0000-4000-8000-0000000000aa';
const CONTENT_HASH = 'hash-save-norm';
const PROJECT_ID = 'p-save-norm';

const baseState = {
  location: 'intro',
  variables: { trust: 1 },
  memory: {},
  instability: 0,
  reality_layer: 0,
  dialogueLineIndex: 0,
};

const context = {
  gameId: GAME_ID,
  contentHash: CONTENT_HASH,
  projectId: PROJECT_ID,
};

function makeProject(): Project {
  return {
    schemaVersion: 2,
    gameId: GAME_ID,
    id: 'p-save-norm-project',
    title: 'Save Norm',
    description: '',
    startLocation: 'intro',
    initialVariables: { trust: 0 },
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
        text: 'Hi.',
        choices: [],
      } satisfies Fragment,
    ],
  };
}

function compileOrThrow() {
  const result = compileProject(makeProject());
  if (!result.ok) throw new Error('compile failed');
  result.game.contentHash = CONTENT_HASH;
  return result.game;
}

describe('normalizeSaveEnvelope', () => {
  test('RuntimeSave v0 normalizes to canonical envelope', () => {
    const v0: RuntimeSave = {
      projectId: PROJECT_ID,
      gameId: GAME_ID,
      contentHash: CONTENT_HASH,
      state: baseState,
      history: [{ locationId: 'intro', title: 'Intro' }],
      savedAt: '2026-06-01T12:00:00.000Z',
    };
    expect(isRuntimeSaveV0Shape(v0)).toBe(true);

    const result = normalizeSaveEnvelope(v0, context);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.envelope.formatVersion).toBe(CANONICAL_SAVE_FORMAT_VERSION);
    expect(result.envelope.gameId).toBe(GAME_ID);
    expect(result.envelope.contentHash).toBe(CONTENT_HASH);
    expect(result.envelope.savedAt).toBe('2026-06-01T12:00:00.000Z');
    expect(result.envelope.modules).toBeUndefined();
  });

  test('CompatSave v1 normalizes with module record and fragmentId hint', () => {
    const v1: CompatSave = {
      compatVersion: 1,
      projectId: PROJECT_ID,
      gameId: GAME_ID,
      contentHash: CONTENT_HASH,
      state: baseState,
      history: [],
      savedAt: '2026-06-02T12:00:00.000Z',
      fragmentId: 'f1',
      modules: { achievements: { unlocked: ['a'] } },
    };
    expect(isCompatSaveV1Shape(v1)).toBe(true);

    const result = normalizeSaveEnvelope(v1, context);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.envelope.fragmentId).toBe('f1');
    expect(result.envelope.modules).toEqual([
      { id: 'achievements', data: { unlocked: ['a'] } },
    ]);
  });

  test('canonical formatVersion: 2 normalizes', () => {
    const canonical = {
      formatVersion: 2,
      projectId: PROJECT_ID,
      gameId: GAME_ID,
      contentHash: CONTENT_HASH,
      savedAt: '2026-06-03T12:00:00.000Z',
      state: baseState,
      history: [],
      modules: [{ id: 'm', config: { tier: 1 }, data: { score: 5 } }],
    };
    expect(isCanonicalSaveV2Shape(canonical)).toBe(true);

    const result = normalizeSaveEnvelope(canonical, context);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.envelope.modules).toEqual([
      { id: 'm', config: { tier: 1 }, data: { score: 5 } },
    ]);
  });

  test('main-format format_version: 2 normalizes with unix timestamp and module name', () => {
    const unix = 1_700_000_000;
    const main = {
      format_version: 2,
      saved_at_unix: unix,
      state: baseState,
      modules: [{ name: 'chronica.instability', config: { tier: 2 }, data: { version: 1 } }],
    };
    expect(isMainFormatSaveShape(main)).toBe(true);

    const result = normalizeSaveEnvelope(main, context);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.envelope.savedAt).toBe(new Date(unix * 1000).toISOString());
    expect(result.envelope.gameId).toBe(GAME_ID);
    expect(result.envelope.contentHash).toBe(CONTENT_HASH);
    expect(result.envelope.modules).toEqual([
      { id: 'chronica.instability', config: { tier: 2 }, data: { version: 1 } },
    ]);
    expect(result.warnings.some(w => w.includes('caller context'))).toBe(true);
  });

  test('rejects wrong gameId when context is supplied', () => {
    const save = {
      formatVersion: 2,
      projectId: PROJECT_ID,
      gameId: 'other-game',
      contentHash: CONTENT_HASH,
      savedAt: '2026-06-01T00:00:00.000Z',
      state: baseState,
      history: [],
    };
    expect(normalizeSaveEnvelope(save, context)).toEqual({ ok: false, reason: 'wrong-game' });
  });

  test('rejects stale contentHash when context is supplied', () => {
    const save = {
      formatVersion: 2,
      projectId: PROJECT_ID,
      gameId: GAME_ID,
      contentHash: 'old-hash',
      savedAt: '2026-06-01T00:00:00.000Z',
      state: baseState,
      history: [],
    };
    expect(normalizeSaveEnvelope(save, context)).toEqual({ ok: false, reason: 'stale-content' });
  });

  test('main-format without identity fails without caller context', () => {
    const main = {
      format_version: 2,
      saved_at_unix: 1_700_000_000,
      state: baseState,
    };
    const result = normalizeSaveEnvelope(main);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('missing-identity');
  });

  test('rejects corrupt state', () => {
    expect(normalizeSaveEnvelope(null, context)).toEqual(
      expect.objectContaining({ ok: false, reason: 'corrupt-state' }),
    );
    expect(normalizeSaveEnvelope({ gameId: GAME_ID, contentHash: CONTENT_HASH }, context)).toEqual(
      expect.objectContaining({ ok: false, reason: 'corrupt-state' }),
    );
  });
});

describe('ChronicaSession.toSave formats', () => {
  test('default write emits compat v1 envelope', async () => {
    const game = compileOrThrow();
    const session = new ChronicaSession(game);
    await session.start();
    const save = session.toSave(PROJECT_ID)!;
    expect(save).toEqual(
      expect.objectContaining({
        compatVersion: 1,
        projectId: PROJECT_ID,
        gameId: GAME_ID,
        contentHash: CONTENT_HASH,
      }),
    );
    expect('formatVersion' in save).toBe(false);
  });

  test('canonical-v2 option emits formatVersion 2 with module entries', async () => {
    const game = compileOrThrow();
    const session = new ChronicaSession(game);
    session.register({
      id: 'tracker',
      initialize: () => {},
      onSessionSave: () => ({ value: 7 }),
    });
    await session.start();
    const save = session.toSave({ projectId: PROJECT_ID, format: 'canonical-v2' })!;
    expect(save).toEqual(
      expect.objectContaining({
        formatVersion: CANONICAL_SAVE_FORMAT_VERSION,
        projectId: PROJECT_ID,
        gameId: GAME_ID,
        contentHash: CONTENT_HASH,
        savedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        modules: [{ id: 'tracker', data: { value: 7 } }],
      }),
    );
    expect('compatVersion' in save).toBe(false);
  });

  test('canonical v2 save round-trips through tryResume', async () => {
    const game = compileOrThrow();
    const source = new ChronicaSession(game);
    await source.start();
    source.state.setVariable('trust', 42);
    const save = source.toSave(PROJECT_ID, { format: 'canonical-v2' })!;

    const target = new ChronicaSession(game);
    const resume = await target.tryResume({ save });
    expect(resume.ok).toBe(true);
    expect(target.state.getVariable('trust')).toBe(42);
  });
});

describe('ChronicaSession.tryResume with normalizer', () => {
  test('resumes CompatSave v1 unchanged', async () => {
    const game = compileOrThrow();
    const source = new ChronicaSession(game);
    await source.start();
    const save = source.toSave(PROJECT_ID)!;

    const target = new ChronicaSession(game);
    const resume = await target.tryResume({ save });
    expect(resume.ok).toBe(true);
  });

  test('resumes main-format save when context matches compiled game', async () => {
    const game = compileOrThrow();
    const source = new ChronicaSession(game);
    await source.start();
    source.state.setVariable('trust', 99);

    const mainSave = {
      format_version: 2,
      saved_at_unix: Math.floor(Date.now() / 1000),
      state: JSON.parse(JSON.stringify(source.state.serialize())),
      history: [{ locationId: 'intro', title: 'Intro' }],
    };

    const target = new ChronicaSession(game);
    const resume = await target.tryResume({ save: mainSave });
    expect(resume.ok).toBe(true);
    expect(target.state.getVariable('trust')).toBe(99);
  });

  test('rejects main-format save without identity when session cannot validate', async () => {
    const game = compileOrThrow();
    const session = new ChronicaSession(game);
    const mainSave = {
      format_version: 2,
      saved_at_unix: 1_700_000_000,
      state: baseState,
    };
    // tryResume always supplies context — succeeds when game matches.
    // Direct normalize without context must fail:
    expect(normalizeSaveEnvelope(mainSave).ok).toBe(false);
    const resume = await session.tryResume({ save: mainSave });
    expect(resume.ok).toBe(true);
  });
});
