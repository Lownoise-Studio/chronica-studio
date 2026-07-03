import { compileProject } from '../engine/compiler';
import { ChronicaSession } from '../engine/compat/chronica-session';
import type { RuntimeEventName } from '../engine/compat/types';
import type { Fragment, Project } from '../engine/types';

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
      { uid: 'c2', label: 'Stay', action: 'set:idle', conditions: [] },
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

describe('ChronicaSession (zero modules)', () => {
  test('start applies entry effects and emits ordered events', async () => {
    const session = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    const order: RuntimeEventName[] = [];
    (['session_started', 'fragment_changed', 'state_changed', 'turn_resolved'] as const)
      .forEach(name => session.bus.on(name, () => order.push(name)));

    expect(await session.start()).toBe(true);
    expect(session.fragment?.locationId).toBe('intro');
    expect(session.state.getVariable('trust')).toBe(1);
    expect(order).toEqual([
      'session_started',
      'fragment_changed',
      'state_changed',
      'turn_resolved',
    ]);
  });

  test('choose advances location, history, and emits fragment_changed exactly once', async () => {
    const session = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    await session.start();
    const fragmentChanged: unknown[] = [];
    session.bus.on('fragment_changed', payload => fragmentChanged.push(payload));

    const result = await session.choose(session.visibleChoices[0]);
    expect(result.ok).toBe(true);
    expect(session.fragment?.locationId).toBe('forest');
    expect(session.history).toHaveLength(2);
    expect(fragmentChanged).toHaveLength(1);
  });

  test('choose always emits state_changed and fragment_changed on success', async () => {
    const session = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    await session.start();

    const stateChanges: unknown[] = [];
    const fragmentChanges: unknown[] = [];
    session.bus.on('state_changed', p => stateChanges.push(p));
    session.bus.on('fragment_changed', p => fragmentChanges.push(p));

    await session.choose(session.visibleChoices[1]);
    expect(stateChanges).toHaveLength(1);
    expect(fragmentChanges).toHaveLength(1);
  });

  test('choose emits events in spec order with full choice_selected payload', async () => {
    const session = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    await session.start();

    const order: string[] = [];
    session.bus.on('choice_selected', () => order.push('choice_selected'));
    session.bus.on('turn_resolved', () => order.push('turn_resolved'));
    session.bus.on('state_changed', () => order.push('state_changed'));
    session.bus.on('fragment_changed', () => order.push('fragment_changed'));

    let payload: unknown;
    session.bus.on('choice_selected', p => { payload = p; });

    const choice = session.visibleChoices[0];
    await session.choose(choice);

    expect(order).toEqual([
      'choice_selected',
      'turn_resolved',
      'state_changed',
      'fragment_changed',
    ]);
    expect(payload).toEqual(
      expect.objectContaining({
        choice,
        previousFragment: expect.objectContaining({ uid: 'f1' }),
        resultingFragment: expect.objectContaining({ uid: 'f2' }),
        currentFragment: expect.objectContaining({ uid: 'f2' }),
        previousState: expect.objectContaining({ location: 'intro' }),
        currentState: expect.objectContaining({ location: 'forest' }),
        turnResult: expect.objectContaining({
          source: 'choice',
          fragment: expect.objectContaining({ uid: 'f2' }),
          stateChanged: true,
          fragmentChanged: true,
        }),
      }),
    );
  });

  test('choose without start reports not-started', async () => {
    const session = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    const choice = fragments[0].choices[0];
    await expect(session.choose(choice)).resolves.toEqual({ ok: false, reason: 'not-started' });
  });

  test('choose with unknown action uid reports unknown-action', async () => {
    const session = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    await session.start();
    const result = await session.choose({ uid: 'nope', label: '', action: '', conditions: [] });
    expect(result).toEqual({ ok: false, reason: 'unknown-action' });
  });

  test('save round-trip resumes at the saved fragment', async () => {
    const source = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    await source.start();
    await source.choose(source.visibleChoices[0]);
    const save = source.toSave('p-compat')!;
    expect(save).toEqual(
      expect.objectContaining({
        compatVersion: 1,
        projectId: 'p-compat',
        gameId: 'a0000001-0000-4000-8000-0000000000aa',
        fragmentId: 'f2',
      }),
    );

    const target = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    const resume = await target.tryResume({ save });
    expect(resume.ok).toBe(true);
    expect(target.fragment?.locationId).toBe('forest');
    expect(target.history).toHaveLength(2);
  });

  test('resume rejects stale saves after content change', async () => {
    const source = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    await source.start();
    const save = source.toSave('p-compat')!;

    const edited = compileOrThrow(makeProject([
      { ...fragments[0], text: 'Edited.' },
      fragments[1],
    ]));
    const target = new ChronicaSession(edited);
    await expect(target.tryResume({ save })).resolves.toEqual({ ok: false, reason: 'stale-content' });
  });

  test('resume rejects saves for the wrong game', async () => {
    const source = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    await source.start();
    const save = source.toSave('p-compat')!;

    const other = compileOrThrow(makeProject(fragments, {
      gameId: 'a0000001-0000-4000-8000-0000000000bb',
    }));
    const target = new ChronicaSession(other);
    await expect(target.tryResume({ save })).resolves.toEqual({ ok: false, reason: 'wrong-game' });
  });

  test('resume tolerates saves without a fragmentId (legacy compat)', async () => {
    const source = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    await source.start();
    await source.choose(source.visibleChoices[0]);
    const save = source.toSave('p-compat')!;
    delete save.fragmentId;

    const target = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    const resume = await target.tryResume({ save });
    expect(resume.ok).toBe(true);
    expect(target.fragment?.locationId).toBe('forest');
  });

  test('reset returns to unstarted', async () => {
    const session = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    await session.start();
    await session.choose(session.visibleChoices[0]);
    session.reset();
    expect(session.isStarted).toBe(false);
    expect(session.fragment).toBeNull();
    expect(session.history).toHaveLength(0);
  });
});
