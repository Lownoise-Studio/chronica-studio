import {
  applyHotspotInteractionAuthoring,
  inventoryItemCollectEffect,
  inventoryItemOwnedCondition,
  syncGameplayCatalogsToInitialState,
  validateGameplayCatalogs,
} from '../engine/gameplay-authoring';
import { buildGameplaySuggestions, extractProjectMemoryFlags } from '../engine/editor-helpers';
import type { InventoryItem, Project, SceneHotspot } from '../engine/types';

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    schemaVersion: 3,
    gameId: 'a0000001-0000-4000-8000-000000000099',
    id: 'p1',
    title: 'Story',
    description: '',
    startLocation: 'intro',
    initialVariables: {},
    initialMemory: {},
    createdAt: '',
    updatedAt: '',
    assets: [],
    characters: [],
    fragments: [],
    ...overrides,
  };
}

describe('gameplay authoring helpers', () => {
  const lantern: InventoryItem = {
    id: 'lantern',
    label: 'Lantern',
    assetName: 'lantern.png',
    stateKey: 'variables.has_lantern',
    stateKind: 'variable',
  };

  test('inventory helpers use existing state paths', () => {
    expect(inventoryItemOwnedCondition(lantern)).toBe('variables.has_lantern == true');
    expect(inventoryItemCollectEffect(lantern)).toBe('variables.has_lantern = true');
  });

  test('applyHotspotInteractionAuthoring builds collect action and one-shot guard', () => {
    const hotspot: SceneHotspot = {
      uid: 'h1',
      label: 'Crate',
      x: 0.5,
      y: 0.5,
      width: 0.2,
      height: 0.2,
      action: '',
      conditions: [],
      interactionKind: 'collect',
      itemId: 'lantern',
      repeatMode: 'one-shot',
    };
    const applied = applyHotspotInteractionAuthoring(hotspot, [lantern]);
    expect(applied.action).toContain('variables.has_lantern = true');
    expect(applied.action).toContain('memory.hotspot_h1_used = true');
    expect(applied.conditions).toContain('memory.hotspot_h1_used != true');
  });

  test('syncGameplayCatalogsToInitialState merges gameplay variables and world flags', () => {
    const project = makeProject({
      gameplayVariables: [{ id: 'v1', key: 'trust', label: 'Trust', kind: 'boolean', initialValue: false }],
      worldState: [{
        id: 'door',
        label: 'Harbor door',
        category: 'door',
        stateKey: 'memory.door_unlocked',
        stateKind: 'memory',
        initialValue: false,
      }],
      inventory: [lantern],
    });
    const synced = syncGameplayCatalogsToInitialState(project);
    expect(synced.initialVariables.trust).toBe(false);
    expect(synced.initialMemory.door_unlocked).toBe(false);
    expect(synced.initialVariables.has_lantern).toBe(false);
  });

  test('validateGameplayCatalogs catches invalid state keys', () => {
    const issues = validateGameplayCatalogs(makeProject({
      inventory: [{
        id: 'bad',
        label: 'Bad item',
        assetName: 'x.png',
        stateKey: 'inventory.bad',
        stateKind: 'variable',
      }],
    }));
    expect(issues.some(i => i.catalog === 'inventory')).toBe(true);
  });

  test('buildGameplaySuggestions includes catalog and memory flags', () => {
    const project = makeProject({
      inventory: [lantern],
      initialMemory: { met_keeper: false },
      fragments: [{
        uid: 'f1',
        title: 'Intro',
        locationId: 'intro',
        priority: 0,
        conditions: [],
        effects: [],
        text: '',
        choices: [{ uid: 'c1', label: 'Go', action: 'set:found_key', conditions: [] }],
      }],
    });
    const suggestions = buildGameplaySuggestions(project);
    expect(suggestions.some(s => s.value.includes('has_lantern'))).toBe(true);
    expect(extractProjectMemoryFlags(project)).toContain('found_key');
  });
});
