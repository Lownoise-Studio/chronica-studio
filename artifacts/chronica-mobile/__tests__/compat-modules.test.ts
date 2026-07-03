import { compileProject } from '../engine/compiler';
import { ChronicaSession } from '../engine/compat/chronica-session';
import type { ChronicaModule } from '../engine/compat/module';
import { moduleSaveDataFromCompat } from '../engine/compat/module-save';
import type { ModuleErrorEvent, ModuleSaveEntry } from '../engine/compat/types';
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
  test('module hooks complete before choice_selected event', async () => {
    const order: string[] = [];
    const session = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    session.bus.on('choice_selected', () => order.push('event:choice_selected'));
    session.register({
      id: 'hooks',
      initialize: () => {},
      onChoiceSelected: () => { order.push('hook:onChoiceSelected'); },
      onTurnResolved: () => { order.push('hook:onTurnResolved'); },
    });

    await session.start();
    order.length = 0;
    await session.choose(session.visibleChoices[0]);

    expect(order.indexOf('hook:onChoiceSelected')).toBeLessThan(
      order.indexOf('event:choice_selected'),
    );
    expect(order.indexOf('hook:onTurnResolved')).toBeLessThan(
      order.indexOf('event:choice_selected'),
    );
  });

  test('lower priority modules run before higher priority', async () => {
    const calls: string[] = [];
    const mk = (id: string, priority?: number): ChronicaModule => ({
      id,
      priority,
      initialize: () => { calls.push(id); },
    });

    const session = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    session.register(mk('zero', 0));
    session.register(mk('neg', -1));
    session.register(mk('pos', 1));

    await session.start();
    expect(calls).toEqual(['neg', 'zero', 'pos']);
  });

  test('same priority preserves registration order', async () => {
    const calls: string[] = [];
    const mk = (id: string): ChronicaModule => ({
      id,
      priority: 0,
      initialize: () => { calls.push(id); },
    });

    const session = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    session.register(mk('first'));
    session.register(mk('second'));

    await session.start();
    expect(calls).toEqual(['first', 'second']);
  });

  test('missing priority defaults to 0', async () => {
    const calls: string[] = [];
    const session = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    session.register({
      id: 'explicit-zero',
      priority: 0,
      initialize: () => { calls.push('explicit-zero'); },
    });
    session.register({
      id: 'implicit-zero',
      initialize: () => { calls.push('implicit-zero'); },
    });
    session.register({
      id: 'negative',
      priority: -1,
      initialize: () => { calls.push('negative'); },
    });

    await session.start();
    expect(calls).toEqual(['negative', 'explicit-zero', 'implicit-zero']);
  });

  test('duplicate id replacement preserves registration slot', async () => {
    const calls: string[] = [];
    const mk = (id: string, tag: string, priority = 0): ChronicaModule => ({
      id,
      priority,
      initialize: () => { calls.push(tag); },
    });

    const session = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    session.register(mk('a', 'a-v1', 0));
    session.register(mk('b', 'b-v1', 0));
    session.register(mk('a', 'a-v2', 0));

    await session.start();
    expect(calls).toEqual(['a-v2', 'b-v1']);
  });

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
    expect(save.modules).toEqual([
      { id: 'achievements', data: { unlocked: ['reached-forest'] } },
    ] satisfies ModuleSaveEntry[]);

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

    expect(save.modules).toEqual([{ id: 'other', data: { value: 42 } }]);
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

  test('saveAll emits ModuleSaveEntry array with optional config', async () => {
    const session = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    session.register({
      id: 'configured',
      initialize: () => {},
      onSessionSaveConfig: () => ({ tier: 2 }),
      onSessionSave: () => ({ score: 10 }),
    });
    await session.start();
    const save = session.toSave('p-modules')!;
    expect(save.modules).toEqual([
      { id: 'configured', config: { tier: 2 }, data: { score: 10 } },
    ]);
  });

  test('legacy record modules still load via tryResume', async () => {
    const sourceStore = { unlocked: [] as string[] };
    const source = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    source.register(achievementsModule(sourceStore));
    await source.start();
    await source.choose(source.visibleChoices[0]);

    const modern = source.toSave('p-modules')!;
    const legacySave = {
      ...modern,
      modules: {
        achievements: { unlocked: ['reached-forest'] },
      },
    };

    const targetStore = { unlocked: [] as string[] };
    const target = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    target.register(achievementsModule(targetStore));
    const resume = await target.tryResume({ save: legacySave });
    expect(resume.ok).toBe(true);
    expect(targetStore.unlocked).toEqual(['reached-forest']);
  });

  test('loadAll applies config before data', async () => {
    const order: string[] = [];
    const session = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    session.register({
      id: 'ordered',
      initialize: () => {},
      onSessionLoadConfig: () => { order.push('config'); },
      onSessionLoad: () => { order.push('data'); },
    });
    await session.start();
    await session.modules.loadAll(session.context, [
      { id: 'ordered', config: { tier: 1 }, data: { score: 3 } },
    ]);
    expect(order).toEqual(['config', 'data']);
  });

  test('loadAll skips config hook when config is missing', async () => {
    const configHook = jest.fn();
    const dataHook = jest.fn();
    const session = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    session.register({
      id: 'data-only',
      initialize: () => {},
      onSessionLoadConfig: configHook,
      onSessionLoad: dataHook,
    });
    await session.start();
    await session.modules.loadAll(session.context, [
      { id: 'data-only', data: { score: 1 } },
    ]);
    expect(configHook).not.toHaveBeenCalled();
    expect(dataHook).toHaveBeenCalledWith(expect.anything(), { score: 1 });
  });

  test('config and data save hook errors remain isolated', async () => {
    const errors: ModuleErrorEvent[] = [];
    const session = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    session.bus.on('module_error', payload => errors.push(payload));
    session.register({
      id: 'broken-config',
      initialize: () => {},
      onSessionSaveConfig: () => { throw new Error('config fail'); },
    });
    session.register({
      id: 'broken-data',
      initialize: () => {},
      onSessionSave: () => { throw new Error('data fail'); },
    });
    session.register({
      id: 'healthy',
      initialize: () => {},
      onSessionSaveConfig: () => ({ tier: 1 }),
      onSessionSave: () => ({ value: 1 }),
    });

    await session.start();
    const save = session.toSave('p-modules')!;
    expect(save.modules).toEqual([
      { id: 'healthy', config: { tier: 1 }, data: { value: 1 } },
    ]);
    expect(errors.map(e => `${e.moduleId}:${e.hook}`)).toEqual([
      'broken-config:onSessionSaveConfig',
      'broken-data:onSessionSave',
    ]);
  });
});
