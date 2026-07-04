import type {
  GameObjective,
  GameplayVariable,
  InventoryItem,
  NpcStateProfile,
  Project,
  SceneHotspot,
  StageActor,
  StageActorGameplayState,
  WorldStateFlag,
} from './types';

const STATE_KEY_RE = /^(variables|memory)\.\w+$/;

export function isValidStateKey(key: string): boolean {
  return STATE_KEY_RE.test(key.trim());
}

export function inventoryItemOwnedCondition(item: InventoryItem): string {
  return `${item.stateKey.trim()} == true`;
}

export function inventoryItemCollectEffect(item: InventoryItem): string {
  return `${item.stateKey.trim()} = true`;
}

export function inventoryItemRemoveEffect(item: InventoryItem): string {
  return `${item.stateKey.trim()} = false`;
}

export function inventoryItemConsumeEffect(item: InventoryItem): string {
  return inventoryItemRemoveEffect(item);
}

export function worldStateCondition(flag: WorldStateFlag, expected: boolean | number | string): string {
  const literal = typeof expected === 'string' ? `"${expected}"` : String(expected);
  return `${flag.stateKey.trim()} == ${literal}`;
}

export function objectiveCompleteCondition(objective: GameObjective): string {
  return objective.completeWhen.trim();
}

export function objectiveRevealCondition(objective: GameObjective): string | undefined {
  return objective.revealWhen?.trim() || undefined;
}

export function npcStateCondition(profile: NpcStateProfile, state: StageActorGameplayState): string | undefined {
  if (!profile.stateVariable?.trim()) return undefined;
  return `${profile.stateVariable.trim()} == "${state}"`;
}

export function npcMetCondition(profile: NpcStateProfile): string | undefined {
  if (!profile.metFlag?.trim()) return undefined;
  return `${profile.metFlag.trim()} == true`;
}

export function oneShotConsumedFlag(hotspotUid: string): string {
  return `memory.hotspot_${hotspotUid}_used`;
}

export function oneShotConsumedCondition(hotspotUid: string): string {
  return `${oneShotConsumedFlag(hotspotUid)} != true`;
}

export function oneShotConsumeEffect(hotspotUid: string): string {
  return `${oneShotConsumedFlag(hotspotUid)} = true`;
}

/** Merge gameplay variable definitions into project initial state maps. */
export function syncGameplayCatalogsToInitialState(project: Project): Pick<Project, 'initialVariables' | 'initialMemory'> {
  const initialVariables = { ...project.initialVariables };
  const initialMemory = { ...project.initialMemory };

  for (const variable of project.gameplayVariables ?? []) {
    const key = variable.key.trim();
    if (!key) continue;
    initialVariables[key] = variable.initialValue;
  }

  for (const flag of project.worldState ?? []) {
    if (!isValidStateKey(flag.stateKey)) continue;
    const [, pathKey] = flag.stateKey.split('.');
    if (flag.stateKind === 'memory') {
      initialMemory[pathKey] = flag.initialValue;
    } else {
      initialVariables[pathKey] = flag.initialValue;
    }
  }

  for (const item of project.inventory ?? []) {
    if (!isValidStateKey(item.stateKey)) continue;
    const [, pathKey] = item.stateKey.split('.');
    if (item.stateKind === 'memory') {
      if (initialMemory[pathKey] === undefined) initialMemory[pathKey] = false;
    } else if (initialVariables[pathKey] === undefined) {
      initialVariables[pathKey] = false;
    }
  }

  return { initialVariables, initialMemory };
}

/** Suggest action + conditions from hotspot interaction metadata. */
export function applyHotspotInteractionAuthoring(
  hotspot: SceneHotspot,
  inventory: readonly InventoryItem[],
): Pick<SceneHotspot, 'action' | 'conditions'> {
  const conditions = [...(hotspot.conditions ?? [])];
  let action = hotspot.action?.trim() ?? '';

  if (hotspot.enabled === false) {
    conditions.push('variables.__disabled == true');
  }

  if (hotspot.repeatMode === 'one-shot') {
    const guard = oneShotConsumedCondition(hotspot.uid);
    if (!conditions.includes(guard)) conditions.push(guard);
  }

  const item = hotspot.itemId
    ? inventory.find(i => i.id === hotspot.itemId)
    : undefined;
  const required = hotspot.requiredItemId
    ? inventory.find(i => i.id === hotspot.requiredItemId)
    : undefined;

  switch (hotspot.interactionKind) {
    case 'collect':
      if (item) {
        action = inventoryItemCollectEffect(item);
        if (hotspot.repeatMode === 'one-shot') {
          action = `${action}; ${oneShotConsumeEffect(hotspot.uid)}`;
        }
      }
      break;
    case 'use-item':
      if (required) {
        conditions.push(inventoryItemOwnedCondition(required));
      }
      if (item && item.consumable) {
        action = inventoryItemConsumeEffect(item);
      } else if (required?.consumable) {
        action = inventoryItemConsumeEffect(required);
      }
      if (hotspot.repeatMode === 'one-shot' && action) {
        action = `${action}; ${oneShotConsumeEffect(hotspot.uid)}`;
      }
      break;
    case 'inspect':
      // Inspect keeps custom/trigger action; inspectText is authoring-only for now.
      break;
    case 'trigger':
    case 'custom':
    default:
      break;
  }

  return { action, conditions };
}

export function stageActorVisibleWhenForState(actor: StageActor): string[] {
  const base = [...(actor.visibleWhen ?? [])];
  if (actor.gameplayState === 'hidden') {
    base.push('variables.__hidden_actor == true');
  }
  if (actor.stateVariable?.trim() && actor.gameplayState) {
    base.push(`${actor.stateVariable.trim()} == "${actor.gameplayState}"`);
  }
  return base;
}

export function collectGameplayConditionSuggestions(project: Project): string[] {
  const suggestions = new Set<string>();

  for (const item of project.inventory ?? []) {
    suggestions.add(inventoryItemOwnedCondition(item));
    suggestions.add(`${item.stateKey.trim()} != true`);
  }
  for (const flag of project.worldState ?? []) {
    suggestions.add(worldStateCondition(flag, true));
    suggestions.add(worldStateCondition(flag, false));
  }
  for (const objective of project.objectives ?? []) {
    if (objective.completeWhen.trim()) suggestions.add(objective.completeWhen.trim());
    if (objective.failWhen?.trim()) suggestions.add(objective.failWhen.trim());
    if (objective.revealWhen?.trim()) suggestions.add(objective.revealWhen.trim());
  }
  for (const profile of project.npcProfiles ?? []) {
    const met = npcMetCondition(profile);
    if (met) suggestions.add(met);
    if (profile.stateVariable?.trim()) {
      for (const state of ['idle', 'following', 'hidden', 'hostile', 'friendly', 'disabled'] as const) {
        suggestions.add(`${profile.stateVariable.trim()} == "${state}"`);
      }
    }
  }
  for (const variable of project.gameplayVariables ?? []) {
    suggestions.add(`variables.${variable.key.trim()} == true`);
    suggestions.add(`variables.${variable.key.trim()} >= 1`);
  }

  return Array.from(suggestions).sort();
}

export interface GameplayCatalogIssue {
  catalog: 'inventory' | 'objectives' | 'worldState' | 'gameplayVariables' | 'npcProfiles';
  id: string;
  message: string;
}

/** Editor-time validation — does not gate compileProject. */
export function validateGameplayCatalogs(project: Project): GameplayCatalogIssue[] {
  const issues: GameplayCatalogIssue[] = [];
  const seen = new Map<string, string>();

  const checkDuplicate = (catalog: GameplayCatalogIssue['catalog'], id: string) => {
    const prior = seen.get(`${catalog}:${id}`);
    if (prior) {
      issues.push({ catalog, id, message: `Duplicate id "${id}"` });
    } else {
      seen.set(`${catalog}:${id}`, id);
    }
  };

  for (const item of project.inventory ?? []) {
    checkDuplicate('inventory', item.id);
    if (!item.label.trim()) issues.push({ catalog: 'inventory', id: item.id, message: 'Missing label' });
    if (!item.assetName.trim()) issues.push({ catalog: 'inventory', id: item.id, message: 'Missing asset' });
    if (!isValidStateKey(item.stateKey)) {
      issues.push({ catalog: 'inventory', id: item.id, message: 'stateKey must be variables.* or memory.*' });
    }
  }

  for (const objective of project.objectives ?? []) {
    checkDuplicate('objectives', objective.id);
    if (!objective.title.trim()) issues.push({ catalog: 'objectives', id: objective.id, message: 'Missing title' });
    if (!objective.completeWhen.trim()) {
      issues.push({ catalog: 'objectives', id: objective.id, message: 'Missing completeWhen condition' });
    }
  }

  for (const flag of project.worldState ?? []) {
    checkDuplicate('worldState', flag.id);
    if (!flag.label.trim()) issues.push({ catalog: 'worldState', id: flag.id, message: 'Missing label' });
    if (!isValidStateKey(flag.stateKey)) {
      issues.push({ catalog: 'worldState', id: flag.id, message: 'stateKey must be variables.* or memory.*' });
    }
  }

  for (const variable of project.gameplayVariables ?? []) {
    checkDuplicate('gameplayVariables', variable.id);
    if (!variable.key.trim()) issues.push({ catalog: 'gameplayVariables', id: variable.id, message: 'Missing key' });
    if (!/^\w+$/.test(variable.key.trim())) {
      issues.push({ catalog: 'gameplayVariables', id: variable.id, message: 'Key must be a simple slug' });
    }
  }

  for (const profile of project.npcProfiles ?? []) {
    checkDuplicate('npcProfiles', profile.id);
    if (!profile.label.trim()) issues.push({ catalog: 'npcProfiles', id: profile.id, message: 'Missing label' });
    if (profile.stateVariable?.trim() && !profile.stateVariable.trim().startsWith('variables.')) {
      issues.push({ catalog: 'npcProfiles', id: profile.id, message: 'stateVariable should start with variables.' });
    }
    if (profile.metFlag?.trim() && !profile.metFlag.trim().startsWith('memory.')) {
      issues.push({ catalog: 'npcProfiles', id: profile.id, message: 'metFlag should start with memory.' });
    }
  }

  return issues;
}
