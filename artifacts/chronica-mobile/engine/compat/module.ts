import type { Choice } from '../types';
import type { ChronicaRuntimeContext } from './context';
import type { ModuleSavePayload, TurnResult } from './types';

/**
 * Optional gameplay system attached to a {@link ChronicaSession}. Modules
 * observe the runtime and persist their own state without changing the core
 * turn resolution rules.
 *
 * Hooks may return a Promise; the {@link ModuleRegistry} awaits every hook so
 * a module can safely do async work (e.g. play a sound, read AsyncStorage)
 * before the next runtime step proceeds.
 *
 * Hook failures are isolated: an exception (or rejected Promise) is caught,
 * routed through the `module_error` event, and does not stop other modules or
 * the surrounding turn.
 */
export interface ChronicaModule<TPayload extends ModuleSavePayload = ModuleSavePayload> {
  /** Stable identifier — also used as the save-payload key. */
  readonly id: string;

  /** Called once when the module is first attached to the session. */
  initialize(ctx: ChronicaRuntimeContext): void | Promise<void>;

  /** Called after {@link ChronicaSession.start} bootstraps and applies entry effects. */
  onSessionStart?(ctx: ChronicaRuntimeContext): void | Promise<void>;

  /** Called after `choice_selected` is emitted and before the turn resolves. */
  onChoiceSelected?(ctx: ChronicaRuntimeContext, choice: Choice): void | Promise<void>;

  /** Called after the turn resolves and state/fragment updates are applied. */
  onTurnResolved?(ctx: ChronicaRuntimeContext, result: TurnResult): void | Promise<void>;

  /** Return a JSON-compatible payload persisted alongside the core save. */
  onSessionSave?(ctx: ChronicaRuntimeContext): TPayload | undefined;

  /** Restore state from the payload written by `onSessionSave` — undefined for legacy saves. */
  onSessionLoad?(ctx: ChronicaRuntimeContext, payload: TPayload | undefined): void | Promise<void>;
}
