import { DEFAULT_ENTRY_POINT } from './adventure';
import {
  collectHotspotUids,
  collectInteractableUids,
  slugifyAuthoringLabel,
  uniqueHotspotUid,
  uniqueInteractableUid,
} from './authoring-ids';
import {
  classifyProjectAsset,
  needsClassificationAttention,
  type AssetIntakeClassification,
  type AssetIntakeRecipe,
} from './asset-intake';
import {
  applyGameplayTemplateToFragment,
  buildGameplayTemplate,
  mergeGameplayTemplateCatalogs,
  type GameplayTemplateCatalogPatch,
  type GameplayTemplateFragmentPatch,
} from './gameplay-templates';
import { createId } from './identity';
import { insertStageObjectFromAsset } from './stage-placement';
import { findExistingRecipeObjects } from './recipe-contracts';
import type {
  AdventureInteractable,
  Fragment,
  Project,
  ProjectAsset,
  SceneAdventure,
} from './types';

export interface AssetRecipePlanLine {
  category: string;
  summary: string;
}

export type AssetRecipeConflictKind =
  | 'overwrite-background-image'
  | 'overwrite-background-audio'
  | 'overwrite-adventure-sfx'
  | 'missing-adventure'
  | 'duplicate-recipe-object';

export interface AssetRecipeConflict {
  kind: AssetRecipeConflictKind;
  message: string;
  field: string;
  currentValue?: string;
}

export interface AssetRecipeProjectPatch {
  catalog: GameplayTemplateCatalogPatch;
  fragmentUid: string;
  fragment: Fragment;
}

export interface AssetRecipeApplyOptions {
  /** Target scene fragment uid — defaults to start location scene. */
  fragmentUid?: string;
  /** Allow replacing an existing background image or audio assignment. */
  confirmOverwrite?: boolean;
  /** Required when classification is low-confidence or unknown. */
  confirmLowConfidence?: boolean;
  /** Override readable label derived from the asset filename. */
  labelOverride?: string;
  createUid?: () => string;
  createActorUid?: () => string;
}

export interface AssetRecipePlan {
  ok: boolean;
  error?: string;
  recipe: AssetIntakeRecipe;
  asset: ProjectAsset;
  classification: AssetIntakeClassification;
  targetFragmentUid: string;
  targetFragmentTitle: string;
  preview: AssetRecipePlanLine[];
  conflicts: AssetRecipeConflict[];
  requiresManualConfirmation: boolean;
  canApply: boolean;
  patch?: AssetRecipeProjectPatch;
}

function slugify(value: string): string {
  return slugifyAuthoringLabel(value);
}

function readableLabelFromAssetName(name: string): string {
  const basename = name.replace(/\\/g, '/').split('/').pop() ?? name;
  const stem = basename.replace(/\.[^.]+$/, '');
  return stem
    .split(/[_\-.]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function resolveTargetFragment(project: Project, fragmentUid?: string): Fragment {
  if (fragmentUid) {
    const found = project.fragments.find(fragment => fragment.uid === fragmentUid);
    if (!found) throw new Error(`Scene "${fragmentUid}" was not found`);
    return found;
  }
  const start = project.fragments.find(fragment => fragment.locationId === project.startLocation);
  if (start) return start;
  const first = project.fragments[0];
  if (!first) throw new Error('Project has no scenes — add a scene before applying recipes');
  return first;
}

function reserveInteractableUid(project: Project, fragment: Fragment, base: string): string {
  const existing = collectInteractableUids(project.fragments);
  for (const uid of fragment.adventure?.interactables?.map(item => item.uid) ?? []) {
    if (uid?.trim()) existing.add(uid.trim());
  }
  return uniqueInteractableUid(base, existing);
}

function spriteNameForAsset(asset: ProjectAsset): string | undefined {
  if (asset.type === 'image') return asset.name;
  return undefined;
}

function inferSfxSlot(asset: ProjectAsset): keyof NonNullable<SceneAdventure['sfx']> {
  const stem = slugify(readableLabelFromAssetName(asset.name));
  if (stem.includes('footstep')) return 'footstep';
  if (stem.includes('pickup')) return 'pickup';
  if (stem.includes('transition') || stem.includes('door') || stem.includes('gate')) return 'transition';
  return 'interact';
}

function mergeFragmentStageAuthoring(
  fragment: Fragment,
  asset: ProjectAsset,
  label: string,
  layer: 'background' | 'props' | 'ui-guides',
  createUid: () => string,
): Fragment {
  const { composition, object } = insertStageObjectFromAsset(fragment.stageAuthoring, asset, {
    createUid,
    label,
    layer,
    x: layer === 'background' ? 0.5 : 0.5,
    y: layer === 'background' ? 0.5 : 0.62,
  });
  return {
    ...fragment,
    stageAuthoring: composition,
  };
}

function appendAdventureInteractable(
  fragment: Fragment,
  interactable: AdventureInteractable,
): Fragment {
  const adventure: SceneAdventure = fragment.adventure ?? {
    entry: { default: DEFAULT_ENTRY_POINT },
    interactables: [],
  };
  return {
    ...fragment,
    adventure: {
      ...adventure,
      interactables: [...(adventure.interactables ?? []), interactable],
    },
  };
}

function buildPickupPatch(
  project: Project,
  asset: ProjectAsset,
  fragment: Fragment,
  label: string,
  options: AssetRecipeApplyOptions,
): { preview: AssetRecipePlanLine[]; catalog: GameplayTemplateCatalogPatch; fragmentPatch: GameplayTemplateFragmentPatch; nextFragment: Fragment } {
  const createUid = options.createUid ?? createId;
  const template = buildGameplayTemplate(
    { kind: 'collect-item', label, assetName: asset.name, includeObjective: false },
    project,
    { createActorUid: options.createActorUid ?? createId },
  );
  let nextFragment = applyGameplayTemplateToFragment(fragment, template.fragment);
  nextFragment = mergeFragmentStageAuthoring(nextFragment, asset, label, 'props', createUid);

  const preview = [...template.preview];
  if (fragment.adventure) {
    const item = template.catalog.inventory?.[0];
    const interactable: AdventureInteractable = {
      uid: reserveInteractableUid(project, nextFragment, label),
      kind: 'pickup',
      label,
      x: 0.5,
      y: 0.58,
      action: item ? `${item.stateKey} = true` : `memory.${slugify(label)}_collected = true`,
      conditions: item ? [`${item.stateKey} != true`] : [],
      sprite: spriteNameForAsset(asset),
    };
    nextFragment = appendAdventureInteractable(nextFragment, interactable);
    preview.push({ category: 'Adventure pickup', summary: `${interactable.label} at (${interactable.x}, ${interactable.y})` });
  }
  preview.push({ category: 'Stage object', summary: `Prop "${label}" linked to ${asset.name}` });

  return {
    preview,
    catalog: template.catalog,
    fragmentPatch: template.fragment ?? {},
    nextFragment,
  };
}

function buildDoorPatch(
  project: Project,
  asset: ProjectAsset,
  fragment: Fragment,
  label: string,
  options: AssetRecipeApplyOptions,
): { preview: AssetRecipePlanLine[]; catalog: GameplayTemplateCatalogPatch; nextFragment: Fragment } {
  const createUid = options.createUid ?? createId;
  const doorSlug = slugify(label);
  const preview: AssetRecipePlanLine[] = [
    { category: 'Door', summary: `${label} (unlocked by default)` },
    { category: 'Action placeholder', summary: `memory.${doorSlug}_opened = true` },
  ];

  let nextFragment = mergeFragmentStageAuthoring(fragment, asset, label, 'props', createUid);
  const hotspotUid = uniqueHotspotUid(doorSlug, collectHotspotUids(project.fragments));
  const hotspot = {
    uid: hotspotUid,
    label,
    x: 0.72,
    y: 0.58,
    width: 0.16,
    height: 0.22,
    action: `memory.${doorSlug}_opened = true`,
    conditions: [],
    interactionKind: 'trigger' as const,
    repeatMode: 'repeatable' as const,
  };
  nextFragment = {
    ...nextFragment,
    hotspots: [...(nextFragment.hotspots ?? []), hotspot],
  };
  preview.push({ category: 'Hotspot', summary: `${label} trigger region` });

  if (nextFragment.adventure) {
    const interactable: AdventureInteractable = {
      uid: reserveInteractableUid(project, nextFragment, label),
      kind: 'door',
      label,
      x: 0.78,
      y: 0.55,
      action: `memory.${doorSlug}_opened = true`,
      conditions: [],
      sprite: spriteNameForAsset(asset),
      solid: false,
    };
    nextFragment = appendAdventureInteractable(nextFragment, interactable);
    preview.push({ category: 'Adventure door', summary: `${label} (locked=false)` });
  }

  preview.push({ category: 'Stage object', summary: `Prop "${label}" linked to ${asset.name}` });
  return { preview, catalog: {}, nextFragment };
}

function buildNpcPatch(
  project: Project,
  asset: ProjectAsset,
  fragment: Fragment,
  label: string,
  options: AssetRecipeApplyOptions,
): { preview: AssetRecipePlanLine[]; catalog: GameplayTemplateCatalogPatch; nextFragment: Fragment } {
  const template = buildGameplayTemplate(
    { kind: 'talk-to-npc', label, assetName: asset.name, includeObjective: false },
    project,
    { createActorUid: options.createActorUid ?? createId },
  );
  let nextFragment = applyGameplayTemplateToFragment(fragment, template.fragment);
  const profile = template.catalog.npcProfiles?.[0];
  const preview = [...template.preview];
  preview.push({
    category: 'Dialogue hook',
    summary: profile?.metFlag
      ? `Add dialogue with condition ${profile.metFlag} == true`
      : 'Add dialogue lines after the player meets this NPC',
  });

  if (nextFragment.adventure && profile) {
    const interactable: AdventureInteractable = {
      uid: reserveInteractableUid(project, nextFragment, label),
      kind: 'npc',
      label,
      x: 0.42,
      y: 0.48,
      action: `${profile.metFlag} = true`,
      conditions: [],
      sprite: spriteNameForAsset(asset),
    };
    nextFragment = appendAdventureInteractable(nextFragment, interactable);
    preview.push({ category: 'Adventure NPC', summary: `${label} interactable` });
  }

  return { preview, catalog: template.catalog, nextFragment };
}

function buildBackgroundPatch(
  asset: ProjectAsset,
  fragment: Fragment,
  label: string,
  options: AssetRecipeApplyOptions,
): { preview: AssetRecipePlanLine[]; nextFragment: Fragment; conflicts: AssetRecipeConflict[] } {
  const conflicts: AssetRecipeConflict[] = [];
  const current = fragment.backgroundImage?.trim();
  if (current && current !== asset.name && !options.confirmOverwrite) {
    conflicts.push({
      kind: 'overwrite-background-image',
      field: 'backgroundImage',
      currentValue: current,
      message: `Scene background "${current}" will be replaced by "${asset.name}".`,
    });
  }

  const createUid = options.createUid ?? createId;
  let nextFragment: Fragment = {
    ...fragment,
    backgroundImage: asset.name,
  };
  nextFragment = mergeFragmentStageAuthoring(nextFragment, asset, label, 'background', createUid);

  const preview: AssetRecipePlanLine[] = [
    { category: 'Background', summary: `Assign ${asset.name} to scene backgroundImage` },
    { category: 'Stage object', summary: `Backdrop "${label}" on background layer` },
  ];
  return { preview, nextFragment, conflicts };
}

function buildBackgroundAudioPatch(
  asset: ProjectAsset,
  fragment: Fragment,
  recipe: Extract<AssetIntakeRecipe, 'make_ambient' | 'make_music'>,
  options: AssetRecipeApplyOptions,
): { preview: AssetRecipePlanLine[]; nextFragment: Fragment; conflicts: AssetRecipeConflict[] } {
  const conflicts: AssetRecipeConflict[] = [];
  const current = fragment.backgroundAudio?.trim();
  if (current && current !== asset.name && !options.confirmOverwrite) {
    conflicts.push({
      kind: 'overwrite-background-audio',
      field: 'backgroundAudio',
      currentValue: current,
      message: `Scene audio "${current}" will be replaced by "${asset.name}".`,
    });
  }

  const slotLabel = recipe === 'make_ambient' ? 'ambient loop' : 'music track';
  const preview: AssetRecipePlanLine[] = [
    { category: 'Scene audio', summary: `Assign ${asset.name} as ${slotLabel} (backgroundAudio)` },
  ];
  return {
    preview,
    nextFragment: { ...fragment, backgroundAudio: asset.name },
    conflicts,
  };
}

function buildSfxPatch(
  asset: ProjectAsset,
  fragment: Fragment,
  options: AssetRecipeApplyOptions,
): { preview: AssetRecipePlanLine[]; nextFragment: Fragment; conflicts: AssetRecipeConflict[] } {
  const conflicts: AssetRecipeConflict[] = [];
  if (!fragment.adventure) {
    conflicts.push({
      kind: 'missing-adventure',
      field: 'adventure.sfx',
      message: 'This scene has no adventure layer — add adventure mode before assigning SFX overrides.',
    });
    return {
      preview: [{ category: 'SFX', summary: `Cannot assign ${asset.name} without adventure.sfx` }],
      nextFragment: fragment,
      conflicts,
    };
  }

  const slot = inferSfxSlot(asset);
  const current = fragment.adventure.sfx?.[slot]?.trim();
  if (current && current !== asset.name && !options.confirmOverwrite) {
    conflicts.push({
      kind: 'overwrite-adventure-sfx',
      field: `adventure.sfx.${slot}`,
      currentValue: current,
      message: `SFX slot "${slot}" uses "${current}" and will be replaced by "${asset.name}".`,
    });
  }

  const preview: AssetRecipePlanLine[] = [
    { category: 'SFX override', summary: `Assign ${asset.name} to adventure.sfx.${slot}` },
  ];
  const nextFragment: Fragment = {
    ...fragment,
    adventure: {
      ...fragment.adventure,
      sfx: {
        ...fragment.adventure.sfx,
        [slot]: asset.name,
      },
    },
  };
  return { preview, nextFragment, conflicts };
}

function buildUiPatch(
  asset: ProjectAsset,
  fragment: Fragment,
  label: string,
  options: AssetRecipeApplyOptions,
): { preview: AssetRecipePlanLine[]; nextFragment: Fragment } {
  const createUid = options.createUid ?? createId;
  const nextFragment = mergeFragmentStageAuthoring(fragment, asset, label, 'ui-guides', createUid);
  const preview: AssetRecipePlanLine[] = [
    { category: 'UI placement', summary: `Stage object "${label}" on ui-guides layer` },
    { category: 'Note', summary: 'UI graphics are editor/stage metadata — wire menus manually if needed.' },
  ];
  return { preview, nextFragment };
}

/** Build a non-destructive change plan for applying an asset recipe. */
export function planAssetRecipeApplication(
  project: Project,
  assetId: string,
  recipe: AssetIntakeRecipe,
  options: AssetRecipeApplyOptions = {},
): AssetRecipePlan {
  if (recipe === 'none') {
    return {
      ok: false,
      error: 'Recipe "none" cannot be applied',
      recipe,
      asset: { id: assetId, name: '', type: 'data', uri: '', mimeType: '', size: 0, importedAt: '' },
      classification: {
        category: 'unknown',
        confidence: 'low',
        suggestedRecipe: 'none',
        label: 'Unknown',
      },
      targetFragmentUid: '',
      targetFragmentTitle: '',
      preview: [],
      conflicts: [],
      requiresManualConfirmation: true,
      canApply: false,
    };
  }

  const asset = project.assets.find(entry => entry.id === assetId);
  if (!asset) {
    return {
      ok: false,
      error: `Asset id "${assetId}" was not found`,
      recipe,
      asset: { id: assetId, name: '', type: 'data', uri: '', mimeType: '', size: 0, importedAt: '' },
      classification: {
        category: 'unknown',
        confidence: 'low',
        suggestedRecipe: 'none',
        label: 'Unknown',
      },
      targetFragmentUid: '',
      targetFragmentTitle: '',
      preview: [],
      conflicts: [],
      requiresManualConfirmation: true,
      canApply: false,
    };
  }

  const classification = classifyProjectAsset(asset);
  const requiresManualConfirmation = needsClassificationAttention(classification);
  let targetFragment: Fragment;
  try {
    targetFragment = resolveTargetFragment(project, options.fragmentUid);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not resolve target scene',
      recipe,
      asset,
      classification,
      targetFragmentUid: '',
      targetFragmentTitle: '',
      preview: [],
      conflicts: [],
      requiresManualConfirmation,
      canApply: false,
    };
  }

  const label = options.labelOverride?.trim() || readableLabelFromAssetName(asset.name);
  const conflicts: AssetRecipeConflict[] = [];
  const existingRecipeObjects = findExistingRecipeObjects(project, targetFragment, recipe, asset, label);
  for (const message of existingRecipeObjects.messages) {
    conflicts.push({
      kind: 'duplicate-recipe-object',
      field: 'recipe',
      message,
    });
  }
  let preview: AssetRecipePlanLine[] = [];
  let catalog: GameplayTemplateCatalogPatch = {};
  let nextFragment = targetFragment;

  switch (recipe) {
    case 'make_pickup': {
      const built = buildPickupPatch(project, asset, targetFragment, label, options);
      preview = built.preview;
      catalog = built.catalog;
      nextFragment = built.nextFragment;
      break;
    }
    case 'make_door': {
      const built = buildDoorPatch(project, asset, targetFragment, label, options);
      preview = built.preview;
      catalog = built.catalog;
      nextFragment = built.nextFragment;
      break;
    }
    case 'make_npc': {
      const built = buildNpcPatch(project, asset, targetFragment, label, options);
      preview = built.preview;
      catalog = built.catalog;
      nextFragment = built.nextFragment;
      break;
    }
    case 'make_background': {
      const built = buildBackgroundPatch(asset, targetFragment, label, options);
      preview = built.preview;
      conflicts.push(...built.conflicts);
      nextFragment = built.nextFragment;
      break;
    }
    case 'make_ambient':
    case 'make_music': {
      const built = buildBackgroundAudioPatch(asset, targetFragment, recipe, options);
      preview = built.preview;
      conflicts.push(...built.conflicts);
      nextFragment = built.nextFragment;
      break;
    }
    case 'make_sfx': {
      const built = buildSfxPatch(asset, targetFragment, options);
      preview = built.preview;
      conflicts.push(...built.conflicts);
      nextFragment = built.nextFragment;
      break;
    }
    case 'make_ui': {
      const built = buildUiPatch(asset, targetFragment, label, options);
      preview = built.preview;
      nextFragment = built.nextFragment;
      break;
    }
    default: {
      const _exhaustive: never = recipe;
      return {
        ok: false,
        error: `Unsupported recipe: ${_exhaustive}`,
        recipe,
        asset,
        classification,
        targetFragmentUid: targetFragment.uid,
        targetFragmentTitle: targetFragment.title,
        preview: [],
        conflicts: [],
        requiresManualConfirmation,
        canApply: false,
      };
    }
  }

  const hasBlockingConflicts =
    conflicts.some(conflict => conflict.kind === 'missing-adventure') ||
    conflicts.length > 0;
  const needsConfidence = requiresManualConfirmation && !options.confirmLowConfidence;
  const canApply = !hasBlockingConflicts && !needsConfidence;

  return {
    ok: true,
    recipe,
    asset,
    classification,
    targetFragmentUid: targetFragment.uid,
    targetFragmentTitle: targetFragment.title,
    preview,
    conflicts,
    requiresManualConfirmation,
    canApply,
    patch: canApply
      ? { catalog, fragmentUid: targetFragment.uid, fragment: nextFragment }
      : undefined,
  };
}

export interface AssetRecipeApplyResult {
  project: Project;
  plan: AssetRecipePlan;
}

/** Apply a recipe plan to a project copy. Throws when confirmation or overwrite is required. */
export function applyAssetRecipe(
  project: Project,
  assetId: string,
  recipe: AssetIntakeRecipe,
  options: AssetRecipeApplyOptions = {},
): AssetRecipeApplyResult {
  const plan = planAssetRecipeApplication(project, assetId, recipe, options);
  if (!plan.ok) {
    throw new Error(plan.error ?? 'Could not plan asset recipe');
  }
  if (!plan.canApply || !plan.patch) {
    if (plan.requiresManualConfirmation && !options.confirmLowConfidence) {
      throw new Error('Manual confirmation required for low-confidence or unknown asset classification');
    }
    if (plan.conflicts.some(conflict => conflict.kind === 'missing-adventure')) {
      throw new Error(plan.conflicts.find(conflict => conflict.kind === 'missing-adventure')?.message);
    }
    throw new Error('Overwrite confirmation required before applying this recipe');
  }

  const mergedCatalog = mergeGameplayTemplateCatalogs(project, plan.patch.catalog);
  const nextProject: Project = {
    ...project,
    ...mergedCatalog,
    fragments: project.fragments.map(fragment =>
      fragment.uid === plan.patch!.fragmentUid ? plan.patch!.fragment : fragment,
    ),
  };

  return { project: nextProject, plan };
}

export function readableAssetLabel(asset: Pick<ProjectAsset, 'name'>): string {
  return readableLabelFromAssetName(asset.name);
}
