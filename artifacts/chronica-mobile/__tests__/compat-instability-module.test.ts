import { compileProject } from '../engine/compiler';
import { ChronicaSession } from '../engine/compat/chronica-session';
import {
  DEFAULT_INSTABILITY_LAYER_THRESHOLDS,
  INSTABILITY_MODULE_ID,
  clampInstability,
  computeRealityLayer,
  createInstabilityModule,
  type InstabilityData,
  type InstabilitySavePayload,
} from '../engine/compat/modules/instability-module';
import { moduleSaveDataFromCompat } from '../engine/compat/module-save';
import type { Fragment, Project } from '../engine/types';

function makeProject(fragments: Fragment[], overrides: Partial<Project> = {}): Project {
  return {
    schemaVersion: 2,
    gameId: 'a0000001-0000-4000-8000-0000000000d1',
    id: 'p-instab',
    title: 'Instability',
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

describe('InstabilityModule', () => {
  test('defaults to instability 0 / realityLayer 0', async () => {
    const session = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    session.register(createInstabilityModule());
    await session.start();
    const data = session.context.getModuleData<InstabilityData>(INSTABILITY_MODULE_ID);
    expect(data).toEqual({ instability: 0, realityLayer: 0 });
    expect(session.state.instability).toBe(0);
    expect(session.state.realityLayer).toBe(0);
  });

  test('increments +0.5 after a player-driven turn', async () => {
    const session = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    session.register(createInstabilityModule());
    await session.start();
    await session.choose(session.visibleChoices[0]);
    expect(session.state.instability).toBe(0.5);
  });

  test('clampInstability floors at 0', () => {
    expect(clampInstability(-100)).toBe(0);
    expect(clampInstability(-0.0001)).toBe(0);
    expect(clampInstability(0)).toBe(0);
    expect(clampInstability(42.5)).toBe(42.5);
    expect(clampInstability(Number.NaN)).toBe(0);
    expect(clampInstability(Number.POSITIVE_INFINITY)).toBe(0);
  });

  test('turn increment clamps to zero when overshoot goes negative', async () => {
    const session = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    session.register(createInstabilityModule({ turnIncrement: -100 }));
    await session.start();
    await session.choose(session.visibleChoices[0]);
    expect(session.state.instability).toBe(0);
  });

  test('reality layer transitions at 60 / 100 / 150', () => {
    expect(computeRealityLayer(0)).toBe(0);
    expect(computeRealityLayer(59.9)).toBe(0);
    expect(computeRealityLayer(60)).toBe(1);
    expect(computeRealityLayer(99.9)).toBe(1);
    expect(computeRealityLayer(100)).toBe(2);
    expect(computeRealityLayer(149.9)).toBe(2);
    expect(computeRealityLayer(150)).toBe(3);
    expect(computeRealityLayer(9999)).toBe(3);
  });

  test('reality_layer_changed fires when crossing 60 threshold', async () => {
    const session = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    session.register(createInstabilityModule({ turnIncrement: 30 }));
    await session.start();

    const layerEvents: { previous: number; current: number }[] = [];
    session.bus.on('reality_layer_changed', payload => layerEvents.push(payload));

    await session.choose(session.visibleChoices[0]); // 30
    await session.choose(session.visibleChoices[0]); // 60 → layer 1
    await session.choose(session.visibleChoices[0]); // 90

    expect(layerEvents).toEqual([{ previous: 0, current: 1 }]);
    expect(session.state.instability).toBe(90);
    expect(session.state.realityLayer).toBe(1);
  });

  test('instability_changed fires with previous/current values', async () => {
    const session = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    session.register(createInstabilityModule());
    await session.start();

    const events: { previous: number; current: number }[] = [];
    session.bus.on('instability_changed', payload => events.push(payload));

    await session.choose(session.visibleChoices[0]);
    await session.choose(session.visibleChoices[0]);

    expect(events).toEqual([
      { previous: 0, current: 0.5 },
      { previous: 0.5, current: 1 },
    ]);
  });

  test('save/load round-trip restores instability and layer', async () => {
    const source = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    source.register(createInstabilityModule({ turnIncrement: 60 }));
    await source.start();
    await source.choose(source.visibleChoices[0]); // instability 60, layer 1
    const save = source.toSave('p-instab')!;
    const payload = moduleSaveDataFromCompat(save.modules, INSTABILITY_MODULE_ID) as InstabilitySavePayload;
    expect(payload).toEqual({ version: 1, instability: 60, realityLayer: 1 });

    const target = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    target.register(createInstabilityModule());
    const resume = await target.tryResume({ save });
    expect(resume.ok).toBe(true);
    expect(target.state.instability).toBe(60);
    expect(target.state.realityLayer).toBe(1);
  });

  test('onSessionLoad with missing payload falls back to defaults', async () => {
    // Save from a session with no InstabilityModule attached → no payload.
    const source = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    await source.start();
    const save = source.toSave('p-instab')!;
    expect(save.modules).toBeUndefined();

    const target = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    target.register(createInstabilityModule());
    await target.tryResume({ save });
    expect(target.state.instability).toBe(0);
    expect(target.state.realityLayer).toBe(0);
  });

  test('onSessionLoad with invalid payload falls back to defaults', async () => {
    const target = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    target.register(createInstabilityModule());
    await target.start();

    // Directly invoke the load path with a mangled payload.
    const badPayload = { version: 99, instability: 'not-a-number' } as unknown;
    await target.modules.loadAll(target.context, { [INSTABILITY_MODULE_ID]: badPayload });
    expect(target.state.instability).toBe(0);
    expect(target.state.realityLayer).toBe(0);
  });

  test('onSessionLoad clamps negative saved instability to 0', async () => {
    const target = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    target.register(createInstabilityModule());
    await target.start();
    const evil: InstabilitySavePayload = { version: 1, instability: -50, realityLayer: 0 };
    await target.modules.loadAll(target.context, { [INSTABILITY_MODULE_ID]: evil });
    expect(target.state.instability).toBe(0);
  });

  test('entry and resume do not add the increment on their own', async () => {
    const session = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    session.register(createInstabilityModule({ turnIncrement: 5 }));
    await session.start();
    expect(session.state.instability).toBe(0);

    await session.choose(session.visibleChoices[0]);
    const save = session.toSave('p-instab')!;
    const target = new ChronicaSession(compileOrThrow(makeProject(fragments)));
    target.register(createInstabilityModule({ turnIncrement: 5 }));
    await target.tryResume({ save });
    expect(target.state.instability).toBe(5);
  });

  test('default thresholds are exported for consumer use', () => {
    expect(DEFAULT_INSTABILITY_LAYER_THRESHOLDS).toEqual([60, 100, 150]);
  });
});
