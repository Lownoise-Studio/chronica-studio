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

export type GameplayTemplateKind =
  | 'collect-item'
  | 'locked-door'
  | 'find-clue'
  | 'talk-to-npc'
  | 'simple-quest';

export interface GameplayTemplateDefinition {
  kind: GameplayTemplateKind;
  title: string;
  description: string;
}

export const GAMEPLAY_TEMPLATE_DEFINITIONS: GameplayTemplateDefinition[] = [
  {
    kind: 'collect-item',
    title: 'Collect Item',
    description: 'Inventory item, collect hotspot, pickup feedback, optional objective.',
  },
  {
    kind: 'locked-door',
    title: 'Locked Door',
    description: 'Key item, door flag, use-item hotspot, unlock action, optional objective.',
  },
  {
    kind: 'find-clue',
    title: 'Find Clue',
    description: 'Inspect hotspot, clue state, objective update, optional NPC dialogue condition.',
  },
  {
    kind: 'talk-to-npc',
    title: 'Talk to NPC',
    description: 'NPC profile, stage actor, met flag, dialogue condition helpers.',
  },
  {
    kind: 'simple-quest',
    title: 'Simple Quest',
    description: 'Objective, required item/clue condition, completion state key.',
  },
];

export interface GameplayTemplateInput {
  kind: GameplayTemplateKind;
  /** Primary label — item name, door name, NPC name, quest title, etc. */
  label: string;
  /** Secondary label — key name for locked door, inspect copy for clues. */
  secondaryLabel?: string;
  assetName?: string;
  includeObjective?: boolean;
  /** Find clue: store as memory flag instead of inventory item. */
  useMemoryFlag?: boolean;
  /** Find clue: suggest dialogue condition after an NPC is met. */
  npcMetProfileId?: string;
}

export interface GameplayTemplatePreviewLine {
  category: string;
  summary: string;
}

export interface GameplayTemplateCatalogPatch {
  inventory?: InventoryItem[];
  objectives?: GameObjective[];
  worldState?: WorldStateFlag[];
  npcProfiles?: NpcStateProfile[];
  gameplayVariables?: GameplayVariable[];
}

export interface GameplayTemplateFragmentPatch {
  hotspot?: SceneHotspot;
  stageActor?: StageActor;
  suggestedConditions?: string[];
  suggestedEffects?: string[];
}

export interface GameplayTemplateResult {
  kind: GameplayTemplateKind;
  preview: GameplayTemplatePreviewLine[];
  catalog: GameplayTemplateCatalogPatch;
  fragment?: GameplayTemplateFragmentPatch;
}

export interface GameplayTemplateBuildOptions {
  createActorUid?: () => string;
}

function resolveActorUid(options: GameplayTemplateBuildOptions): () => string {
  return options.createActorUid ?? createId;
}

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

function collectHotspotUids(project: Pick<Project, 'fragments'>): Set<string> {
  const ids = new Set<string>();
  for (const fragment of project.fragments ?? []) {
    for (const hotspot of fragment.hotspots ?? []) {
      ids.add(hotspot.uid);
    }
  }
  return ids;
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

function defaultHotspot(label: string, uid: string): Omit<SceneHotspot, 'action' | 'conditions'> {
  return {
    uid,
    label,
    x: 0.5,
    y: 0.55,
    width: 0.18,
    height: 0.2,
  } as SceneHotspot;
}

function buildCollectItemTemplate(
  input: GameplayTemplateInput,
  project: Pick<Project, 'inventory' | 'objectives' | 'worldState' | 'npcProfiles' | 'gameplayVariables' | 'assets' | 'fragments'>,
  ids: Set<string>,
  hotspotUids: Set<string>,
): GameplayTemplateResult {
  const itemId = uniqueSlug(input.label, ids);
  const assetName = input.assetName?.trim()
    || project.assets?.find(a => a.type === 'image')?.name
    || '';
  const item: InventoryItem = {
    id: itemId,
    label: input.label.trim(),
    assetName,
    stateKey: `variables.has_${itemId}`,
    stateKind: 'variable',
  };

  const hotspotUid = uniqueHotspotUid(itemId, hotspotUids);
  const hotspotBase: SceneHotspot = {
    ...defaultHotspot(input.secondaryLabel?.trim() || input.label.trim(), hotspotUid),
    action: '',
    conditions: [],
    interactionKind: 'collect',
    itemId: item.id,
    repeatMode: 'one-shot',
  };
  const hotspot = { ...hotspotBase, ...applyHotspotInteractionAuthoring(hotspotBase, [item]) };

  const preview: GameplayTemplatePreviewLine[] = [
    { category: 'Inventory', summary: `${item.label} → ${item.stateKey}` },
    { category: 'Hotspot', summary: `Collect "${hotspot.label}" (${hotspot.action})` },
    { category: 'Feedback', summary: `Picked up ${item.label}` },
  ];

  const catalog: GameplayTemplateCatalogPatch = { inventory: [item] };
  if (input.includeObjective !== false) {
    const objectiveId = uniqueSlug(`collect_${itemId}`, ids);
    const objective: GameObjective = {
      id: objectiveId,
      title: `Collect ${item.label}`,
      presentation: 'active',
      completeWhen: inventoryItemOwnedCondition(item),
    };
    catalog.objectives = [objective];
    preview.push({ category: 'Objective', summary: objective.title });
  }

  return { kind: 'collect-item', preview, catalog, fragment: { hotspot } };
}

function buildLockedDoorTemplate(
  input: GameplayTemplateInput,
  project: Pick<Project, 'inventory' | 'objectives' | 'worldState' | 'npcProfiles' | 'gameplayVariables' | 'assets' | 'fragments'>,
  ids: Set<string>,
  hotspotUids: Set<string>,
): GameplayTemplateResult {
  const doorId = uniqueSlug(input.label, ids);
  const keyLabel = input.secondaryLabel?.trim() || 'Key';
  const keyId = uniqueSlug(keyLabel, ids);
  const keyAsset = input.assetName?.trim()
    || project.assets?.find(a => a.type === 'image')?.name
    || '';

  const keyItem: InventoryItem = {
    id: keyId,
    label: keyLabel,
    assetName: keyAsset,
    stateKey: `variables.has_${keyId}`,
    stateKind: 'variable',
  };

  const doorFlag: WorldStateFlag = {
    id: doorId,
    label: input.label.trim(),
    category: 'door',
    stateKey: `memory.${doorId}_unlocked`,
    stateKind: 'memory',
    initialValue: false,
  };

  const hotspotUid = uniqueHotspotUid(doorId, hotspotUids);
  const hotspotBase: SceneHotspot = {
    ...defaultHotspot(input.label.trim(), hotspotUid),
    action: `${doorFlag.stateKey} = true`,
    conditions: [`${doorFlag.stateKey} != true`],
    interactionKind: 'use-item',
    requiredItemId: keyItem.id,
    repeatMode: 'one-shot',
  };
  const hotspot = { ...hotspotBase, ...applyHotspotInteractionAuthoring(hotspotBase, [keyItem]) };

  const preview: GameplayTemplatePreviewLine[] = [
    { category: 'World flag', summary: `${doorFlag.label} → ${doorFlag.stateKey}` },
    { category: 'Inventory', summary: `${keyItem.label} → ${keyItem.stateKey}` },
    { category: 'Hotspot', summary: `Use ${keyItem.label} on "${hotspot.label}"` },
    { category: 'Feedback', summary: `${doorFlag.label} unlocked` },
  ];

  const catalog: GameplayTemplateCatalogPatch = {
    inventory: [keyItem],
    worldState: [doorFlag],
  };
  if (input.includeObjective !== false) {
    const objectiveId = uniqueSlug(`unlock_${doorId}`, ids);
    const objective: GameObjective = {
      id: objectiveId,
      title: `Unlock ${doorFlag.label}`,
      presentation: 'active',
      completeWhen: `${doorFlag.stateKey} == true`,
    };
    catalog.objectives = [objective];
    preview.push({ category: 'Objective', summary: objective.title });
  }

  return { kind: 'locked-door', preview, catalog, fragment: { hotspot } };
}

function buildFindClueTemplate(
  input: GameplayTemplateInput,
  project: Pick<Project, 'inventory' | 'objectives' | 'worldState' | 'npcProfiles' | 'gameplayVariables' | 'fragments'>,
  ids: Set<string>,
  hotspotUids: Set<string>,
): GameplayTemplateResult {
  const clueId = uniqueSlug(input.label, ids);
  const inspectText = input.secondaryLabel?.trim() || `You examine the ${input.label.trim().toLowerCase()}.`;
  const useMemory = input.useMemoryFlag !== false;
  const stateKey = useMemory ? `memory.${clueId}_found` : `variables.has_${clueId}`;

  const catalog: GameplayTemplateCatalogPatch = {};
  const preview: GameplayTemplatePreviewLine[] = [
    { category: 'Clue state', summary: `${input.label} → ${stateKey}` },
    { category: 'Hotspot', summary: `Inspect "${input.label}"` },
    { category: 'Inspect text', summary: inspectText },
  ];

  let inventory: InventoryItem[] | undefined;
  if (!useMemory) {
    const item: InventoryItem = {
      id: clueId,
      label: input.label.trim(),
      assetName: input.assetName?.trim() || '',
      stateKey,
      stateKind: 'variable',
    };
    catalog.inventory = [item];
    inventory = [item];
    preview.unshift({ category: 'Inventory', summary: `${item.label} → ${item.stateKey}` });
  }

  const hotspotUid = uniqueHotspotUid(clueId, hotspotUids);
  const collectAction = useMemory
    ? `${stateKey} = true`
    : inventoryItemCollectEffect(catalog.inventory![0]);
  const hotspotBase: SceneHotspot = {
    ...defaultHotspot(input.label.trim(), hotspotUid),
    action: collectAction,
    conditions: [`${stateKey} != true`],
    interactionKind: 'inspect',
    inspectText,
    repeatMode: 'one-shot',
  };
  const hotspot = inventory
    ? { ...hotspotBase, ...applyHotspotInteractionAuthoring({ ...hotspotBase, interactionKind: 'collect', itemId: clueId }, inventory) }
    : { ...hotspotBase, ...applyHotspotInteractionAuthoring(hotspotBase, []) };

  const fragment: GameplayTemplateFragmentPatch = { hotspot };
  if (input.includeObjective !== false) {
    const objectiveId = uniqueSlug(`clue_${clueId}`, ids);
    const objective: GameObjective = {
      id: objectiveId,
      title: `Find ${input.label.trim()}`,
      presentation: 'active',
      completeWhen: `${stateKey} == true`,
    };
    catalog.objectives = [objective];
    preview.push({ category: 'Objective', summary: objective.title });
  }

  if (input.npcMetProfileId) {
    const profile = (project.npcProfiles ?? []).find(p => p.id === input.npcMetProfileId);
    const met = profile ? npcMetCondition(profile) : undefined;
    if (met) {
      fragment.suggestedConditions = [met];
      preview.push({ category: 'Dialogue condition', summary: met });
    }
  }

  return { kind: 'find-clue', preview, catalog, fragment };
}

function buildTalkToNpcTemplate(
  input: GameplayTemplateInput,
  project: Pick<Project, 'inventory' | 'objectives' | 'worldState' | 'npcProfiles' | 'gameplayVariables' | 'assets' | 'fragments'>,
  ids: Set<string>,
  hotspotUids: Set<string>,
  createActorUid: () => string,
): GameplayTemplateResult {
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
    asset: input.assetName?.trim()
      || project.assets?.find(a => a.type === 'image')?.name
      || '',
    x: 0.5,
    y: 0.82,
    width: 0.28,
    stateVariable: profile.stateVariable,
    gameplayState: profile.defaultState,
  };

  const metCondition = npcMetCondition(profile)!;
  const hotspotUid = uniqueHotspotUid(`talk_${npcId}`, hotspotUids);
  const hotspot: SceneHotspot = {
    ...defaultHotspot(`Talk to ${profile.label}`, hotspotUid),
    action: `${profile.metFlag} = true`,
    conditions: [`${profile.metFlag} != true`],
    interactionKind: 'trigger',
    repeatMode: 'one-shot',
  };

  const preview: GameplayTemplatePreviewLine[] = [
    { category: 'NPC profile', summary: `${profile.label} (${profile.stateVariable})` },
    { category: 'Stage actor', summary: profile.label },
    { category: 'Met flag', summary: profile.metFlag! },
    { category: 'Hotspot', summary: hotspot.label },
    { category: 'Dialogue condition', summary: metCondition },
  ];

  const catalog: GameplayTemplateCatalogPatch = { npcProfiles: [profile] };
  if (input.includeObjective !== false) {
    const objectiveId = uniqueSlug(`meet_${npcId}`, ids);
    const objective: GameObjective = {
      id: objectiveId,
      title: `Talk to ${profile.label}`,
      presentation: 'active',
      completeWhen: metCondition,
    };
    catalog.objectives = [objective];
    preview.push({ category: 'Objective', summary: objective.title });
  }

  return {
    kind: 'talk-to-npc',
    preview,
    catalog,
    fragment: {
      hotspot,
      stageActor,
      suggestedConditions: [metCondition],
    },
  };
}

function buildSimpleQuestTemplate(
  input: GameplayTemplateInput,
  project: Pick<Project, 'inventory' | 'objectives' | 'worldState' | 'npcProfiles' | 'gameplayVariables' | 'assets'>,
  ids: Set<string>,
): GameplayTemplateResult {
  const questId = uniqueSlug(input.label, ids);
  const requirementLabel = input.secondaryLabel?.trim() || 'Quest item';
  const reqId = uniqueSlug(requirementLabel, ids);
  const completedKey = `memory.${questId}_completed`;

  const requirementItem: InventoryItem = {
    id: reqId,
    label: requirementLabel,
    assetName: input.assetName?.trim()
      || project.assets?.find(a => a.type === 'image')?.name
      || '',
    stateKey: `variables.has_${reqId}`,
    stateKind: 'variable',
  };

  const completeWhen = inventoryItemOwnedCondition(requirementItem);
  const objective: GameObjective = {
    id: questId,
    title: input.label.trim(),
    presentation: 'active',
    completeWhen,
  };

  const preview: GameplayTemplatePreviewLine[] = [
    { category: 'Objective', summary: `${objective.title} (${completeWhen})` },
    { category: 'Requirement', summary: `${requirementItem.label} → ${requirementItem.stateKey}` },
    { category: 'Completion key', summary: completedKey },
    { category: 'Completion action', summary: `${completedKey} = true` },
  ];

  return {
    kind: 'simple-quest',
    preview,
    catalog: {
      inventory: [requirementItem],
      objectives: [objective],
    },
    fragment: {
      suggestedEffects: [`${completedKey} = true`],
      suggestedConditions: [completeWhen],
    },
  };
}

/** Build catalog + optional scene patches without mutating the project. */
export function buildGameplayTemplate(
  input: GameplayTemplateInput,
  project: Pick<Project, 'inventory' | 'objectives' | 'worldState' | 'npcProfiles' | 'gameplayVariables' | 'assets' | 'fragments'>,
  options: GameplayTemplateBuildOptions = {},
): GameplayTemplateResult {
  const label = input.label?.trim();
  if (!label) {
    throw new Error('Template label is required');
  }

  const ids = collectCatalogIds(project);
  const hotspotUids = collectHotspotUids(project);
  const createActorUid = resolveActorUid(options);

  switch (input.kind) {
    case 'collect-item':
      return buildCollectItemTemplate({ ...input, label }, project, ids, hotspotUids);
    case 'locked-door':
      return buildLockedDoorTemplate({ ...input, label }, project, ids, hotspotUids);
    case 'find-clue':
      return buildFindClueTemplate({ ...input, label }, project, ids, hotspotUids);
    case 'talk-to-npc':
      return buildTalkToNpcTemplate({ ...input, label }, project, ids, hotspotUids, createActorUid);
    case 'simple-quest':
      return buildSimpleQuestTemplate({ ...input, label }, project, ids);
    default: {
      const _exhaustive: never = input.kind;
      throw new Error(`Unknown template kind: ${_exhaustive}`);
    }
  }
}

export function mergeGameplayTemplateCatalogs(
  project: Project,
  patch: GameplayTemplateCatalogPatch,
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

export function applyGameplayTemplateToFragment(
  fragment: Fragment,
  patch: GameplayTemplateFragmentPatch | undefined,
): Fragment {
  if (!patch) return fragment;
  const next: Fragment = { ...fragment };
  if (patch.hotspot) {
    next.hotspots = [...(fragment.hotspots ?? []), patch.hotspot];
  }
  if (patch.stageActor) {
    next.stageActors = [...(fragment.stageActors ?? []), patch.stageActor];
  }
  return next;
}

/** Validate generated template output for editor-time checks. */
export function validateGameplayTemplateResult(
  project: Project,
  result: GameplayTemplateResult,
): { ok: true } | { ok: false; issues: string[] } {
  const merged = mergeGameplayTemplateCatalogs(project, result.catalog);
  const issues = validateGameplayCatalogs({ ...project, ...merged });
  if (issues.length) {
    return { ok: false, issues: issues.map(i => `${i.catalog}/${i.id}: ${i.message}`) };
  }
  return { ok: true };
}
