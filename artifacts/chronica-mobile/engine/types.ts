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
}

/** Sprite placed on the scene stage (0–1 coordinates; x/y = horizontal center and feet line). */
export interface StageActorExpression {
  id: string;
  asset: string;
}

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
  type: 'image' | 'audio' | 'data';
  uri: string;
  mimeType: string;
  size: number;
  importedAt: string;
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
}
