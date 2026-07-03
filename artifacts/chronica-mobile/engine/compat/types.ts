import type { Choice, ChronicaState, Fragment, SceneHotspot, VariableValue } from '../types';

/**
 * Snake-case event names emitted by {@link ChronicaEventBus}. The snake_case
 * form matches the naming convention used by the main Chronica engine so
 * cross-engine tooling can subscribe with a shared vocabulary.
 */
export type RuntimeEventPayloads = {
  session_started: { fragment: Fragment | null };
  session_loaded: { fragment: Fragment | null };
  session_saved: SessionSavedEvent;
  session_reset: Record<string, never>;
  choice_selected: ChoiceSelectedEvent;
  hotspot_activated: { hotspot: SceneHotspot };
  dialogue_advanced: { fromIndex: number; toIndex: number };
  turn_resolved: { result: TurnResult };
  state_changed: { state: ChronicaState };
  fragment_changed: { from: Fragment | null; to: Fragment | null };
  module_error: ModuleErrorEvent;

  // Emitted by first-party gameplay modules (engine/compat/modules/*).
  // Listeners are only invoked when the corresponding module is attached, so
  // the events sit dormant on the bus for consumers that skip these modules.
  instability_changed: { previous: number; current: number };
  reality_layer_changed: { previous: number; current: number };
  echo_state_changed: {
    echoId: string;
    previousState: 'Dormant' | 'Active' | 'Manifested' | 'Resolved';
    currentState: 'Dormant' | 'Active' | 'Manifested' | 'Resolved';
  };
};

export type RuntimeEventName = keyof RuntimeEventPayloads;

export type TurnSource = 'choice' | 'hotspot' | 'dialogue' | 'entry' | 'resume';

/** Payload for the `choice_selected` event after a successful {@link ChronicaSession.choose}. */
export interface ChoiceSelectedEvent {
  choice: Choice;
  previousFragment: Fragment | null;
  resultingFragment: Fragment | null;
  /** Alias of {@link ChoiceSelectedEvent.resultingFragment} for cross-engine parity. */
  currentFragment: Fragment | null;
  previousState: ChronicaState;
  currentState: ChronicaState;
  turnResult: TurnResult;
}

/**
 * Outcome of a single turn — shared with modules via `onTurnResolved` and via
 * the `turn_resolved` bus event.
 */
export interface TurnResult {
  source: TurnSource;
  fragment: Fragment | null;
  previousFragment: Fragment | null;
  choice?: Choice;
  hotspot?: SceneHotspot;
  stateChanged: boolean;
  fragmentChanged: boolean;
}

/** Payload for the `module_error` event — one entry per failed module hook. */
export interface ModuleErrorEvent {
  moduleId: string;
  hook: ModuleHookName;
  error: unknown;
}

/** Payload for the `session_saved` event. */
export interface SessionSavedEvent {
  moduleIds: string[];
  save: SessionSaveEnvelope;
}

/** Names of hooks the module registry can invoke via `callHook` or save/load. */
export type ModuleHookName =
  | 'initialize'
  | 'onSessionStart'
  | 'onChoiceSelected'
  | 'onTurnResolved'
  | 'onSessionSave'
  | 'onSessionSaveConfig'
  | 'onSessionLoad'
  | 'onSessionLoadConfig';

export type RuntimeEventListener<E extends RuntimeEventName> = (
  payload: RuntimeEventPayloads[E],
) => void;

export type RuntimeEventUnsubscribe = () => void;

/**
 * Module runtime payload from {@link ChronicaModule.onSessionSave}. Opaque to
 * the core runtime; each module owns its internal versioning inside `data`.
 */
export type ModuleSavePayload = unknown;

/**
 * Canonical module save entry per {@link ../docs/spec/SAVE_SPEC.md | SAVE_SPEC}.
 * `config` is reapplied before `data` on resume.
 */
export interface ModuleSaveEntry {
  id: string;
  config?: unknown;
  data: ModuleSavePayload;
}

/** Legacy compat v1 record: module id → opaque data payload. */
export type LegacyModuleSaveRecord = Record<string, ModuleSavePayload>;

/** Module payloads as written by {@link ModuleRegistry.saveAll} or read on resume. */
export type ModuleSavePayloads = ModuleSaveEntry[] | LegacyModuleSaveRecord;

/**
 * Save envelope version. Bump when the compat save shape changes in a way
 * that requires migration; unit tests verify legacy shapes still load.
 */
export const COMPAT_SAVE_VERSION = 1 as const;

export interface CompatSave {
  /** Envelope version — currently {@link COMPAT_SAVE_VERSION}. */
  compatVersion: typeof COMPAT_SAVE_VERSION;
  /** Local install id. */
  projectId: string;
  gameId: string;
  contentHash: string;
  /**
   * Fragment.uid active when the save was written. Purely a hint — resume
   * re-resolves the fragment through the compiled index so authored conditions
   * always win.
   */
  fragmentId?: string;
  /** Serialized {@link ChronicaState}. */
  state: Record<string, unknown>;
  /** History entries for UI. */
  history: { locationId: string; title: string }[];
  /**
   * Module save payloads. New saves use {@link ModuleSaveEntry}[]; legacy saves
   * may use a record keyed by module id.
   */
  modules?: ModuleSavePayloads;
  savedAt: string;
}

/** Canonical save envelope v2 per SAVE_SPEC — written via {@link ChronicaSession.toSave}. */
export interface CanonicalSaveV2 {
  formatVersion: typeof CANONICAL_SAVE_FORMAT_VERSION;
  projectId: string;
  gameId: string;
  contentHash: string;
  savedAt: string;
  state: Record<string, unknown>;
  history: { locationId: string; title: string }[];
  fragmentId?: string;
  modules?: ModuleSaveEntry[];
}

/** Save envelope emitted or accepted by the compat session layer. */
export type SessionSaveEnvelope = CompatSave | CanonicalSaveV2;

export type SessionSaveFormat = 'compat-v1' | 'canonical-v2';

export interface SessionToSaveOptions {
  format?: SessionSaveFormat;
}

export type CompatVariableValue = VariableValue;

/** Canonical save envelope version per SAVE_SPEC. */
export const CANONICAL_SAVE_FORMAT_VERSION = 2 as const;

/** Caller-supplied game identity when ingesting saves that omit it (e.g. main-format). */
export interface NormalizeSaveContext {
  gameId: string;
  contentHash: string;
  projectId?: string;
}

/** Normalized save envelope consumed by compat resume after dual-read normalization. */
export interface NormalizedSaveEnvelope {
  formatVersion: typeof CANONICAL_SAVE_FORMAT_VERSION;
  projectId: string;
  gameId: string;
  contentHash: string;
  savedAt: string;
  state: Record<string, unknown>;
  history: { locationId: string; title: string }[];
  fragmentId?: string;
  modules?: ModuleSaveEntry[];
}

export type NormalizeSaveFailureReason =
  | 'wrong-game'
  | 'stale-content'
  | 'corrupt-state'
  | 'missing-identity';

export type NormalizeSaveResult =
  | { ok: true; envelope: NormalizedSaveEnvelope; warnings: string[] }
  | { ok: false; reason: NormalizeSaveFailureReason; message?: string };
