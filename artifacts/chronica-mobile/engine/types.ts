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
}

export interface ChronicaState {
  location: string;
  instability: number;
  reality_layer: number;
  memory: Record<string, VariableValue>;
  variables: Record<string, VariableValue>;
  /** Index into the current fragment's dialogue lines (tap-to-advance). */
  dialogueLineIndex: number;
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
