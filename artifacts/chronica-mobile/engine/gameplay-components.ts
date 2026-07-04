import {
  applyHotspotInteractionAuthoring,
  inventoryItemCollectEffect,
  inventoryItemOwnedCondition,
  npcMetCondition,
  syncGameplayCatalogsToInitialState,
  validateGameplayCatalogs,
} from './gameplay-authoring';
import { createId } from './identity';
import type {
  Fragment,
  GameObjective,
  GameplayVariable,
  InventoryItem,
  NpcStateProfile,
  Project,
  SceneHotspot,
  StageActor,
  WorldStateFlag,
} from './types';

/** Authoring-only prefab — expands into Phase 1 catalogs; no runtime concept. */
export type GameplayComponentCategory = 'interaction' | 'character' | 'progression' | 'world' | 'utility';

export type GameplayComponentIcon =
  | 'box'
  | 'lock'
  | 'user'
  | 'gift'
  | 'toggle-left'
  | 'flag';

export interface GameplayComponentDefinition {
  id: string;
  name: string;
  description: string;
  icon: GameplayComponentIcon;
  category: GameplayComponentCategory;
}

export interface GameplayComponentInput {
  componentId: string;
  /** Instance label — chest name, door name, NPC name, etc. */
  label: string;
  /** Reward name, key name, inspect copy, etc. */
  secondaryLabel?: string;
  assetName?: string;
  includeObjective?: boolean;
  /** Door component: require a key item. */
  requireKey?: boolean;
}

export interface GameplayComponentPreviewLine {
  category: string;
  summary: string;
}

/** Expanded authoring data — all fields remain editable after insert. */
export interface GameplayComponentPatch {
  inventory?: InventoryItem[];
  objectives?: GameObjective[];
  worldState?: WorldStateFlag[];
  npcProfiles?: NpcStateProfile[];
  gameplayVariables?: GameplayVariable[];
  hotspots?: SceneHotspot[];
  stageActors?: StageActor[];
  suggestedConditions?: string[];
  suggestedEffects?: string[];
}

export interface GameplayComponentResult {
  component: GameplayComponentDefinition;
  preview: GameplayComponentPreviewLine[];
  patch: GameplayComponentPatch;
}

export interface GameplayComponentBuildOptions {
  createActorUid?: () => string;
}

export const GAMEPLAY_COMPONENT_CATEGORIES: readonly GameplayComponentCategory[] = [
  'interaction',
  'character',
  'progression',
  'world',
  'utility',
] as const;

export const BUILTIN_GAMEPLAY_COMPONENTS: GameplayComponentDefinition[] = [
  {
    id: 'treasure-chest',
    name: 'Treasure Chest',
    description: 'One-shot chest hotspot, inventory reward, and opened flag.',
    icon: 'box',
    category: 'interaction',
  },
  {
    id: 'door',
    name: 'Door',
    description: 'Door hotspot with locked/open world state and optional key requirement.',
    icon: 'lock',
    category: 'world',
  },
  {
    id: 'npc',
    name: 'NPC',
    description: 'Stage actor, NPC profile, met flag, and talk hotspot.',
    icon: 'user',
    category: 'character',
  },
  {
    id: 'collectible',
    name: 'Collectible',
    description: 'Inventory pickup hotspot with optional collection objective.',
    icon: 'gift',
    category: 'interaction',
  },
  {
    id: 'puzzle-switch',
    name: 'Puzzle Switch',
    description: 'Repeatable switch hotspot, toggle state flag, and objective hook.',
    icon: 'toggle-left',
    category: 'progression',
  },
  {
    id: 'checkpoint',
    name: 'Checkpoint',
    description: 'Checkpoint hotspot, save hint copy, and reached memory flag.',
    icon: 'flag',
    category: 'utility',
  },
];

function slugify(value: string): string {
  const slug = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return slug || 'entry';
}

function collectCatalogIds(project: Pick<Project, 'inventory' | 'objectives' | 'worldState' | 'npcProfiles' | 'gameplayVariables'>): Set<string> {
  const ids = new Set<string>();
  for (const item of project.inventory ?? []) ids.add(item.id);
  for (const objective of project.objectives ?? []) ids.add(objective.id);
  for (const flag of project.worldState ?? []) ids.add(flag.id);
  for (const profile of project.npcProfiles ?? []) ids.add(profile.id);
  for (const variable of project.gameplayVariables ?? []) ids.add(variable.id);
  return ids;
}

function collectHotspotUids(project: Pick<Project, 'fragments'>): Set<string> {
  const ids = new Set<string>();
  for (const fragment of project.fragments ?? []) {
    for (const hotspot of fragment.hotspots ?? []) ids.add(hotspot.uid);
  }
  return ids;
}

function uniqueSlug(base: string, existing: Set<string>): string {
  const root = slugify(base);
  let candidate = root;
  let suffix = 2;
  while (existing.has(candidate)) {
    candidate = `${root}_${suffix}`;
    suffix += 1;
  }
  existing.add(candidate);
  return candidate;
}

function uniqueHotspotUid(base: string, existing: Set<string>): string {
  const root = `hs_${slugify(base)}`;
  let candidate = root;
  let suffix = 2;
  while (existing.has(candidate)) {
    candidate = `${root}_${suffix}`;
    suffix += 1;
  }
  existing.add(candidate);
  return candidate;
}

function defaultHotspot(label: string, uid: string, y = 0.55): SceneHotspot {
  return {
    uid,
    label,
    x: 0.5,
    y,
    width: 0.18,
    height: 0.2,
    action: '',
    conditions: [],
  };
}

function defaultAsset(project: Pick<Project, 'assets'>, override?: string): string {
  return override?.trim() || project.assets?.find(a => a.type === 'image')?.name || '';
}

function buildTreasureChest(
  input: GameplayComponentInput,
  project: Pick<Project, 'assets' | 'fragments'>,
  ids: Set<string>,
  hotspotUids: Set<string>,
): GameplayComponentPatch {
  const chestId = uniqueSlug(input.label, ids);
  const rewardLabel = input.secondaryLabel?.trim() || 'Treasure';
  const rewardId = uniqueSlug(rewardLabel, ids);
  const openedKey = `memory.${chestId}_opened`;

  const reward: InventoryItem = {
    id: rewardId,
    label: rewardLabel,
    assetName: defaultAsset(project, input.assetName),
    stateKey: `variables.has_${rewardId}`,
    stateKind: 'variable',
  };

  const openedFlag: WorldStateFlag = {
    id: `${chestId}_opened`,
    label: `${input.label.trim()} opened`,
    category: 'custom',
    stateKey: openedKey,
    stateKind: 'memory',
    initialValue: false,
  };

  const hotspotUid = uniqueHotspotUid(chestId, hotspotUids);
  const hotspotBase: SceneHotspot = {
    ...defaultHotspot(input.label.trim(), hotspotUid),
    action: '',
    conditions: [`${openedKey} != true`],
    interactionKind: 'collect',
    itemId: reward.id,
    repeatMode: 'one-shot',
  };
  const applied = applyHotspotInteractionAuthoring(hotspotBase, [reward]);
  const hotspot: SceneHotspot = {
    ...hotspotBase,
    ...applied,
    action: applied.action ? `${applied.action}; ${openedKey} = true` : `${inventoryItemCollectEffect(reward)}; ${openedKey} = true`,
  };

  const patch: GameplayComponentPatch = {
    inventory: [reward],
    worldState: [openedFlag],
    hotspots: [hotspot],
  };

  if (input.includeObjective !== false) {
    const objectiveId = uniqueSlug(`open_${chestId}`, ids);
    patch.objectives = [{
      id: objectiveId,
      title: `Open ${input.label.trim()}`,
      presentation: 'active',
      completeWhen: `${openedKey} == true`,
    }];
  }

  return patch;
}

function buildDoor(
  input: GameplayComponentInput,
  project: Pick<Project, 'assets' | 'fragments'>,
  ids: Set<string>,
  hotspotUids: Set<string>,
): GameplayComponentPatch {
  const doorId = uniqueSlug(input.label, ids);
  const openedKey = `memory.${doorId}_open`;

  const doorFlag: WorldStateFlag = {
    id: doorId,
    label: input.label.trim(),
    category: 'door',
    stateKey: openedKey,
    stateKind: 'memory',
    initialValue: false,
  };

  const patch: GameplayComponentPatch = {
    worldState: [doorFlag],
  };

  const requireKey = input.requireKey !== false;
  let inventory: InventoryItem[] | undefined;
  const hotspotUid = uniqueHotspotUid(doorId, hotspotUids);

  if (requireKey) {
    const keyLabel = input.secondaryLabel?.trim() || 'Key';
    const keyId = uniqueSlug(keyLabel, ids);
    const keyItem: InventoryItem = {
      id: keyId,
      label: keyLabel,
      assetName: defaultAsset(project, input.assetName),
      stateKey: `variables.has_${keyId}`,
      stateKind: 'variable',
    };
    inventory = [keyItem];
    patch.inventory = inventory;

    const hotspotBase: SceneHotspot = {
      ...defaultHotspot(input.label.trim(), hotspotUid),
      action: `${openedKey} = true`,
      conditions: [`${openedKey} != true`],
      interactionKind: 'use-item',
      requiredItemId: keyItem.id,
      repeatMode: 'one-shot',
    };
    patch.hotspots = [{ ...hotspotBase, ...applyHotspotInteractionAuthoring(hotspotBase, [keyItem]) }];
  } else {
    patch.hotspots = [{
      ...defaultHotspot(input.label.trim(), hotspotUid),
      action: `${openedKey} = true`,
      conditions: [`${openedKey} != true`],
      interactionKind: 'trigger',
      repeatMode: 'one-shot',
    }];
  }

  if (input.includeObjective !== false) {
    const objectiveId = uniqueSlug(`open_${doorId}`, ids);
    patch.objectives = [{
      id: objectiveId,
      title: `Open ${input.label.trim()}`,
      presentation: 'active',
      completeWhen: `${openedKey} == true`,
    }];
  }

  return patch;
}

function buildNpc(
  input: GameplayComponentInput,
  project: Pick<Project, 'assets' | 'fragments'>,
  ids: Set<string>,
  hotspotUids: Set<string>,
  createActorUid: () => string,
): GameplayComponentPatch {
  const npcId = uniqueSlug(input.label, ids);
  const profile: NpcStateProfile = {
    id: npcId,
    label: input.label.trim(),
    defaultState: 'idle',
    stateVariable: `variables.${npcId}_state`,
    metFlag: `memory.met_${npcId}`,
  };

  const stageActor: StageActor = {
    uid: createActorUid(),
    label: profile.label,
    asset: defaultAsset(project, input.assetName),
    x: 0.5,
    y: 0.82,
    width: 0.28,
    stateVariable: profile.stateVariable,
    gameplayState: profile.defaultState,
  };

  const metCondition = npcMetCondition(profile)!;
  const hotspotUid = uniqueHotspotUid(`talk_${npcId}`, hotspotUids);
  const hotspot: SceneHotspot = {
    ...defaultHotspot(`Talk to ${profile.label}`, hotspotUid, 0.72),
    action: `${profile.metFlag} = true`,
    conditions: [`${profile.metFlag} != true`],
    interactionKind: 'trigger',
    repeatMode: 'one-shot',
  };

  const patch: GameplayComponentPatch = {
    npcProfiles: [profile],
    stageActors: [stageActor],
    hotspots: [hotspot],
    suggestedConditions: [metCondition],
  };

  if (input.includeObjective !== false) {
    const objectiveId = uniqueSlug(`meet_${npcId}`, ids);
    patch.objectives = [{
      id: objectiveId,
      title: `Talk to ${profile.label}`,
      presentation: 'active',
      completeWhen: metCondition,
    }];
  }

  return patch;
}

function buildCollectible(
  input: GameplayComponentInput,
  project: Pick<Project, 'assets' | 'fragments'>,
  ids: Set<string>,
  hotspotUids: Set<string>,
): GameplayComponentPatch {
  const itemId = uniqueSlug(input.label, ids);
  const item: InventoryItem = {
    id: itemId,
    label: input.label.trim(),
    assetName: defaultAsset(project, input.assetName),
    stateKey: `variables.has_${itemId}`,
    stateKind: 'variable',
  };

  const hotspotUid = uniqueHotspotUid(itemId, hotspotUids);
  const hotspotBase: SceneHotspot = {
    ...defaultHotspot(input.label.trim(), hotspotUid),
    action: '',
    conditions: [],
    interactionKind: 'collect',
    itemId: item.id,
    repeatMode: 'one-shot',
  };
  const hotspot = { ...hotspotBase, ...applyHotspotInteractionAuthoring(hotspotBase, [item]) };

  const patch: GameplayComponentPatch = {
    inventory: [item],
    hotspots: [hotspot],
  };

  if (input.includeObjective !== false) {
    const objectiveId = uniqueSlug(`collect_${itemId}`, ids);
    patch.objectives = [{
      id: objectiveId,
      title: `Collect ${item.label}`,
      presentation: 'active',
      completeWhen: inventoryItemOwnedCondition(item),
    }];
  }

  return patch;
}

function buildPuzzleSwitch(
  input: GameplayComponentInput,
  ids: Set<string>,
  hotspotUids: Set<string>,
): GameplayComponentPatch {
  const switchId = uniqueSlug(input.label, ids);
  const onKey = `memory.${switchId}_on`;
  const pressesKey = `variables.${switchId}_presses`;

  const pressesVar: GameplayVariable = {
    id: `${switchId}_presses`,
    key: `${switchId}_presses`,
    label: `${input.label.trim()} presses`,
    kind: 'counter',
    initialValue: 0,
  };

  const switchFlag: WorldStateFlag = {
    id: switchId,
    label: input.label.trim(),
    category: 'custom',
    stateKey: onKey,
    stateKind: 'memory',
    initialValue: false,
  };

  const offUid = uniqueHotspotUid(`${switchId}_off`, hotspotUids);
  const onUid = uniqueHotspotUid(`${switchId}_on`, hotspotUids);

  const offHotspot: SceneHotspot = {
    ...defaultHotspot(`${input.label.trim()} (off)`, offUid, 0.48),
    action: `${onKey} = true; ${pressesKey} += 1`,
    conditions: [`${onKey} != true`],
    interactionKind: 'trigger',
    repeatMode: 'repeatable',
  };

  const onHotspot: SceneHotspot = {
    ...defaultHotspot(`${input.label.trim()} (on)`, onUid, 0.48),
    action: `${onKey} = false; ${pressesKey} += 1`,
    conditions: [`${onKey} == true`],
    interactionKind: 'trigger',
    repeatMode: 'repeatable',
  };

  const patch: GameplayComponentPatch = {
    gameplayVariables: [pressesVar],
    worldState: [switchFlag],
    hotspots: [offHotspot, onHotspot],
    suggestedConditions: [`${onKey} == true`, `${onKey} != true`],
  };

  if (input.includeObjective !== false) {
    const objectiveId = uniqueSlug(`activate_${switchId}`, ids);
    patch.objectives = [{
      id: objectiveId,
      title: `Activate ${input.label.trim()}`,
      presentation: 'active',
      completeWhen: `${pressesKey} >= 1`,
    }];
  }

  return patch;
}

function buildCheckpoint(
  input: GameplayComponentInput,
  ids: Set<string>,
  hotspotUids: Set<string>,
): GameplayComponentPatch {
  const checkpointId = uniqueSlug(input.label, ids);
  const reachedKey = `memory.${checkpointId}_reached`;
  const hint = input.secondaryLabel?.trim() || 'You reach a safe resting point. Progress can be saved here.';

  const hotspotUid = uniqueHotspotUid(checkpointId, hotspotUids);
  const hotspot: SceneHotspot = {
    ...defaultHotspot(input.label.trim(), hotspotUid, 0.62),
    action: `${reachedKey} = true`,
    conditions: [`${reachedKey} != true`],
    interactionKind: 'inspect',
    inspectText: hint,
    repeatMode: 'one-shot',
  };

  const patch: GameplayComponentPatch = {
    hotspots: [hotspot],
    suggestedEffects: [`${reachedKey} = true`],
  };

  if (input.includeObjective !== false) {
    const objectiveId = uniqueSlug(`reach_${checkpointId}`, ids);
    patch.objectives = [{
      id: objectiveId,
      title: `Reach ${input.label.trim()}`,
      presentation: 'active',
      completeWhen: `${reachedKey} == true`,
    }];
  }

  return patch;
}

function describePatch(patch: GameplayComponentPatch): GameplayComponentPreviewLine[] {
  const lines: GameplayComponentPreviewLine[] = [];
  for (const item of patch.inventory ?? []) {
    lines.push({ category: 'Inventory', summary: `${item.label} → ${item.stateKey}` });
  }
  for (const flag of patch.worldState ?? []) {
    lines.push({ category: 'World flag', summary: `${flag.label} → ${flag.stateKey}` });
  }
  for (const variable of patch.gameplayVariables ?? []) {
    lines.push({ category: 'Variable', summary: `${variable.label} → variables.${variable.key}` });
  }
  for (const profile of patch.npcProfiles ?? []) {
    lines.push({ category: 'NPC profile', summary: `${profile.label} (${profile.metFlag})` });
  }
  for (const actor of patch.stageActors ?? []) {
    lines.push({ category: 'Stage actor', summary: actor.label ?? actor.uid });
  }
  for (const hotspot of patch.hotspots ?? []) {
    lines.push({ category: 'Hotspot', summary: `${hotspot.label} — ${hotspot.action || hotspot.interactionKind || 'trigger'}` });
  }
  for (const objective of patch.objectives ?? []) {
    lines.push({ category: 'Objective', summary: objective.title });
  }
  for (const condition of patch.suggestedConditions ?? []) {
    lines.push({ category: 'Suggested condition', summary: condition });
  }
  for (const effect of patch.suggestedEffects ?? []) {
    lines.push({ category: 'Suggested effect', summary: effect });
  }
  return lines;
}

export function getGameplayComponent(id: string): GameplayComponentDefinition | undefined {
  return BUILTIN_GAMEPLAY_COMPONENTS.find(c => c.id === id);
}

export function searchGameplayComponents(
  query: string,
  category?: GameplayComponentCategory | 'all',
): GameplayComponentDefinition[] {
  const q = query.trim().toLowerCase();
  return BUILTIN_GAMEPLAY_COMPONENTS.filter(component => {
    if (category && category !== 'all' && component.category !== category) return false;
    if (!q) return true;
    return (
      component.name.toLowerCase().includes(q)
      || component.description.toLowerCase().includes(q)
      || component.category.includes(q)
    );
  });
}

/** Instantiate a component into editable catalog + scene patches. */
export function buildGameplayComponent(
  input: GameplayComponentInput,
  project: Pick<Project, 'inventory' | 'objectives' | 'worldState' | 'npcProfiles' | 'gameplayVariables' | 'assets' | 'fragments'>,
  options: GameplayComponentBuildOptions = {},
): GameplayComponentResult {
  const component = getGameplayComponent(input.componentId);
  if (!component) {
    throw new Error(`Unknown gameplay component: ${input.componentId}`);
  }
  const label = input.label?.trim();
  if (!label) {
    throw new Error('Component label is required');
  }

  const ids = collectCatalogIds(project);
  const hotspotUids = collectHotspotUids(project);
  const createActorUid = options.createActorUid ?? createId;

  let patch: GameplayComponentPatch;
  switch (component.id) {
    case 'treasure-chest':
      patch = buildTreasureChest(input, project, ids, hotspotUids);
      break;
    case 'door':
      patch = buildDoor(input, project, ids, hotspotUids);
      break;
    case 'npc':
      patch = buildNpc(input, project, ids, hotspotUids, createActorUid);
      break;
    case 'collectible':
      patch = buildCollectible(input, project, ids, hotspotUids);
      break;
    case 'puzzle-switch':
      patch = buildPuzzleSwitch(input, ids, hotspotUids);
      break;
    case 'checkpoint':
      patch = buildCheckpoint(input, ids, hotspotUids);
      break;
    default:
      throw new Error(`Unhandled component: ${component.id}`);
  }

  return {
    component,
    preview: describePatch(patch),
    patch,
  };
}

export function mergeGameplayComponentPatch(
  project: Project,
  patch: GameplayComponentPatch,
): Pick<Project, 'inventory' | 'objectives' | 'worldState' | 'npcProfiles' | 'gameplayVariables' | 'initialVariables' | 'initialMemory'> {
  const merged: Project = {
    ...project,
    inventory: [...(project.inventory ?? []), ...(patch.inventory ?? [])],
    objectives: [...(project.objectives ?? []), ...(patch.objectives ?? [])],
    worldState: [...(project.worldState ?? []), ...(patch.worldState ?? [])],
    npcProfiles: [...(project.npcProfiles ?? []), ...(patch.npcProfiles ?? [])],
    gameplayVariables: [...(project.gameplayVariables ?? []), ...(patch.gameplayVariables ?? [])],
  };
  const synced = syncGameplayCatalogsToInitialState(merged);
  return {
    inventory: merged.inventory,
    objectives: merged.objectives,
    worldState: merged.worldState,
    npcProfiles: merged.npcProfiles,
    gameplayVariables: merged.gameplayVariables,
    initialVariables: synced.initialVariables,
    initialMemory: synced.initialMemory,
  };
}

export function applyGameplayComponentToFragment(fragment: Fragment, patch: GameplayComponentPatch): Fragment {
  const next: Fragment = { ...fragment };
  if (patch.hotspots?.length) {
    next.hotspots = [...(fragment.hotspots ?? []), ...patch.hotspots];
  }
  if (patch.stageActors?.length) {
    next.stageActors = [...(fragment.stageActors ?? []), ...patch.stageActors];
  }
  return next;
}

export function validateGameplayComponentResult(
  project: Project,
  result: GameplayComponentResult,
): { ok: true } | { ok: false; issues: string[] } {
  const merged = mergeGameplayComponentPatch(project, result.patch);
  const issues = validateGameplayCatalogs({ ...project, ...merged });
  if (issues.length) {
    return { ok: false, issues: issues.map(i => `${i.catalog}/${i.id}: ${i.message}`) };
  }
  return { ok: true };
}

/** For tests — generated patch remains editable catalog data, not a runtime object. */
export function isEditableComponentPatch(patch: GameplayComponentPatch): boolean {
  return Boolean(
    patch.inventory?.length
    || patch.objectives?.length
    || patch.worldState?.length
    || patch.npcProfiles?.length
    || patch.gameplayVariables?.length
    || patch.hotspots?.length
    || patch.stageActors?.length,
  );
}
