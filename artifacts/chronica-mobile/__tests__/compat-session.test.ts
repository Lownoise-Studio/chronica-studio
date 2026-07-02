import { compileProject } from '../engine/compiler';
import { ChronicaSession } from '../engine/compat/chronica-session';
import type { Fragment, Project } from '../engine/types';
import type { RuntimeEventName } from '../engine/compat/types';

function makeProject(fragments: Fragment[], overrides: Partial<Project> = {}): Project {
  return {
    schemaVersion: 2,
    gameId: 'a0000001-0000-4000-8000-0000000000aa',
    id: 'p-compat',
    title: 'Compat Test',
    description: '',
    startLocation: 'intro',
    initialVariables: { trust: 0 },
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
    effects: ['variables.trust += 1'],
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

describe('ChronicaSession', () => {
  test('start applies entry effects and emits ordered events', () => {
    const session = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    const order: RuntimeEventName[] = [];
    (['session-start', 'fragment-changed', 'state-changed', 'turn-resolved'] as const)
      .forEach(name => session.bus.on(name, () => order.push(name)));

    expect(session.start()).toBe(true);
    expect(session.fragment?.locationId).toBe('intro');
    expect(session.state.getVariable('trust')).toBe(1);
    expect(order).toEqual([
      'session-start',
      'fragment-changed',
      'state-changed',
      'turn-resolved',
    ]);
  });

  test('choose advances location and history', () => {
    const session = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    session.start();
    const result = session.choose(session.visibleChoices[0]);
    expect(result.ok).toBe(true);
    expect(session.fragment?.locationId).toBe('forest');
    expect(session.history).toHaveLength(2);
  });

  test('choose without start reports not-started', () => {
    const session = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    const choice = fragments[0].choices[0];
    expect(session.choose(choice)).toEqual({ ok: false, reason: 'not-started' });
  });

  test('choose with unknown action uid reports unknown-action', () => {
    const session = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    session.start();
    const result = session.choose({ uid: 'nope', label: '', action: '', conditions: [] });
    expect(result).toEqual({ ok: false, reason: 'unknown-action' });
  });

  test('save round-trip resumes at the saved fragment', () => {
    const source = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    source.start();
    source.choose(source.visibleChoices[0]);
    const save = source.toSave('p-compat')!;
    expect(save.compatVersion).toBe(1);
    expect(save.projectId).toBe('p-compat');
    expect(save.gameId).toBe('a0000001-0000-4000-8000-0000000000aa');

    const target = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    const resume = target.tryResume({ save });
    expect(resume.ok).toBe(true);
    expect(target.fragment?.locationId).toBe('forest');
    expect(target.history).toHaveLength(2);
  });

  test('resume rejects stale saves after content change', () => {
    const source = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    source.start();
    const save = source.toSave('p-compat')!;

    const edited = compileOrThrow(makeProject([
      { ...fragments[0], text: 'Edited.' },
      fragments[1],
    ]));
    const target = new ChronicaSession(edited);
    expect(target.tryResume({ save })).toEqual({ ok: false, reason: 'stale-content' });
  });

  test('resume rejects saves for the wrong game', () => {
    const source = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    source.start();
    const save = source.toSave('p-compat')!;

    const other = compileOrThrow(makeProject(fragments, {
      gameId: 'a0000001-0000-4000-8000-0000000000bb',
    }));
    const target = new ChronicaSession(other);
    expect(target.tryResume({ save })).toEqual({ ok: false, reason: 'wrong-game' });
  });

  test('reset returns to unstarted', () => {
    const session = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    session.start();
    session.choose(session.visibleChoices[0]);
    session.reset();
    expect(session.isStarted).toBe(false);
    expect(session.fragment).toBeNull();
    expect(session.history).toHaveLength(0);
  });
});
