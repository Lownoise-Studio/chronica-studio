import { compileProject } from '../engine/compiler';
import { ChronicaSession } from '../engine/compat/chronica-session';
import type { RuntimeModule } from '../engine/compat/module';
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

interface AchievementsState {
  unlocked: string[];
}

function achievementsModule(store: AchievementsState): RuntimeModule<AchievementsState> {
  return {
    id: 'achievements',
    onSessionStart() {
      store.unlocked = [];
    },
    onChoiceResolved(_ctx, { choice }) {
      if (choice.uid === 'c1') store.unlocked.push('reached-forest');
    },
    onSerialize() {
      return { unlocked: [...store.unlocked] };
    },
    onDeserialize(_ctx, payload) {
      store.unlocked = payload?.unlocked ? [...payload.unlocked] : [];
    },
  };
}

describe('ModuleRegistry through ChronicaSession', () => {
  test('module lifecycle hooks fire in order', () => {
    const store: AchievementsState = { unlocked: [] };
    const module = achievementsModule(store);
    const session = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    session.attachModule(module);

    const hooks: string[] = [];
    session.bus.on('session-start', () => hooks.push('start'));
    session.bus.on('choice-selected', () => hooks.push('choice'));
    session.bus.on('turn-resolved', ({ source }) => hooks.push(`turn:${source}`));

    session.start();
    expect(store.unlocked).toEqual([]);
    session.choose(session.visibleChoices[0]);
    expect(store.unlocked).toEqual(['reached-forest']);
    expect(hooks).toEqual(['start', 'turn:entry', 'choice', 'turn:choice']);
  });

  test('save includes module payload and resume restores it', () => {
    const sourceStore: AchievementsState = { unlocked: [] };
    const source = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    source.attachModule(achievementsModule(sourceStore));
    source.start();
    source.choose(source.visibleChoices[0]);

    const save = source.toSave('p-modules')!;
    expect(save.modules?.achievements).toEqual({ unlocked: ['reached-forest'] });

    const targetStore: AchievementsState = { unlocked: [] };
    const target = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    target.attachModule(achievementsModule(targetStore));
    const resume = target.tryResume({ save });
    expect(resume.ok).toBe(true);
    expect(targetStore.unlocked).toEqual(['reached-forest']);
  });

  test('legacy save without modules block deserializes with empty payload', () => {
    const source = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    source.start();
    source.choose(source.visibleChoices[0]);
    const save = source.toSave('p-modules')!;
    expect(save.modules).toBeUndefined();

    const targetStore: AchievementsState = { unlocked: ['stale'] };
    const target = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    target.attachModule(achievementsModule(targetStore));
    expect(target.tryResume({ save }).ok).toBe(true);
    expect(targetStore.unlocked).toEqual([]);
  });

  test('detach removes further dispatches', () => {
    const store: AchievementsState = { unlocked: [] };
    const module = achievementsModule(store);
    const session = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    session.attachModule(module);
    session.detachModule('achievements');
    session.start();
    session.choose(session.visibleChoices[0]);
    expect(store.unlocked).toEqual([]);
  });

  test('duplicate module id replaces the earlier registration', () => {
    const first: RuntimeModule = { id: 'dup', onAttach: jest.fn(), onDetach: jest.fn() };
    const second: RuntimeModule = { id: 'dup', onAttach: jest.fn() };
    const session = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    session.attachModule(first);
    session.attachModule(second);

    expect(first.onDetach).toHaveBeenCalledTimes(1);
    expect(second.onAttach).toHaveBeenCalledTimes(1);
    expect(session.modules.list()).toHaveLength(1);
  });
});
