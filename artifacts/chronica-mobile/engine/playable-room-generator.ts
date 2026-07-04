import {
  DEFAULT_ADVENTURE_ASPECT,
  DEFAULT_ADVENTURE_SPEED,
} from './adventure';
import {
  classifyProjectAsset,
  type AssetIntakeCategory,
  type AssetIntakeClassification,
} from './asset-intake';
import { readableAssetLabel } from './asset-recipes';
import {
  buildGameplayTemplate,
  mergeGameplayTemplateCatalogs,
  type GameplayTemplateCatalogPatch,
} from './gameplay-templates';
import {
  collectInteractableUids,
  deterministicRoomInteractableUid,
  reserveDeterministicUid,
  slugifyAuthoringLabel,
} from './authoring-ids';
import { createId } from './identity';
import { insertStageObjectFromAsset } from './stage-placement';
import type {
  AdventureCollider,
  AdventureInteractable,
  Fragment,
  Project,
  ProjectAsset,
  SceneAdventure,
  StageComposition,
} from './types';

export interface PlayableRoomGeneratorToggles {
  includeNpc: boolean;
  includePickup: boolean;
  lockedGate: boolean;
  includeAmbient: boolean;
  includeSfx: boolean;
}

export interface PlayableRoomGeneratorOptions extends Partial<PlayableRoomGeneratorToggles> {
  assetIds?: readonly string[];
  fragmentUid?: string;
  createNewScene?: boolean;
  newSceneTitle?: string;
  newSceneLocationId?: string;
  setAsStartLocation?: boolean;
  confirmOverwrite?: boolean;
  createUid?: () => string;
  createActorUid?: () => string;
}

export interface PlayableRoomAssetSelection {
  background?: ProjectAsset;
  player?: ProjectAsset;
  npc?: ProjectAsset;
  pickup?: ProjectAsset;
  door?: ProjectAsset;
  gate?: ProjectAsset;
  ambient?: ProjectAsset;
  music?: ProjectAsset;
  footstepSfx?: ProjectAsset;
  interactSfx?: ProjectAsset;
  pickupSfx?: ProjectAsset;
  transitionSfx?: ProjectAsset;
}

export interface PlayableRoomPlanLine {
  category: string;
  summary: string;
}

export type PlayableRoomConflictKind =
  | 'overwrite-adventure'
  | 'overwrite-background-image'
  | 'overwrite-background-audio';

export interface PlayableRoomConflict {
  kind: PlayableRoomConflictKind;
  message: string;
  field: string;
  currentValue?: string;
}

export interface PlayableRoomProjectPatch {
  catalog: GameplayTemplateCatalogPatch;
  fragment: Fragment;
  fragmentUid: string;
  isNewFragment: boolean;
  setAsStartLocation: boolean;
}

export interface PlayableRoomPlan {
  ok: boolean;
  error?: string;
  preview: PlayableRoomPlanLine[];
  selection: PlayableRoomAssetSelection;
  toggles: PlayableRoomGeneratorToggles;
  conflicts: PlayableRoomConflict[];
  canApply: boolean;
  targetFragmentUid: string;
  targetFragmentTitle: string;
  targetLocationId: string;
  createNewScene: boolean;
  patch?: PlayableRoomProjectPatch;
}

export interface PlayableRoomApplyResult {
  project: Project;
  plan: PlayableRoomPlan;
}

const DEFAULT_TOGGLES: PlayableRoomGeneratorToggles = {
  includeNpc: true,
  includePickup: true,
  lockedGate: true,
  includeAmbient: true,
  includeSfx: true,
};

const CONFIDENCE_RANK = { high: 3, medium: 2, low: 1 } as const;

function slugify(value: string): string {
  return slugifyAuthoringLabel(value) || 'room';
}

function resolveToggles(options: PlayableRoomGeneratorOptions): PlayableRoomGeneratorToggles {
  return {
    includeNpc: options.includeNpc ?? DEFAULT_TOGGLES.includeNpc,
    includePickup: options.includePickup ?? DEFAULT_TOGGLES.includePickup,
    lockedGate: options.lockedGate ?? DEFAULT_TOGGLES.lockedGate,
    includeAmbient: options.includeAmbient ?? DEFAULT_TOGGLES.includeAmbient,
    includeSfx: options.includeSfx ?? DEFAULT_TOGGLES.includeSfx,
  };
}

function assetPool(project: Project, assetIds?: readonly string[]): ProjectAsset[] {
  if (!assetIds?.length) return [...project.assets];
  const allowed = new Set(assetIds);
  return project.assets.filter(asset => allowed.has(asset.id));
}

function bestAssetForCategory(
  assets: readonly ProjectAsset[],
  category: AssetIntakeCategory,
): ProjectAsset | undefined {
  let best: { asset: ProjectAsset; classification: AssetIntakeClassification } | undefined;
  for (const asset of assets) {
    const classification = classifyProjectAsset(asset);
    if (classification.category !== category) continue;
    if (
      !best ||
      CONFIDENCE_RANK[classification.confidence] > CONFIDENCE_RANK[best.classification.confidence]
    ) {
      best = { asset, classification };
    }
  }
  return best?.asset;
}

function firstImage(assets: readonly ProjectAsset[]): ProjectAsset | undefined {
  return assets.find(asset => asset.type === 'image');
}

function firstAudio(assets: readonly ProjectAsset[]): ProjectAsset | undefined {
  return assets.find(asset => asset.type === 'audio');
}

function sfxAssetByHint(assets: readonly ProjectAsset[], hint: string): ProjectAsset | undefined {
  const classified = bestAssetForCategory(assets, 'sfx');
  if (classified && classifyProjectAsset(classified).label.toLowerCase().includes(hint)) {
    return classified;
  }
  return assets.find(asset => asset.type === 'audio' && asset.name.toLowerCase().includes(hint));
}

/** Pick the best classified assets for a playable room layout. */
export function selectPlayableRoomAssets(
  project: Project,
  options: Pick<PlayableRoomGeneratorOptions, 'assetIds'> = {},
): PlayableRoomAssetSelection {
  const pool = assetPool(project, options.assetIds);

  return {
    background: bestAssetForCategory(pool, 'background') ?? firstImage(pool),
    player: bestAssetForCategory(pool, 'player') ?? pool.find(asset => /player/i.test(asset.name)),
    npc: bestAssetForCategory(pool, 'npc') ?? bestAssetForCategory(pool, 'character'),
    pickup:
      bestAssetForCategory(pool, 'pickup')
      ?? bestAssetForCategory(pool, 'lantern')
      ?? bestAssetForCategory(pool, 'key'),
    door: bestAssetForCategory(pool, 'door'),
    gate: bestAssetForCategory(pool, 'gate') ?? bestAssetForCategory(pool, 'door'),
    ambient: bestAssetForCategory(pool, 'ambient') ?? firstAudio(pool),
    music: bestAssetForCategory(pool, 'music'),
    footstepSfx: sfxAssetByHint(pool, 'footstep'),
    interactSfx: sfxAssetByHint(pool, 'interact'),
    pickupSfx: sfxAssetByHint(pool, 'pickup'),
    transitionSfx: sfxAssetByHint(pool, 'transition') ?? sfxAssetByHint(pool, 'door'),
  };
}

function defaultColliders(roomSlug: string): AdventureCollider[] {
  return [
    { uid: `col_${roomSlug}_wall_top`, x: 0, y: 0, width: 1, height: 0.18 },
    { uid: `col_${roomSlug}_wall_left`, x: 0, y: 0.28, width: 0.1, height: 0.55 },
    { uid: `col_${roomSlug}_wall_right`, x: 0.9, y: 0.22, width: 0.1, height: 0.6 },
    { uid: `col_${roomSlug}_prop`, x: 0.42, y: 0.84, width: 0.14, height: 0.08 },
  ];
}

function spriteFor(asset: ProjectAsset | undefined): string | undefined {
  return asset?.type === 'image' ? asset.name : undefined;
}

function resolveTargetFragment(
  project: Project,
  options: PlayableRoomGeneratorOptions,
): { fragment: Fragment; createNewScene: boolean } {
  if (options.createNewScene) {
    const title = options.newSceneTitle?.trim() || 'Generated Room';
    const locationId = options.newSceneLocationId?.trim() || slugify(title);
    return {
      createNewScene: true,
      fragment: {
        uid: options.createUid?.() ?? createId(),
        title,
        locationId,
        priority: 0,
        conditions: [],
        effects: [],
        text: 'Walk with WASD or the joystick. Move close to someone or something and tap to interact.',
        choices: [],
      },
    };
  }

  if (options.fragmentUid) {
    const found = project.fragments.find(fragment => fragment.uid === options.fragmentUid);
    if (!found) throw new Error(`Scene "${options.fragmentUid}" was not found`);
    return { fragment: found, createNewScene: false };
  }

  const start = project.fragments.find(fragment => fragment.locationId === project.startLocation);
  if (start) return { fragment: start, createNewScene: false };
  const first = project.fragments[0];
  if (!first) throw new Error('Project has no scenes — create a scene or enable "Create new scene"');
  return { fragment: first, createNewScene: false };
}

function detectConflicts(
  fragment: Fragment,
  selection: PlayableRoomAssetSelection,
  toggles: PlayableRoomGeneratorToggles,
  confirmOverwrite: boolean,
): PlayableRoomConflict[] {
  if (confirmOverwrite) return [];

  const conflicts: PlayableRoomConflict[] = [];
  const adventureHasContent = (fragment.adventure?.interactables?.length ?? 0) > 0
    || (fragment.adventure?.colliders?.length ?? 0) > 0;

  if (adventureHasContent) {
    conflicts.push({
      kind: 'overwrite-adventure',
      field: 'adventure',
      message: 'This scene already has adventure data — confirm overwrite to replace it.',
    });
  }

  const nextBackground = selection.background?.name;
  if (
    nextBackground &&
    fragment.backgroundImage?.trim() &&
    fragment.backgroundImage.trim() !== nextBackground
  ) {
    conflicts.push({
      kind: 'overwrite-background-image',
      field: 'backgroundImage',
      currentValue: fragment.backgroundImage,
      message: `Background "${fragment.backgroundImage}" will be replaced by "${nextBackground}".`,
    });
  }

  const nextAudio = (toggles.includeAmbient ? selection.ambient : selection.music)?.name;
  if (
    toggles.includeAmbient &&
    nextAudio &&
    fragment.backgroundAudio?.trim() &&
    fragment.backgroundAudio.trim() !== nextAudio
  ) {
    conflicts.push({
      kind: 'overwrite-background-audio',
      field: 'backgroundAudio',
      currentValue: fragment.backgroundAudio,
      message: `Scene audio "${fragment.backgroundAudio}" will be replaced by "${nextAudio}".`,
    });
  }

  return conflicts;
}

function buildRoomCatalogAndKeys(
  project: Project,
  selection: PlayableRoomAssetSelection,
  toggles: PlayableRoomGeneratorToggles,
  roomSlug: string,
  createActorUid: () => string,
): {
  catalog: GameplayTemplateCatalogPatch;
  npcMetVar: string;
  pickupVar: string;
  pickupLabel: string;
  npcLabel: string;
} {
  const catalog: GameplayTemplateCatalogPatch = {};
  let npcMetVar = `variables.${roomSlug}_met_npc`;
  let pickupVar = `variables.${roomSlug}_has_pickup`;
  let pickupLabel = selection.pickup ? readableAssetLabel(selection.pickup) : 'Pickup item';
  let npcLabel = selection.npc ? readableAssetLabel(selection.npc) : 'Guide';

  if (toggles.includeNpc) {
    const npcTemplate = buildGameplayTemplate(
      {
        kind: 'talk-to-npc',
        label: npcLabel,
        assetName: selection.npc?.name,
        includeObjective: false,
      },
      project,
      { createActorUid },
    );
    catalog.npcProfiles = npcTemplate.catalog.npcProfiles;
    const profile = npcTemplate.catalog.npcProfiles?.[0];
    if (profile?.metFlag) npcMetVar = profile.metFlag;
    if (profile?.label) npcLabel = profile.label;
  }

  if (toggles.includePickup) {
    const pickupTemplate = buildGameplayTemplate(
      {
        kind: 'collect-item',
        label: pickupLabel,
        assetName: selection.pickup?.name ?? selection.npc?.name ?? selection.background?.name,
        includeObjective: false,
      },
      project,
    );
    catalog.inventory = pickupTemplate.catalog.inventory;
    const item = pickupTemplate.catalog.inventory?.[0];
    if (item?.stateKey) pickupVar = item.stateKey;
    if (item?.label) pickupLabel = item.label;
  }

  return { catalog, npcMetVar, pickupVar, pickupLabel, npcLabel };
}

function appendStageObjects(
  composition: StageComposition | undefined,
  entries: Array<{ asset?: ProjectAsset; label: string; layer: 'background' | 'props' }>,
  createUid: () => string,
): StageComposition | undefined {
  let next = composition;
  for (const entry of entries) {
    if (!entry.asset) continue;
    next = insertStageObjectFromAsset(next, entry.asset, {
      createUid,
      label: entry.label,
      layer: entry.layer,
      x: 0.5,
      y: entry.layer === 'background' ? 0.5 : 0.58,
    }).composition;
  }
  return next;
}

function buildGeneratedFragment(
  project: Project,
  baseFragment: Fragment,
  selection: PlayableRoomAssetSelection,
  toggles: PlayableRoomGeneratorToggles,
  options: PlayableRoomGeneratorOptions,
): { fragment: Fragment; catalog: GameplayTemplateCatalogPatch; preview: PlayableRoomPlanLine[] } {
  const createUid = options.createUid ?? createId;
  const createActorUid = options.createActorUid ?? createId;
  const roomSlug = slugify(baseFragment.locationId || baseFragment.title || 'playable_room');
  const preview: PlayableRoomPlanLine[] = [];

  const { catalog, npcMetVar, pickupVar, pickupLabel, npcLabel } = buildRoomCatalogAndKeys(
    project,
    selection,
    toggles,
    roomSlug,
    createActorUid,
  );

  const interactables: AdventureInteractable[] = [];
  const interactableUids = collectInteractableUids(project.fragments);
  const roomUid = (role: string) =>
    reserveDeterministicUid(deterministicRoomInteractableUid(roomSlug, role), interactableUids);

  if (toggles.includeNpc) {
    interactables.push({
      uid: roomUid('npc'),
      kind: 'npc',
      label: npcLabel,
      x: 0.36,
      y: 0.42,
      radius: 0.11,
      action: `${npcMetVar} = true; memory.${roomSlug}_npc_greeting = true`,
      conditions: [],
      sprite: spriteFor(selection.npc) ?? spriteFor(selection.player),
      width: 0.09,
    });
    preview.push({
      category: 'NPC',
      summary: `${npcLabel} talk interaction${selection.npc ? ` (${selection.npc.name})` : ' (placeholder sprite)'}`,
    });
  }

  if (toggles.includePickup) {
    const pickupConditions = [`${pickupVar} != true`];
    if (toggles.includeNpc) pickupConditions.push(`${npcMetVar} == true`);
    interactables.push({
      uid: roomUid('pickup'),
      kind: 'pickup',
      label: pickupLabel,
      x: 0.52,
      y: 0.55,
      radius: 0.09,
      action: `${pickupVar} = true; memory.${roomSlug}_pickup_taken = true`,
      conditions: pickupConditions,
      sprite: spriteFor(selection.pickup) ?? spriteFor(selection.npc),
      width: 0.07,
      sfx: selection.pickupSfx?.name,
    });
    preview.push({
      category: 'Pickup',
      summary: `${pickupLabel}${toggles.includeNpc ? ' (visible after talking to NPC)' : ''}`,
    });
  }

  const gateAsset = selection.gate ?? selection.door;
  const gateLabel = gateAsset ? readableAssetLabel(gateAsset) : 'Gate';

  if (toggles.lockedGate && toggles.includePickup) {
    interactables.push({
      uid: roomUid('locked_gate'),
      kind: 'door',
      label: `Locked ${gateLabel}`,
      x: 0.84,
      y: 0.52,
      radius: 0.11,
      action: `memory.${roomSlug}_gate_blocked = true`,
      conditions: [`${pickupVar} != true`],
      solid: true,
      sprite: spriteFor(gateAsset),
      width: 0.1,
    });
    interactables.push({
      uid: roomUid('open_gate'),
      kind: 'door',
      label: gateLabel,
      x: 0.84,
      y: 0.52,
      radius: 0.13,
      action: `memory.${roomSlug}_gate_opened = true`,
      conditions: [`${pickupVar} == true`],
      sprite: spriteFor(gateAsset),
      width: 0.1,
    });
    preview.push({ category: 'Gate', summary: `Locked gate requiring ${pickupLabel}` });
  } else {
    interactables.push({
      uid: roomUid('door'),
      kind: 'door',
      label: gateLabel,
      x: 0.84,
      y: 0.52,
      radius: 0.12,
      action: `memory.${roomSlug}_door_used = true`,
      conditions: [],
      sprite: spriteFor(gateAsset),
      width: 0.1,
    });
    preview.push({ category: 'Door', summary: `${gateLabel} interaction (unlocked)` });
  }

  const adventure: SceneAdventure = {
    entry: { default: { x: 0.18, y: 0.78 } },
    speed: DEFAULT_ADVENTURE_SPEED,
    aspectRatio: DEFAULT_ADVENTURE_ASPECT,
    playerSprite: spriteFor(selection.player),
    playerWidth: 0.08,
    colliders: defaultColliders(roomSlug),
    interactables,
    sfx: toggles.includeSfx
      ? {
        footstep: selection.footstepSfx?.name,
        interact: selection.interactSfx?.name,
        pickup: selection.pickupSfx?.name,
        transition: selection.transitionSfx?.name,
      }
      : undefined,
  };

  const fragment: Fragment = {
    ...baseFragment,
    text: baseFragment.text?.trim()
      ? baseFragment.text
      : 'Walk with WASD or the joystick. Move close to someone or something and tap to interact.',
    backgroundImage: selection.background?.name ?? baseFragment.backgroundImage,
    backgroundAudio: toggles.includeAmbient
      ? (selection.ambient?.name ?? selection.music?.name ?? baseFragment.backgroundAudio)
      : baseFragment.backgroundAudio,
    adventure,
    stageAuthoring: appendStageObjects(
      baseFragment.stageAuthoring,
      [
        { asset: selection.background, label: 'Background', layer: 'background' },
        { asset: selection.npc, label: npcLabel, layer: 'props' },
        { asset: selection.pickup, label: pickupLabel, layer: 'props' },
        { asset: gateAsset, label: gateLabel, layer: 'props' },
      ],
      createUid,
    ),
  };

  preview.push({
    category: 'Player spawn',
    summary: `Entry point (${adventure.entry.default.x}, ${adventure.entry.default.y})`,
  });
  preview.push({
    category: 'Background',
    summary: selection.background?.name ?? 'No background image selected — add one later',
  });
  if (toggles.includeAmbient) {
    preview.push({
      category: 'Ambient',
      summary: selection.ambient?.name ?? selection.music?.name ?? 'No ambient audio selected',
    });
  }
  if (toggles.includeSfx) {
    preview.push({
      category: 'SFX',
      summary: [
        selection.footstepSfx?.name && `footstep=${selection.footstepSfx.name}`,
        selection.interactSfx?.name && `interact=${selection.interactSfx.name}`,
        selection.pickupSfx?.name && `pickup=${selection.pickupSfx.name}`,
        selection.transitionSfx?.name && `transition=${selection.transitionSfx.name}`,
      ].filter(Boolean).join(', ') || 'No SFX assets matched — runtime defaults apply',
    });
  }
  preview.push({
    category: 'Bounds',
    summary: `${adventure.colliders?.length ?? 0} colliders for movement blocking`,
  });

  return { fragment, catalog, preview };
}

/** Build a non-destructive playable room plan from classified assets. */
export function planPlayableRoomFromAssets(
  project: Project,
  options: PlayableRoomGeneratorOptions = {},
): PlayableRoomPlan {
  const toggles = resolveToggles(options);
  const selection = selectPlayableRoomAssets(project, options);

  try {
    const { fragment: targetFragment, createNewScene } = resolveTargetFragment(project, options);
    const conflicts = createNewScene
      ? []
      : detectConflicts(targetFragment, selection, toggles, options.confirmOverwrite ?? false);

    const { fragment, catalog, preview } = buildGeneratedFragment(
      project,
      targetFragment,
      selection,
      toggles,
      options,
    );

    const canApply = conflicts.length === 0;

    return {
      ok: true,
      preview,
      selection,
      toggles,
      conflicts,
      canApply,
      targetFragmentUid: fragment.uid,
      targetFragmentTitle: fragment.title,
      targetLocationId: fragment.locationId,
      createNewScene,
      patch: canApply
        ? {
          catalog,
          fragment,
          fragmentUid: fragment.uid,
          isNewFragment: createNewScene,
          setAsStartLocation: options.setAsStartLocation ?? createNewScene,
        }
        : undefined,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not plan playable room',
      preview: [],
      selection,
      toggles,
      conflicts: [],
      canApply: false,
      targetFragmentUid: '',
      targetFragmentTitle: '',
      targetLocationId: '',
      createNewScene: options.createNewScene ?? false,
    };
  }
}

/** Apply a playable room plan to a project copy. */
export function generatePlayableRoomFromAssets(
  project: Project,
  options: PlayableRoomGeneratorOptions = {},
): PlayableRoomApplyResult {
  const plan = planPlayableRoomFromAssets(project, options);
  if (!plan.ok) {
    throw new Error(plan.error ?? 'Could not plan playable room');
  }
  if (!plan.canApply || !plan.patch) {
    throw new Error('Overwrite confirmation required before generating this room');
  }

  const mergedCatalog = mergeGameplayTemplateCatalogs(project, plan.patch.catalog);
  const fragments = plan.patch.isNewFragment
    ? [...project.fragments, plan.patch.fragment]
    : project.fragments.map(fragment =>
      fragment.uid === plan.patch!.fragmentUid ? plan.patch!.fragment : fragment,
    );

  const nextProject: Project = {
    ...project,
    ...mergedCatalog,
    fragments,
    startLocation: plan.patch.setAsStartLocation
      ? plan.patch.fragment.locationId
      : project.startLocation,
  };

  return { project: nextProject, plan };
}
