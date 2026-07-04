import { parseActionString } from '../engine/actions/parse-action';
import { compileProject } from '../engine/compiler';
import { buildCompiledGame } from '../engine/compiler/build-compiled-game';
import { activateHotspot, startSession } from '../engine/chronica-session';
import { isValidCondition } from '../engine/expression-evaluator';
import { validateGameplayCatalogs } from '../engine/gameplay-authoring';
import {
  BUILTIN_GAMEPLAY_COMPONENTS,
  buildGameplayComponent,
  isEditableComponentPatch,
  mergeGameplayComponentPatch,
  searchGameplayComponents,
  validateGameplayComponentResult,
} from '../engine/gameplay-components';
import {
  getActiveObjectives,
  getCollectedInventoryItems,
} from '../engine/gameplay-feedback';
import type { ChronicaState, Project } from '../engine/types';

const ACTOR_UID = '00000000-0000-4000-8000-000000000099';

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    schemaVersion: 3,
    gameId: 'a0000001-0000-4000-8000-000000000099',
    id: 'p1',
    title: 'Component Tale',
    description: '',
    startLocation: 'room',
    initialVariables: {},
    initialMemory: {},
    createdAt: '',
    updatedAt: '',
    assets: [{ id: 'a1', name: 'lantern.png', type: 'image', uri: 'file://lantern.png', mimeType: 'image/png', size: 1, importedAt: '' }],
    characters: [],
    fragments: [{
      uid: 'f1',
      title: 'Room',
      locationId: 'room',
      priority: 0,
      conditions: [],
      effects: [],
      text: 'A room.',
      choices: [],
    }],
    ...overrides,
  };
}

function buildComponent(componentId: string, label: string, extra: Record<string, unknown> = {}) {
  return buildGameplayComponent(
    { componentId, label, includeObjective: true, ...extra },
    makeProject(),
    { createActorUid: () => ACTOR_UID },
  );
}

describe('gameplay components', () => {
  test('ships built-in component library', () => {
    expect(BUILTIN_GAMEPLAY_COMPONENTS.map(c => c.id)).toEqual([
      'treasure-chest',
      'door',
      'npc',
      'collectible',
      'puzzle-switch',
      'checkpoint',
    ]);
  });

  test('search filters by query and category', () => {
    expect(searchGameplayComponents('door')).toHaveLength(1);
    expect(searchGameplayComponents('', 'character').map(c => c.id)).toEqual(['npc']);
  });

  test.each(BUILTIN_GAMEPLAY_COMPONENTS.map(c => c.id))(
    '%s generates valid catalog entries',
    componentId => {
      const label = componentId === 'npc' ? 'Keeper' : 'Test instance';
      const extra = componentId === 'treasure-chest'
        ? { secondaryLabel: 'Gold coin' }
        : componentId === 'door'
          ? { secondaryLabel: 'Brass key' }
          : {};
      const project = makeProject();
      const result = buildComponent(componentId, label, extra);
      expect(validateGameplayComponentResult(project, result).ok).toBe(true);
      expect(isEditableComponentPatch(result.patch)).toBe(true);

      const merged = mergeGameplayComponentPatch(project, result.patch);
      expect(validateGameplayCatalogs({ ...project, ...merged })).toEqual([]);
    },
  );

  test('generated hotspots use valid action grammar', () => {
    const result = buildComponent('collectible', 'Lantern');
    for (const hotspot of result.patch.hotspots ?? []) {
      expect(parseActionString(hotspot.action).ok).toBe(true);
      for (const condition of hotspot.conditions) {
        expect(isValidCondition(condition)).toBe(true);
      }
    }
  });

  test('generated objectives use valid completeWhen conditions', () => {
    const result = buildComponent('checkpoint', 'Harbor rest');
    for (const objective of result.patch.objectives ?? []) {
      expect(isValidCondition(objective.completeWhen)).toBe(true);
    }
  });

  test('generated inventory entries have valid state keys', () => {
    const result = buildComponent('collectible', 'Lantern');
    for (const item of result.patch.inventory ?? []) {
      expect(item.stateKey.startsWith('variables.') || item.stateKey.startsWith('memory.')).toBe(true);
      expect(item.label.trim()).not.toBe('');
    }
  });

  test('generated stage actors include asset and placement', () => {
    const result = buildComponent('npc', 'Keeper');
    expect(result.patch.stageActors).toHaveLength(1);
    expect(result.patch.stageActors![0].x).toBeGreaterThan(0);
    expect(result.patch.stageActors![0].asset).toBeTruthy();
  });

  test('component patch remains editable catalog data after merge', () => {
    const project = makeProject();
    const result = buildComponent('collectible', 'Lantern');
    const merged = mergeGameplayComponentPatch(project, result.patch);
    const item = merged.inventory?.find(i => i.label === 'Lantern');
    expect(item).toBeDefined();
    const edited = { ...item!, label: 'Brass Lantern' };
    const editedProject = {
      ...project,
      ...merged,
      inventory: merged.inventory!.map(i => (i.id === edited.id ? edited : i)),
    };
    expect(editedProject.inventory?.[0].label).toBe('Brass Lantern');
  });

  test('collectible component works with existing runtime', () => {
    const project = makeProject();
    const result = buildComponent('collectible', 'Lantern');
    const merged = mergeGameplayComponentPatch(project, result.patch);
    const withScene: Project = {
      ...project,
      ...merged,
      fragments: [{ ...project.fragments[0], hotspots: result.patch.hotspots ?? [] }],
    };

    const compiled = compileProject(withScene);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    const game = buildCompiledGame(withScene);
    const session = startSession(game);
    const hotspot = result.patch.hotspots![0];
    activateHotspot(hotspot, session.state, game);
    expect(session.state.variables.has_lantern).toBe(true);
  });

  test('generated inventory appears in HUD data and objectives in tracker', () => {
    const project = makeProject();
    const result = buildComponent('collectible', 'Lantern');
    const merged = mergeGameplayComponentPatch(project, result.patch);
    const full = { ...project, ...merged };

    const state: ChronicaState = {
      location: 'room',
      instability: 0,
      reality_layer: 0,
      memory: {},
      variables: { has_lantern: true },
      dialogueLineIndex: 0,
    };

    expect(getCollectedInventoryItems(full, state).some(i => i.label === 'Lantern')).toBe(true);
    expect(getActiveObjectives(full, { ...state, variables: {} }).some(o => o.title.includes('Lantern'))).toBe(true);
  });

  test('puzzle switch provides toggle hotspots and objective hook', () => {
    const result = buildComponent('puzzle-switch', 'Lever');
    expect(result.patch.hotspots?.length).toBe(2);
    expect(result.patch.gameplayVariables?.[0].key).toBe('lever_presses');
    expect(result.patch.objectives?.[0].completeWhen).toContain('lever_presses');
  });

  test('compiler contract unchanged after component insert', () => {
    const project = makeProject();
    const baseline = compileProject(project);
    expect(baseline.ok).toBe(true);
    if (!baseline.ok) return;

    const result = buildComponent('door', 'Cellar door', { secondaryLabel: 'Iron key' });
    const merged = mergeGameplayComponentPatch(project, result.patch);
    const withComponent = compileProject({
      ...project,
      ...merged,
      fragments: [{ ...project.fragments[0], hotspots: result.patch.hotspots ?? [] }],
    });

    expect(withComponent.ok).toBe(true);
    if (!withComponent.ok) return;
    expect(withComponent.game.version).toBe(baseline.game.version);
    expect(Object.keys(withComponent.game.choiceActions)).toEqual(Object.keys(baseline.game.choiceActions));
  });
});
