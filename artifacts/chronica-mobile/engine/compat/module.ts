import type { Choice, ChronicaState, Fragment, SceneHotspot } from '../types';
import type { CompiledGame } from '../compiler/types';
import type { ModuleSavePayload, TurnSource } from './types';

/**
 * Optional gameplay system attached to a {@link ChronicaSession}. Modules
 * observe and augment the runtime without editing `TurnResolver` — they cannot
 * override the deterministic core rules, only react to them and persist their
 * own state.
 *
 * Guidance:
 * - Modules must be data-driven; no Godot-specific concepts.
 * - Hooks must be pure w.r.t. game rules; only mutate module-owned state.
 * - Return values are advisory (see below for hooks that produce data).
 */
export interface RuntimeModule<TPayload extends ModuleSavePayload = ModuleSavePayload> {
  /** Stable identifier used as the save-payload key. */
  readonly id: string;

  /** Human-readable label for debug output. */
  readonly label?: string;

  /** Called once when the module is attached to a session. */
  onAttach?(ctx: ModuleContext): void;

  /** Called once when the module is detached (e.g. session disposed). */
  onDetach?(ctx: ModuleContext): void;

  /** Called after a fresh session start (entry effects already applied). */
  onSessionStart?(ctx: ModuleContext, event: SessionStartEvent): void;

  /** Called after tryResume succeeds and payloads (if any) have been restored. */
  onSessionResume?(ctx: ModuleContext, event: SessionResumeEvent): void;

  /** Called after a choice's action steps have committed and the next fragment is set. */
  onChoiceResolved?(ctx: ModuleContext, event: ChoiceResolvedEvent): void;

  /** Called after a hotspot's action steps have committed and the next fragment is set. */
  onHotspotResolved?(ctx: ModuleContext, event: HotspotResolvedEvent): void;

  /** Called after any turn (choice / hotspot / dialogue advance / entry). */
  onTurnResolved?(ctx: ModuleContext, event: TurnResolvedEvent): void;

  /** Serialize module state to a JSON-compatible payload for the save envelope. */
  onSerialize?(ctx: ModuleContext): TPayload | undefined;

  /** Restore module state from a save envelope payload (may be undefined for legacy saves). */
  onDeserialize?(ctx: ModuleContext, payload: TPayload | undefined): void;
}

/** Runtime handle passed to every module hook. */
export interface ModuleContext {
  /** Compiled game the session is running. */
  readonly game: CompiledGame;
  /** Current mutable engine state — modules must NOT mutate location/variables/memory. */
  readonly state: ChronicaState;
}

export interface SessionStartEvent {
  fragment: Fragment | null;
}

export interface SessionResumeEvent {
  fragment: Fragment | null;
}

export interface ChoiceResolvedEvent {
  choice: Choice;
  fragment: Fragment | null;
}

export interface HotspotResolvedEvent {
  hotspot: SceneHotspot;
  fragment: Fragment | null;
}

export interface TurnResolvedEvent {
  source: TurnSource;
  fragment: Fragment | null;
}
