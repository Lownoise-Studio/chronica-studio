import {
  buildHotspotInteractionFeedback,
  cloneState,
  getActiveObjectives,
  getCollectedInventoryItems,
  getCompletedObjectives,
  resolveObjectiveDisplayStatus,
} from '../engine/gameplay-feedback';
import type { ChronicaState, GameObjective, InventoryItem, Project, SceneHotspot } from '../engine/types';

function makeState(overrides: Partial<ChronicaState> = {}): ChronicaState {
  return {
    location: 'intro',
    instability: 0,
    reality_layer: 0,
    memory: {},
    variables: {},
    dialogueLineIndex: 0,
    ...overrides,
  };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    schemaVersion: 3,
    gameId: 'game',
    id: 'p1',
    title: 'Story',
    description: '',
    startLocation: 'intro',
    initialVariables: {},
    initialMemory: {},
    createdAt: '',
    updatedAt: '',
    fragments: [],
    assets: [],
    characters: [],
    ...overrides,
  };
}

const lantern: InventoryItem = {
  id: 'lantern',
  label: 'Lantern',
  assetName: 'lantern.png',
  stateKey: 'variables.has_lantern',
  stateKind: 'variable',
};

describe('gameplay feedback — inventory HUD data', () => {
  test('inventory HUD hides when empty', () => {
    const items = getCollectedInventoryItems(makeProject({ inventory: [lantern] }), makeState());
    expect(items).toEqual([]);
  });

  test('inventory HUD shows collected item', () => {
    const items = getCollectedInventoryItems(
      makeProject({ inventory: [lantern] }),
      makeState({ variables: { has_lantern: true } }),
    );
    expect(items).toEqual([lantern]);
  });
});

describe('gameplay feedback — objectives', () => {
  const findLantern: GameObjective = {
    id: 'find_lantern',
    title: 'Find the lantern',
    presentation: 'active',
    completeWhen: 'variables.has_lantern == true',
  };
  const secret: GameObjective = {
    id: 'secret',
    title: 'Hidden task',
    presentation: 'hidden',
    completeWhen: 'memory.secret_done == true',
    revealWhen: 'memory.met_keeper == true',
  };

  test('active objective appears', () => {
    const active = getActiveObjectives(makeProject({ objectives: [findLantern] }), makeState());
    expect(active.map(o => o.id)).toEqual(['find_lantern']);
  });

  test('hidden objective does not appear until reveal condition passes', () => {
    expect(resolveObjectiveDisplayStatus(secret, makeState())).toBe('hidden');
    expect(getActiveObjectives(makeProject({ objectives: [secret] }), makeState())).toEqual([]);

    const revealed = makeState({ memory: { met_keeper: true } });
    expect(resolveObjectiveDisplayStatus(secret, revealed)).toBe('active');
    expect(getActiveObjectives(makeProject({ objectives: [secret] }), revealed).map(o => o.id)).toEqual(['secret']);
  });

  test('completed objective can be surfaced', () => {
    const completed = getCompletedObjectives(
      makeProject({ objectives: [findLantern] }),
      makeState({ variables: { has_lantern: true } }),
    );
    expect(completed.map(o => o.id)).toEqual(['find_lantern']);
  });
});

describe('gameplay feedback — hotspot interaction toast', () => {
  test('hotspot interaction feedback appears from authored collect action', () => {
    const hotspot: SceneHotspot = {
      uid: 'h1',
      label: 'Crate',
      x: 0.5,
      y: 0.5,
      width: 0.2,
      height: 0.2,
      action: 'variables.has_lantern = true',
      conditions: [],
      interactionKind: 'collect',
      itemId: 'lantern',
    };
    const before = makeState();
    const after = makeState({ variables: { has_lantern: true } });
    const message = buildHotspotInteractionFeedback(
      makeProject({ inventory: [lantern] }),
      hotspot,
      before,
      after,
    );
    expect(message).toBe('Picked up Lantern');
  });

  test('inspectText fallback when no state diff', () => {
    const hotspot: SceneHotspot = {
      uid: 'h2',
      label: 'Note',
      x: 0.5,
      y: 0.5,
      width: 0.2,
      height: 0.2,
      action: '',
      conditions: [],
      interactionKind: 'inspect',
      inspectText: 'The ink is still wet.',
    };
    const state = makeState();
    expect(buildHotspotInteractionFeedback(makeProject(), hotspot, state, cloneState(state))).toBe(
      'The ink is still wet.',
    );
  });
});
