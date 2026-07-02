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
  choice_selected: { choice: Choice };
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
  save: CompatSave;
}

/** Names of hooks the module registry can invoke via `callHook`. */
export type ModuleHookName =
  | 'initialize'
  | 'onSessionStart'
  | 'onChoiceSelected'
  | 'onTurnResolved'
  | 'onSessionSave'
  | 'onSessionLoad';

export type RuntimeEventListener<E extends RuntimeEventName> = (
  payload: RuntimeEventPayloads[E],
) => void;

export type RuntimeEventUnsubscribe = () => void;

/**
 * Module payload stored in a compat save envelope. Modules serialize their
 * own state to a JSON-compatible value; the shape is opaque to the runtime.
 * Typed as `unknown` so consumers can substitute their own concrete shape
 * without needing an index signature on the payload object.
 */
export type ModuleSavePayload = unknown;

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
  /** Per-module opaque payloads, keyed by moduleId. Absent for legacy saves. */
  modules?: Record<string, ModuleSavePayload>;
  savedAt: string;
}

export type CompatVariableValue = VariableValue;
