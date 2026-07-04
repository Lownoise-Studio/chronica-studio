import { evaluateCondition, resolveStatePath } from './expression-evaluator';
import { inventoryItemOwnedCondition } from './gameplay-authoring';
import type {
  ChronicaState,
  Fragment,
  GameObjective,
  InventoryItem,
  Project,
  SceneHotspot,
  VariableValue,
  WorldStateFlag,
} from './types';

export type ObjectiveDisplayStatus = 'active' | 'completed' | 'failed' | 'hidden';

export interface ObjectiveDisplayEntry {
  objective: GameObjective;
  status: ObjectiveDisplayStatus;
}

export interface SceneGameplayPreview {
  inventory: InventoryItem[];
  objectives: GameObjective[];
  worldState: WorldStateFlag[];
}

function isOwnedValue(value: VariableValue): boolean {
  if (value === true) return true;
  if (typeof value === 'number') return value > 0;
  if (typeof value === 'string') return value.trim() !== '' && value !== 'false' && value !== '0';
  return false;
}

export function isInventoryItemCollected(item: InventoryItem, state: ChronicaState): boolean {
  return isOwnedValue(resolveStatePath(item.stateKey, state));
}

/** Inventory items whose catalog state key reads as collected. */
export function getCollectedInventoryItems(
  project: Pick<Project, 'inventory'>,
  state: ChronicaState,
): InventoryItem[] {
  return (project.inventory ?? []).filter(item => isInventoryItemCollected(item, state));
}

export function resolveObjectiveDisplayStatus(
  objective: GameObjective,
  state: ChronicaState,
): ObjectiveDisplayStatus {
  if (objective.failWhen?.trim() && evaluateCondition(objective.failWhen, state)) {
    return 'failed';
  }
  if (objective.completeWhen.trim() && evaluateCondition(objective.completeWhen, state)) {
    return 'completed';
  }
  if (objective.presentation === 'hidden') {
    if (objective.revealWhen?.trim() && !evaluateCondition(objective.revealWhen, state)) {
      return 'hidden';
    }
  }
  if (objective.presentation === 'failed') return 'failed';
  if (objective.presentation === 'completed') return 'completed';
  if (objective.presentation === 'hidden' && !objective.revealWhen?.trim()) {
    return 'hidden';
  }
  return 'active';
}

export function getObjectiveDisplayEntries(
  project: Pick<Project, 'objectives'>,
  state: ChronicaState,
): ObjectiveDisplayEntry[] {
  return (project.objectives ?? []).map(objective => ({
    objective,
    status: resolveObjectiveDisplayStatus(objective, state),
  }));
}

export function getActiveObjectives(
  project: Pick<Project, 'objectives'>,
  state: ChronicaState,
): GameObjective[] {
  return getObjectiveDisplayEntries(project, state)
    .filter(entry => entry.status === 'active')
    .map(entry => entry.objective);
}

export function getCompletedObjectives(
  project: Pick<Project, 'objectives'>,
  state: ChronicaState,
): GameObjective[] {
  return getObjectiveDisplayEntries(project, state)
    .filter(entry => entry.status === 'completed')
    .map(entry => entry.objective);
}

function cloneState(state: ChronicaState): ChronicaState {
  return {
    ...state,
    variables: { ...state.variables },
    memory: { ...state.memory },
  };
}

function stateKeyChanged(
  stateKey: string,
  before: ChronicaState,
  after: ChronicaState,
): boolean {
  return resolveStatePath(stateKey, before) !== resolveStatePath(stateKey, after);
}

function worldFlagFeedback(flag: WorldStateFlag): string {
  switch (flag.category) {
    case 'door':
      return `${flag.label} unlocked`;
    case 'light':
      return `${flag.label} on`;
    case 'bridge':
      return `${flag.label} changed`;
    case 'enemy':
      return `${flag.label} defeated`;
    case 'npc':
      return `${flag.label} moved`;
    default:
      return `${flag.label} updated`;
  }
}

/** Build player-facing feedback after a hotspot resolves successfully. */
export function buildHotspotInteractionFeedback(
  project: Pick<Project, 'inventory' | 'objectives' | 'worldState'>,
  hotspot: SceneHotspot,
  before: ChronicaState,
  after: ChronicaState,
): string | null {
  for (const item of project.inventory ?? []) {
    if (!isInventoryItemCollected(item, before) && isInventoryItemCollected(item, after)) {
      if (hotspot.itemId === item.id || hotspot.interactionKind === 'collect') {
        return `Picked up ${item.label}`;
      }
      if (hotspot.requiredItemId === item.id) {
        return `Used ${item.label}`;
      }
    }
  }

  for (const flag of project.worldState ?? []) {
    if (stateKeyChanged(flag.stateKey, before, after) && isOwnedValue(resolveStatePath(flag.stateKey, after))) {
      return worldFlagFeedback(flag);
    }
  }

  const beforeObjectives = getObjectiveDisplayEntries(project, before);
  const afterObjectives = getObjectiveDisplayEntries(project, after);
  for (const afterEntry of afterObjectives) {
    const was = beforeObjectives.find(e => e.objective.id === afterEntry.objective.id);
    if (was?.status !== 'completed' && afterEntry.status === 'completed') {
      return `Objective updated: ${afterEntry.objective.title}`;
    }
  }

  if (hotspot.interactionKind === 'inspect' && hotspot.inspectText?.trim()) {
    return hotspot.inspectText.trim();
  }

  const linkedItem = (project.inventory ?? []).find(i => i.id === hotspot.itemId || i.id === hotspot.requiredItemId);
  if (linkedItem && stateKeyChanged(linkedItem.stateKey, before, after)) {
    return `${linkedItem.label} updated`;
  }

  if (hotspot.label?.trim()) {
    return hotspot.label.trim();
  }

  return null;
}

function fragmentAuthoredText(fragment: Fragment): string {
  const parts: string[] = [
    ...fragment.conditions,
    ...fragment.effects,
    fragment.text,
    ...(fragment.dialogue?.map(line => line.text) ?? []),
  ];
  for (const choice of fragment.choices) {
    parts.push(choice.action, ...choice.conditions);
  }
  for (const hotspot of fragment.hotspots ?? []) {
    parts.push(hotspot.action, ...hotspot.conditions, hotspot.inspectText ?? '');
  }
  for (const actor of fragment.stageActors ?? []) {
    parts.push(...(actor.visibleWhen ?? []), actor.stateVariable ?? '');
  }
  return parts.join('\n');
}

function catalogEntryReferenced(haystack: string, stateKey: string): boolean {
  const key = stateKey.trim();
  if (!key) return false;
  return haystack.includes(key);
}

/** Editor preview: catalogs referenced by the current scene's authored strings. */
export function getSceneGameplayPreview(
  fragment: Fragment,
  project: Pick<Project, 'inventory' | 'objectives' | 'worldState'>,
): SceneGameplayPreview {
  const haystack = fragmentAuthoredText(fragment);
  return {
    inventory: (project.inventory ?? []).filter(item =>
      catalogEntryReferenced(haystack, item.stateKey)
      || catalogEntryReferenced(haystack, inventoryItemOwnedCondition(item)),
    ),
    objectives: (project.objectives ?? []).filter(objective =>
      catalogEntryReferenced(haystack, objective.completeWhen)
      || catalogEntryReferenced(haystack, objective.failWhen ?? '')
      || catalogEntryReferenced(haystack, objective.revealWhen ?? '')
      || catalogEntryReferenced(haystack, objective.title),
    ),
    worldState: (project.worldState ?? []).filter(flag =>
      catalogEntryReferenced(haystack, flag.stateKey),
    ),
  };
}

export { cloneState };
