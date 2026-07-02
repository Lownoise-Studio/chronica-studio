import { compileProject } from '../engine/compiler';
import { ChronicaSession } from '../engine/compat/chronica-session';
import type { ChronicaModule } from '../engine/compat/module';
import type { ModuleErrorEvent } from '../engine/compat/types';
import type { Fragment, Project } from '../engine/types';

function makeProject(fragments: Fragment[], overrides: Partial<Project> = {}): Project {
  return {
    schemaVersion: 2,
    gameId: 'a0000001-0000-4000-8000-0000000000cc',
    id: 'p-modules',
    title: 'Modules Test',
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

const fragments: Fragment[] = [
  {
    uid: 'f1',
    title: 'Intro',
    locationId: 'intro',
    priority: 0,
    conditions: [],
    effects: [],
    text: 'Welcome.',
    choices: [
      { uid: 'c1', label: 'Forest', action: 'goto:forest', conditions: [] },
    ],
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

function compileOrThrow(project: Project) {
  const result = compileProject(project);
  if (!result.ok) throw new Error('compile failed');
  return result.game;
}

interface AchievementsPayload {
  unlocked: string[];
}

function achievementsModule(store: { unlocked: string[] }): ChronicaModule<AchievementsPayload> {
  return {
    id: 'achievements',
    initialize() {
      store.unlocked = [];
    },
    onChoiceSelected(_ctx, choice) {
      if (choice.uid === 'c1') store.unlocked.push('reached-forest');
    },
    onSessionSave() {
      return { unlocked: [...store.unlocked] };
    },
    onSessionLoad(_ctx, payload) {
      store.unlocked = payload?.unlocked ? [...payload.unlocked] : [];
    },
  };
}

describe('ModuleRegistry (through ChronicaSession)', () => {
  test('hook order is deterministic and matches registration order', async () => {
    const calls: string[] = [];
    const mkModule = (id: string): ChronicaModule => ({
      id,
      initialize: () => { calls.push(`init:${id}`); },
      onSessionStart: () => { calls.push(`start:${id}`); },
      onChoiceSelected: () => { calls.push(`choice:${id}`); },
      onTurnResolved: () => { calls.push(`turn:${id}`); },
    });

    const session = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    session.register(mkModule('a'));
    session.register(mkModule('b'));

    await session.start();
    await session.choose(session.visibleChoices[0]);

    expect(calls).toEqual([
      'init:a', 'init:b',
      'start:a', 'start:b',
      'turn:a', 'turn:b',       // entry turn
      'choice:a', 'choice:b',
      'turn:a', 'turn:b',       // choice turn
    ]);
  });

  test('save/load round-trip preserves module payload', async () => {
    const sourceStore = { unlocked: [] as string[] };
    const source = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    source.register(achievementsModule(sourceStore));
    await source.start();
    await source.choose(source.visibleChoices[0]);

    const save = source.toSave('p-modules')!;
    expect(save.modules?.achievements).toEqual({ unlocked: ['reached-forest'] });

    const targetStore = { unlocked: [] as string[] };
    const target = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    target.register(achievementsModule(targetStore));
    const resume = await target.tryResume({ save });
    expect(resume.ok).toBe(true);
    expect(targetStore.unlocked).toEqual(['reached-forest']);
  });

  test('legacy save without modules block delivers undefined payload', async () => {
    const source = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    await source.start();
    await source.choose(source.visibleChoices[0]);
    const save = source.toSave('p-modules')!;
    expect(save.modules).toBeUndefined();

    const targetStore = { unlocked: ['stale'] };
    const target = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    target.register(achievementsModule(targetStore));
    await expect(target.tryResume({ save })).resolves.toEqual(
      expect.objectContaining({ ok: true }),
    );
    expect(targetStore.unlocked).toEqual([]);
  });

  test('module hook errors are isolated and surfaced via module_error', async () => {
    const good = jest.fn();
    const bad = jest.fn(() => { throw new Error('bad module'); });
    const badAsync = jest.fn(async () => { throw new Error('bad async'); });

    const session = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    const errors: ModuleErrorEvent[] = [];
    session.bus.on('module_error', payload => errors.push(payload));

    session.register({ id: 'good', initialize: good });
    session.register({
      id: 'bad',
      initialize: () => {},
      onChoiceSelected: bad,
    });
    session.register({
      id: 'bad-async',
      initialize: () => {},
      onTurnResolved: badAsync,
    });

    await session.start();
    const result = await session.choose(session.visibleChoices[0]);

    expect(result.ok).toBe(true);
    expect(good).toHaveBeenCalledTimes(1);
    expect(bad).toHaveBeenCalledTimes(1);
    expect(badAsync).toHaveBeenCalledTimes(2); // entry turn + choice turn
    expect(errors.map(e => `${e.moduleId}:${e.hook}`)).toEqual([
      'bad-async:onTurnResolved', // entry turn — bad-async throws
      'bad:onChoiceSelected',
      'bad-async:onTurnResolved', // choice turn — bad-async throws again
    ]);
  });

  test('onSessionSave failure isolates without corrupting the save', async () => {
    const errors: ModuleErrorEvent[] = [];
    const session = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    session.bus.on('module_error', p => errors.push(p));
    session.register({
      id: 'saver',
      initialize: () => {},
      onSessionSave: () => { throw new Error('cannot serialize'); },
    });
    session.register({
      id: 'other',
      initialize: () => {},
      onSessionSave: () => ({ value: 42 }),
    });

    await session.start();
    const save = session.toSave('p-modules')!;

    expect(save.modules?.saver).toBeUndefined();
    expect(save.modules?.other).toEqual({ value: 42 });
    expect(errors[0]).toEqual(
      expect.objectContaining({ moduleId: 'saver', hook: 'onSessionSave' }),
    );
  });

  test('unregister stops future dispatches', async () => {
    const store = { unlocked: [] as string[] };
    const session = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    session.register(achievementsModule(store));
    session.unregister('achievements');
    await session.start();
    await session.choose(session.visibleChoices[0]);
    expect(store.unlocked).toEqual([]);
  });

  test('duplicate id replaces earlier registration', async () => {
    const first: ChronicaModule = { id: 'dup', initialize: jest.fn() };
    const second: ChronicaModule = { id: 'dup', initialize: jest.fn() };
    const session = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    session.register(first);
    session.register(second);

    await session.start();
    expect(first.initialize).not.toHaveBeenCalled();
    expect(second.initialize).toHaveBeenCalledTimes(1);
    expect(session.modules.list()).toHaveLength(1);
  });

  test('context.updateState mutates state and emits state_changed', async () => {
    const events: unknown[] = [];
    const session = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    session.bus.on('state_changed', p => events.push(p));
    session.register({
      id: 'poker',
      initialize: ctx => {
        ctx.updateState(s => s.setVariable('poked', true));
      },
    });
    await session.start();
    expect(session.state.getVariable('poked')).toBe(true);
    // At least one state_changed from the updateState call, plus one from start().
    expect(events.length).toBeGreaterThanOrEqual(2);
  });

  test('turn resolution proceeds normally with zero modules', async () => {
    const session = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    await session.start();
    const result = await session.choose(session.visibleChoices[0]);
    expect(result.ok).toBe(true);
    expect(session.fragment?.locationId).toBe('forest');
  });

  test('turn resolution proceeds with one test module', async () => {
    const seen: string[] = [];
    const session = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    session.register({
      id: 'watcher',
      initialize: () => { seen.push('init'); },
      onSessionStart: () => { seen.push('start'); },
      onChoiceSelected: (_ctx, choice) => { seen.push(`choice:${choice.uid}`); },
      onTurnResolved: (_ctx, result) => { seen.push(`turn:${result.source}`); },
    });
    await session.start();
    const result = await session.choose(session.visibleChoices[0]);

    expect(result.ok).toBe(true);
    expect(session.fragment?.locationId).toBe('forest');
    expect(seen).toEqual(['init', 'start', 'turn:entry', 'choice:c1', 'turn:choice']);
  });
});
