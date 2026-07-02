import type { Choice, ChronicaState, Fragment, SceneHotspot, VariableValue } from '../types';

/**
 * Payload shapes emitted by the compat event bus. Keep these serializable —
 * no engine internals, no compiled action steps, no live class references.
 */
export type RuntimeEventPayloads = {
  'session-start': { fragment: Fragment | null };
  'session-resume': { fragment: Fragment | null };
  'session-reset': Record<string, never>;
  'choice-selected': { choice: Choice };
  'hotspot-activated': { hotspot: SceneHotspot };
  'dialogue-advanced': { fromIndex: number; toIndex: number };
  'fragment-changed': { from: Fragment | null; to: Fragment | null };
  'state-changed': { state: ChronicaState };
  'turn-resolved': { fragment: Fragment | null; source: TurnSource };
  'save-created': { moduleIds: string[] };
};

export type RuntimeEventName = keyof RuntimeEventPayloads;

export type TurnSource = 'choice' | 'hotspot' | 'dialogue' | 'entry' | 'resume';

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
  /** Serialized {@link ChronicaState}. */
  state: Record<string, unknown>;
  /** History entries for UI. */
  history: { locationId: string; title: string }[];
  /** Per-module opaque payloads, keyed by moduleId. Absent for legacy saves. */
  modules?: Record<string, ModuleSavePayload>;
  savedAt: string;
}

export type CompatVariableValue = VariableValue;
