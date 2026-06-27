import { compileProject, buildCompiledGame } from '../engine/compiler';
import { startSession } from '../engine/chronica-session';
import { getActiveFragmentFromIndex } from '../engine/compiler/fragment-index';
import { ChronicaRuntime } from '../runtime/chronica-runtime';
import { PlayerHost } from '../runtime/player-host';
import { validateProject } from '../engine/validator';
import {
  getVisibleStageActors,
  resolveStageActorAssetName,
  resolveStageActorPresentations,
} from '../engine/stage-actors';
import type { Fragment, Project, StageActor } from '../engine/types';

const PNG = 'sprite.png';
const GRAZE = 'cow-graze.png';

function makeProject(fragments: Fragment[], overrides: Partial<Project> = {}): Project {
  return {
    schemaVersion: 3,
    gameId: 'a0000001-0000-4000-8000-000000000099',
    id: 'p1',
    title: 'Stage Test',
    description: '',
    startLocation: 'pasture',
    initialVariables: { cow_state: 'idle' },
    initialMemory: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    assets: [
      {
        id: 'a1',
        name: PNG,
        type: 'image',
        uri: 'file:///sprites/cow-idle.png',
        mimeType: 'image/png',
        size: 1,
        importedAt: '',
      },
      {
        id: 'a2',
        name: GRAZE,
        type: 'image',
        uri: 'file:///sprites/cow-graze.png',
        mimeType: 'image/png',
        size: 1,
        importedAt: '',
      },
      {
        id: 'a3',
        name: 'pasture-morning.jpg',
        type: 'image',
        uri: 'file:///bg/pasture-morning.jpg',
        mimeType: 'image/jpeg',
        size: 1,
        importedAt: '',
      },
    ],
    characters: [],
    fragments,
    ...overrides,
  };
}

const cowActor: StageActor = {
  uid: 'actor-cow',
  label: 'Cow',
  asset: PNG,
  x: 0.5,
  y: 0.85,
  width: 0.35,
  expressionFromVariable: 'variables.cow_state',
  expressions: [
    { id: 'idle', asset: PNG },
    { id: 'grazing', asset: GRAZE },
  ],
};

const grassHotspot = {
  uid: 'h-grass',
  label: 'Grass',
  x: 0.2,
  y: 0.6,
  width: 0.25,
  height: 0.2,
  action: 'variables.cow_state = "grazing"',
  conditions: [] as string[],
};

describe('stage actors', () => {
  test('conditional location variants at the same locationId compile', () => {
    const project = makeProject([
      {
        uid: 'f-morning',
        title: 'Pasture (morning)',
        locationId: 'pasture',
        priority: 0,
        conditions: ['variables.time == "morning"'],
        effects: [],
        text: '',
        choices: [],
        backgroundImage: 'pasture-morning.jpg',
        stageActors: [cowActor],
      },
      {
        uid: 'f-evening',
        title: 'Pasture (evening)',
        locationId: 'pasture',
        priority: 1,
        conditions: ['variables.time == "evening"'],
        effects: [],
        text: '',
        choices: [],
        backgroundImage: 'pasture-morning.jpg',
        stageActors: [cowActor],
      },
    ], {
      initialVariables: { cow_state: 'idle', time: 'morning' },
    });

    expect(validateProject(project).some(e => e.type === 'duplicate-location')).toBe(false);
    expect(compileProject(project).ok).toBe(true);
  });

  test('duplicate unconditional locationId still fails validation', () => {
    const project = makeProject([
      {
        uid: 'f1',
        title: 'A',
        locationId: 'pasture',
        priority: 0,
        conditions: [],
        effects: [],
        text: '',
        choices: [],
      },
      {
        uid: 'f2',
        title: 'B',
        locationId: 'pasture',
        priority: 1,
        conditions: [],
        effects: [],
        text: '',
        choices: [],
      },
    ]);

    expect(validateProject(project).some(e => e.type === 'duplicate-location')).toBe(true);
  });

  test('expressionFromVariable selects sprite asset from state', () => {
    const state = startSession(buildCompiledGame(makeProject([
      {
        uid: 'f1',
        title: 'Pasture',
        locationId: 'pasture',
        priority: 0,
        conditions: [],
        effects: [],
        text: '',
        choices: [],
        hotspots: [grassHotspot],
        backgroundImage: 'pasture-morning.jpg',
        stageActors: [cowActor],
      },
    ]))).state;

    expect(resolveStageActorAssetName(cowActor, state)).toEqual({
      assetName: PNG,
      expressionId: 'idle',
    });

    state.variables.cow_state = 'grazing';
    expect(resolveStageActorAssetName(cowActor, state)).toEqual({
      assetName: GRAZE,
      expressionId: 'grazing',
    });
  });

  test('hotspot state change updates stage actor presentation', () => {
    const game = buildCompiledGame(makeProject([
      {
        uid: 'f1',
        title: 'Pasture',
        locationId: 'pasture',
        priority: 0,
        conditions: [],
        effects: [],
        text: '',
        choices: [],
        hotspots: [grassHotspot],
        backgroundImage: 'pasture-morning.jpg',
        stageActors: [cowActor],
      },
    ]));

    const host = PlayerHost.create(game);
    host.startNew();
    expect(host.snapshot().stageActors[0]?.assetName).toBe(PNG);

    host.activateHotspot(host.snapshot().visibleHotspots[0]!);
    expect(host.snapshot().stageActors[0]?.assetName).toBe(GRAZE);
    expect(host.snapshot().stageActors[0]?.spriteUri).toContain('cow-graze.png');
  });

  test('visibleWhen hides stage actors when conditions fail', () => {
    const actor: StageActor = {
      ...cowActor,
      visibleWhen: ['variables.cow_state == "grazing"'],
    };
    const fragment = {
      uid: 'f1',
      title: 'Pasture',
      locationId: 'pasture',
      priority: 0,
      conditions: [],
      effects: [],
      text: '',
      choices: [],
      stageActors: [actor],
    };
    const game = buildCompiledGame(makeProject([fragment]));
    const session = startSession(game);

    expect(getVisibleStageActors(session.fragment!, session.state)).toHaveLength(0);

    session.state.variables.cow_state = 'grazing';
    expect(getVisibleStageActors(session.fragment!, session.state)).toHaveLength(1);
    expect(resolveStageActorPresentations(session.fragment, session.state, game.assets)).toHaveLength(1);
  });

  test('time-of-day fragment swap changes active fragment at same location', () => {
    const project = makeProject([
      {
        uid: 'f-morning',
        title: 'Morning',
        locationId: 'pasture',
        priority: 0,
        conditions: ['variables.time == "morning"'],
        effects: [],
        text: '',
        choices: [{ uid: 'c-sunset', label: 'Wait', action: 'variables.time = "evening"', conditions: [] }],
        backgroundImage: 'pasture-morning.jpg',
        stageActors: [cowActor],
      },
      {
        uid: 'f-evening',
        title: 'Evening',
        locationId: 'pasture',
        priority: 1,
        conditions: ['variables.time == "evening"'],
        effects: [],
        text: '',
        choices: [],
        backgroundImage: 'pasture-morning.jpg',
        stageActors: [{ ...cowActor, x: 0.65 }],
      },
    ], {
      initialVariables: { cow_state: 'idle', time: 'morning' },
    });

    const game = buildCompiledGame(project);
    const rt = new ChronicaRuntime(game);
    rt.start();
    expect(rt.currentFragment?.uid).toBe('f-morning');

    rt.choose(rt.visibleChoices[0]!);
    const evening = getActiveFragmentFromIndex('pasture', rt.runtimeState!, game.fragmentIndex);
    expect(evening?.uid).toBe('f-evening');
    expect(rt.currentFragment?.uid).toBe('f-evening');
    expect(rt.runtimeState?.variables.time).toBe('evening');
  });
});
