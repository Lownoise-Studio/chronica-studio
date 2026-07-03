import { compileProject } from '../engine/compiler';
import { ChronicaSession } from '../engine/compat/chronica-session';
import {
  ECHO_MODULE_ID,
  createEchoModule,
  normalizeEcho,
  type EchoInstance,
  type EchoSavePayload,
  type EchoState,
} from '../engine/compat/modules/echo-module';
import {
  INSTABILITY_MODULE_ID,
  createInstabilityModule,
  type InstabilityData,
} from '../engine/compat/modules/instability-module';
import { moduleSaveDataFromCompat } from '../engine/compat/module-save';
import type { Fragment, Project } from '../engine/types';

function makeProject(fragments: Fragment[], overrides: Partial<Project> = {}): Project {
  return {
    schemaVersion: 2,
    gameId: 'a0000001-0000-4000-8000-0000000000e1',
    id: 'p-echo',
    title: 'Echoes',
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
    uid: 'f1', title: 'Intro', locationId: 'intro',
    priority: 0, conditions: [], effects: [], text: '.',
    choices: [{ uid: 'c1', label: 'Loop', action: 'goto:intro', conditions: [] }],
  },
];

function compileOrThrow(project: Project) {
  const result = compileProject(project);
  if (!result.ok) throw new Error('compile failed');
  return result.game;
}

function currentEchoes(session: ChronicaSession): EchoInstance[] {
  return session.context.getModuleData<EchoInstance[]>(ECHO_MODULE_ID) ?? [];
}

function makeSessionWithBoth(turnIncrement: number, echoes: Partial<EchoInstance>[]) {
  const session = new ChronicaSession(compileOrThrow(makeProject(fragments)));
  session.register(createInstabilityModule({ turnIncrement }));
  session.register(createEchoModule({ echoes }));
  return session;
}

describe('EchoModule', () => {
  test('defaults to an empty echo list', async () => {
    const session = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    session.register(createEchoModule());
    await session.start();
    expect(currentEchoes(session)).toEqual([]);
  });

  test('normalizeEcho fills defaults for missing fields', () => {
    expect(normalizeEcho({ id: 'e1' })).toEqual({
      id: 'e1',
      attachedFragmentId: undefined,
      attachedRoomId: undefined,
      state: 'Dormant',
      activationThreshold: 0,
      manifestationThreshold: 0,
      resolved: false,
    });
  });

  test('registered echo definitions are loaded on session start', async () => {
    const session = makeSessionWithBoth(0, [
      {
        id: 'e1',
        attachedFragmentId: 'f1',
        activationThreshold: 60,
        manifestationThreshold: 100,
      },
    ]);
    await session.start();
    const echoes = currentEchoes(session);
    expect(echoes).toHaveLength(1);
    expect(echoes[0]).toEqual({
      id: 'e1',
      attachedFragmentId: 'f1',
      attachedRoomId: undefined,
      state: 'Dormant',
      activationThreshold: 60,
      manifestationThreshold: 100,
      resolved: false,
    });
  });

  test('activates when instability >= activation threshold', async () => {
    const session = makeSessionWithBoth(60, [
      { id: 'e1', activationThreshold: 60, manifestationThreshold: 200 },
    ]);
    await session.start();
    await session.choose(session.visibleChoices[0]);
    expect(currentEchoes(session)[0].state).toBe('Active');
  });

  test('manifests when instability >= manifestation threshold', async () => {
    const session = makeSessionWithBoth(60, [
      { id: 'e1', activationThreshold: 40, manifestationThreshold: 60 },
    ]);
    await session.start();
    await session.choose(session.visibleChoices[0]);
    expect(currentEchoes(session)[0].state).toBe('Manifested');
  });

  test('single large jump cascades Dormant → Manifested in one turn', async () => {
    const session = makeSessionWithBoth(150, [
      { id: 'e1', activationThreshold: 60, manifestationThreshold: 100 },
    ]);
    await session.start();
    const transitions: string[] = [];
    session.bus.on('echo_state_changed', p =>
      transitions.push(`${p.previousState}→${p.currentState}`),
    );
    await session.choose(session.visibleChoices[0]);
    expect(currentEchoes(session)[0].state).toBe('Manifested');
    expect(transitions).toEqual(['Dormant→Manifested']);
  });

  test('emits echo_state_changed with previous/current values', async () => {
    const session = makeSessionWithBoth(60, [
      { id: 'e1', activationThreshold: 60, manifestationThreshold: 200 },
    ]);
    await session.start();
    const events: { echoId: string; previousState: EchoState; currentState: EchoState }[] = [];
    session.bus.on('echo_state_changed', payload => events.push(payload));
    await session.choose(session.visibleChoices[0]);
    expect(events).toEqual([
      { echoId: 'e1', previousState: 'Dormant', currentState: 'Active' },
    ]);
  });

  test('resolved echoes never reactivate', async () => {
    const session = makeSessionWithBoth(200, [
      {
        id: 'e1',
        activationThreshold: 10,
        manifestationThreshold: 20,
        state: 'Resolved',
        resolved: true,
      },
    ]);
    await session.start();
    await session.choose(session.visibleChoices[0]);
    await session.choose(session.visibleChoices[0]);
    const [echo] = currentEchoes(session);
    expect(echo.state).toBe('Resolved');
    expect(echo.resolved).toBe(true);
  });

  test('save/load round-trip preserves echo state', async () => {
    const source = makeSessionWithBoth(60, [
      { id: 'e1', activationThreshold: 60, manifestationThreshold: 200 },
      { id: 'e2', activationThreshold: 500, manifestationThreshold: 1000 },
    ]);
    await source.start();
    await source.choose(source.visibleChoices[0]);
    const save = source.toSave('p-echo')!;
    const payload = moduleSaveDataFromCompat(save.modules, ECHO_MODULE_ID) as EchoSavePayload;
    expect(payload.version).toBe(1);
    expect(payload.echoes.find(e => e.id === 'e1')?.state).toBe('Active');
    expect(payload.echoes.find(e => e.id === 'e2')?.state).toBe('Dormant');

    const target = makeSessionWithBoth(60, []); // No seeds — restored from save.
    const resume = await target.tryResume({ save });
    expect(resume.ok).toBe(true);
    const echoes = currentEchoes(target);
    expect(echoes.find(e => e.id === 'e1')?.state).toBe('Active');
    expect(echoes.find(e => e.id === 'e2')?.state).toBe('Dormant');
  });

  test('legacy save without echo payload falls back to seed definitions', async () => {
    const source = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    await source.start();
    const save = source.toSave('p-echo')!;
    expect(save.modules).toBeUndefined();

    const target = makeSessionWithBoth(0, [{ id: 'e1', activationThreshold: 60, manifestationThreshold: 100 }]);
    await target.tryResume({ save });
    const echoes = currentEchoes(target);
    expect(echoes).toHaveLength(1);
    expect(echoes[0].state).toBe('Dormant');
  });

  test('invalid save payload falls back to seeds', async () => {
    const target = makeSessionWithBoth(0, [
      { id: 'e1', activationThreshold: 60, manifestationThreshold: 100 },
    ]);
    await target.start();
    await target.modules.loadAll(target.context, {
      [ECHO_MODULE_ID]: { version: 99, notEchoes: 'garbage' },
    });
    const echoes = currentEchoes(target);
    expect(echoes).toHaveLength(1);
    expect(echoes[0].id).toBe('e1');
    expect(echoes[0].state).toBe('Dormant');
  });

  test('load with resolved:true snaps state to Resolved', async () => {
    const target = makeSessionWithBoth(0, []);
    await target.start();
    const payload: EchoSavePayload = {
      version: 1,
      echoes: [
        {
          id: 'e1',
          state: 'Active',
          activationThreshold: 10,
          manifestationThreshold: 20,
          resolved: true,
        },
      ],
    };
    await target.modules.loadAll(target.context, { [ECHO_MODULE_ID]: payload });
    const [echo] = currentEchoes(target);
    expect(echo.state).toBe('Resolved');
    expect(echo.resolved).toBe(true);
  });

  test('works safely without InstabilityModule attached', async () => {
    const session = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    session.register(
      createEchoModule({
        echoes: [{ id: 'e1', activationThreshold: 60, manifestationThreshold: 100 }],
      }),
    );
    await session.start();
    // No InstabilityModule → state.instability stays 0 → echo stays Dormant.
    await session.choose(session.visibleChoices[0]);
    expect(currentEchoes(session)[0].state).toBe('Dormant');
  });

  test('falls back to state.instability when InstabilityModule is not attached', async () => {
    const session = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    session.register(
      createEchoModule({
        echoes: [{ id: 'e1', activationThreshold: 60, manifestationThreshold: 100 }],
      }),
    );
    await session.start();
    // Simulate an authored effect having raised instability.
    session.context.updateState(state => {
      state.raw.instability = 75;
    });
    await session.choose(session.visibleChoices[0]);
    expect(currentEchoes(session)[0].state).toBe('Active');
  });

  test('reads instability from InstabilityModule when both are attached', async () => {
    const session = makeSessionWithBoth(60, [
      { id: 'e1', activationThreshold: 60, manifestationThreshold: 100 },
    ]);
    await session.start();
    await session.choose(session.visibleChoices[0]);
    const data = session.context.getModuleData<InstabilityData>(INSTABILITY_MODULE_ID);
    expect(data?.instability).toBe(60);
    expect(currentEchoes(session)[0].state).toBe('Active');
  });

  test('resolved echoes emit no state_changed event when already Resolved', async () => {
    const session = makeSessionWithBoth(100, [
      {
        id: 'e1',
        activationThreshold: 10,
        manifestationThreshold: 20,
        state: 'Resolved',
        resolved: true,
      },
    ]);
    await session.start();
    const events: unknown[] = [];
    session.bus.on('echo_state_changed', p => events.push(p));
    await session.choose(session.visibleChoices[0]);
    await session.choose(session.visibleChoices[0]);
    expect(events).toEqual([]);
  });
});
