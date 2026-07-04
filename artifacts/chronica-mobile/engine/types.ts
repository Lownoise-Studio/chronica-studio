export type VariableValue = string | number | boolean;

/** Reusable cast member — referenced by dialogue lines via characterId. */
export interface Character {
  uid: string;
  /** Stable slug used in dialogue (e.g. elena, guard). */
  characterId: string;
  displayName: string;
  defaultPortrait?: string;
  expressions?: CharacterExpression[];
}

export interface CharacterExpression {
  id: string;
  label?: string;
  portrait: string;
}

/** One line in a scene script. speakerId null/omit = narration. */
export interface DialogueLine {
  uid: string;
  speakerId?: string | null;
  expressionId?: string;
  text: string;
}

export interface Choice {
  uid: string;
  label: string;
  /** action string: goto:<locationId> | set:<flag> | clear:<flag> | expr | multi-step semicolon */
  action: string;
  /** conditions that must all pass for this choice to appear */
  conditions: string[];
}

/** Normalized tap region on a scene background (0–1 coordinates). */
export interface SceneHotspot {
  uid: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Same action grammar as choices — compiled to ActionStep[] at build time. */
  action: string;
  conditions: string[];
  /** Authoring: inspect, collect item, use item, or custom trigger. */
  interactionKind?: HotspotInteractionKind;
  /** Authoring: one-shot hides after first use via suggested memory flag. */
  repeatMode?: HotspotRepeatMode;
  /** When false, authoring treats the hotspot as disabled (adds blocking condition). */
  enabled?: boolean;
  /** Inventory item id for collect / use-item interactions. */
  itemId?: string;
  /** Short inspect copy — authoring metadata for inspect interactions. */
  inspectText?: string;
  /** Item id required in inventory for use-item interactions. */
  requiredItemId?: string;
}

export type HotspotInteractionKind = 'inspect' | 'collect' | 'use-item' | 'trigger' | 'custom';

export type HotspotRepeatMode = 'one-shot' | 'repeatable';

/** Sprite placed on the scene stage (0–1 coordinates; x/y = horizontal center and feet line). */
export interface StageActorExpression {
  id: string;
  asset: string;
}

export type StageActorGameplayState =
  | 'idle'
  | 'following'
  | 'hidden'
  | 'hostile'
  | 'friendly'
  | 'disabled';

export interface StageActor {
  uid: string;
  /** Optional cast link for editor tooling; sprite image comes from asset fields. */
  characterId?: string;
  label?: string;
  /** Default sprite asset name when no expression match applies. */
  asset: string;
  /** Horizontal center, 0–1 across the stage width. */
  x: number;
  /** Feet / bottom anchor, 0–1 down the stage height. */
  y: number;
  /** Width as a fraction of stage width (default 0.3). */
  width?: number;
  scale?: number;
  zIndex?: number;
  expressions?: StageActorExpression[];
  /** State path whose string value selects an expression id (e.g. variables.cow_state). */
  expressionFromVariable?: string;
  /** All conditions must pass for this actor to render. */
  visibleWhen?: string[];
  /** Authoring: default NPC / prop gameplay posture. */
  gameplayState?: StageActorGameplayState;
  /** variables.npc_state path storing the live posture value. */
  stateVariable?: string;
}

/** Kind of interactable in the top-down adventure runtime. */
export type AdventureInteractableKind = 'npc' | 'pickup' | 'door' | 'trigger';

/** Rectangle in normalized 0–1 room coordinates that blocks player movement. */
export interface AdventureCollider {
  uid: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Persistent object the player can walk near and interact with. */
export interface AdventureInteractable {
  uid: string;
  kind: AdventureInteractableKind;
  label: string;
  /** Center X in 0–1 room coordinates. */
  x: number;
  /** Feet / bottom anchor Y in 0–1 room coordinates. */
  y: number;
  /** Interaction proximity radius in normalized units (default 0.08). */
  radius?: number;
  /** Optional asset name for a sprite marker. */
  sprite?: string;
  /** Sprite width as a fraction of room width (default 0.08). */
  width?: number;
  /** Same action grammar as choices — compiled to ActionStep[] at build time. */
  action: string;
  /** All conditions must pass for the interactable to appear / be usable. */
  conditions: string[];
  /** When true, the interactable triggers automatically when the player enters range. */
  autoTrigger?: boolean;
  /** When true, the interactable's bounds also block movement while its conditions hold. */
  solid?: boolean;
  /** Optional SFX key override — defaults chosen per kind. */
  sfx?: string;
}

/** Where the player spawns when entering this scene. */
export interface AdventureEntry {
  /** Optional per-source-location overrides. Key = the previous locationId. */
  from?: Record<string, { x: number; y: number }>;
  /** Default spawn point, used when no from-override matches. */
  default: { x: number; y: number };
}

/** SFX asset overrides for the adventure runtime. Values are asset names. */
export interface AdventureSfxSet {
  footstep?: string;
  interact?: string;
  pickup?: string;
  transition?: string;
}

/** Top-down playable-room description attached to a Fragment. */
export interface SceneAdventure {
  /** Where the player appears when the scene loads. */
  entry: AdventureEntry;
  /** Solid rectangles that block movement (walls, furniture). */
  colliders?: AdventureCollider[];
  /** NPCs, pickups, doors, and trigger zones for this room. */
  interactables?: AdventureInteractable[];
  /** Movement speed in normalized units per second (default 0.35). */
  speed?: number;
  /** Optional player sprite asset name. */
  playerSprite?: string;
  /** Player sprite width as a fraction of room width (default 0.09). */
  playerWidth?: number;
  /** Optional aspect ratio hint (width/height) for the stage. Defaults to 16/9. */
  aspectRatio?: number;
  /** SFX asset overrides. */
  sfx?: AdventureSfxSet;
}

export interface Fragment {
  uid: string;
  /** human-readable name, shown in the editor list */
  title: string;
  /** semantic graph node id; choices use goto:<locationId> to navigate here */
  locationId: string;
  priority: number;
  conditions: string[];
  effects: string[];
  text: string;
  /** Ordered scene script. When empty, legacy `text` is used as a single narration line. */
  dialogue?: DialogueLine[];
  choices: Choice[];
  hotspots?: SceneHotspot[];
  stageActors?: StageActor[];
  backgroundImage?: string;
  backgroundAudio?: string;
  /** Top-down playable room data. When present, the runtime renders the adventure stage. */
  adventure?: SceneAdventure;
  /** Editor-only visual composition — stripped before compile/runtime. */
  stageAuthoring?: StageComposition;
}

/** Visual layer for editor stage objects (authoring only). */
export type StageLayer =
  | 'background'
  | 'foreground'
  | 'props'
  | 'effects'
  | 'lighting'
  | 'ui-guides';

/** Editor lighting preset metadata — not applied at runtime. */
export type LightingPreset =
  | 'morning'
  | 'day'
  | 'sunset'
  | 'night'
  | 'indoor'
  | 'cave';

export interface StageCameraGuides {
  safeArea?: boolean;
  aspectGuide?: boolean;
  centerGuides?: boolean;
  ruleOfThirds?: boolean;
}

/** Editor-placed visual object — gameplay still uses hotspots/stage actors. */
export interface StageObject {
  uid: string;
  label?: string;
  asset: string;
  /** Horizontal center, 0–1. */
  x: number;
  /** Vertical center, 0–1. */
  y: number;
  scale?: number;
  /** Degrees clockwise. */
  rotation?: number;
  layer: StageLayer;
  zIndex?: number;
  visibleWhen?: string[];
  /** Linked hotspot uid for visual/editor cross-reference. */
  hotspotRef?: string;
  /** @deprecated Use hotspotRef — kept for backward compatibility. */
  interactionRef?: string;
  /** Editor-only presentation transition metadata. */
  presentation?: StagePresentationMetadata;
  locked?: boolean;
  /** Hidden in editor canvas only. */
  hidden?: boolean;
  groupId?: string;
}

export interface StageComposition {
  objects: StageObject[];
  lightingPreset?: LightingPreset;
  cameraGuides?: StageCameraGuides;
  /** Playtest-only presentation overlay toggle (editor metadata). */
  showPresentationOverlay?: boolean;
}

export type PresentationTransitionKind = 'fade-in' | 'fade-out' | 'slide' | 'zoom';

/** Editor/presentation metadata — never affects runtime state. */
export interface StagePresentationMetadata {
  enter?: PresentationTransitionKind;
  exit?: PresentationTransitionKind;
}

export interface ChronicaState {
  location: string;
  instability: number;
  reality_layer: number;
  memory: Record<string, VariableValue>;
  variables: Record<string, VariableValue>;
  /** Index into the current fragment's dialogue lines (tap-to-advance). */
  dialogueLineIndex: number;
  /** Player X in 0–1 room coordinates. Present for adventure scenes. */
  playerX?: number;
  /** Player Y in 0–1 room coordinates. Present for adventure scenes. */
  playerY?: number;
  /** Previous locationId — used to pick a spawn point when entering a scene. */
  lastLocationId?: string;
}

export interface ProjectAsset {
  id: string;
  name: string;
  type: 'image' | 'audio' | 'data' | 'model';
  uri: string;
  mimeType: string;
  size: number;
  importedAt: string;
  /** Optional provenance label — source-agnostic (e.g. "Sketchfab", "In-house"). */
  source?: string;
  /** Optional license string for packaged assets. */
  license?: string;
  /** Optional preview image asset id for model thumbnails in the editor. */
  previewImageAssetId?: string;
}

/** Authoring catalog — items map to variables.* / memory.* the runtime already understands. */
export interface InventoryItem {
  id: string;
  label: string;
  /** Linked asset name from the project library. */
  assetName: string;
  /** Full state path, e.g. variables.has_lantern or memory.lantern_found. */
  stateKey: string;
  stateKind: 'variable' | 'memory';
  consumable?: boolean;
  description?: string;
}

export type ObjectivePresentation = 'active' | 'completed' | 'failed' | 'hidden';

export interface GameObjective {
  id: string;
  title: string;
  description?: string;
  /** Authoring label for HUD / docs — progress uses completeWhen / failWhen. */
  presentation: ObjectivePresentation;
  completeWhen: string;
  failWhen?: string;
  revealWhen?: string;
}

export type WorldStateCategory = 'door' | 'bridge' | 'light' | 'enemy' | 'npc' | 'custom';

/** Persistent world flag the scenes can gate on via conditions. */
export interface WorldStateFlag {
  id: string;
  label: string;
  category: WorldStateCategory;
  /** memory.door_unlocked or variables.bridge_down */
  stateKey: string;
  stateKind: 'variable' | 'memory';
  initialValue: VariableValue;
  description?: string;
}

export type GameplayVariableKind = 'boolean' | 'number' | 'string' | 'counter';

/** Designer-friendly variable definition — syncs to initialVariables on save. */
export interface GameplayVariable {
  id: string;
  /** Slug without prefix — stored under variables.<key>. */
  key: string;
  label: string;
  kind: GameplayVariableKind;
  initialValue: VariableValue;
  description?: string;
}

export interface NpcStateProfile {
  id: string;
  label: string;
  characterId?: string;
  defaultState: StageActorGameplayState;
  /** variables.npc_keeper_state */
  stateVariable?: string;
  /** memory.met_keeper */
  metFlag?: string;
  description?: string;
}

export interface Project {
  schemaVersion: number;
  /** Stable game identity — survives export/import across devices. */
  gameId: string;
  /** Local library / install id (device-specific). */
  id: string;
  title: string;
  description: string;
  startLocation: string;
  initialVariables: Record<string, VariableValue>;
  initialMemory: Record<string, VariableValue>;
  createdAt: string;
  updatedAt: string;
  fragments: Fragment[];
  assets: ProjectAsset[];
  characters: Character[];
  /** Gameplay authoring catalogs (Phase 1 — no new runtime paths). */
  inventory?: InventoryItem[];
  objectives?: GameObjective[];
  worldState?: WorldStateFlag[];
  gameplayVariables?: GameplayVariable[];
  npcProfiles?: NpcStateProfile[];
}

export interface GameSave {
  projectId: string;
  gameId?: string;
  state: Record<string, unknown>;
  savedAt: string;
}

export interface ValidationError {
  fragmentUid: string;
  fragmentTitle: string;
  type: 'broken-link' | 'invalid-condition' | 'invalid-effect' | 'invalid-action' | 'invalid-hotspot' | 'invalid-stage-actor' | 'invalid-dialogue' | 'missing-character' | 'missing-start' | 'duplicate-location' | 'missing-asset' | 'orphan-scene' | 'unknown-path' | 'type-mismatch' | 'unreachable-target';
  message: string;
  /** Defaults to 'error' when absent (back-compat). Warnings inform but never block compile. */
  severity?: 'error' | 'warning';
  /** Canonical severity when set; otherwise derived by validation-severity policy. */
  level?: 'info' | 'warning' | 'error' | 'blocking';
}
