import type { ChronicaState as EngineState, VariableValue } from '../types';
import {
  deserializeState as engineDeserialize,
  serializeState as engineSerialize,
} from '../chronica-session';

/**
 * Class wrapper over the engine's plain-object {@link EngineState}.
 *
 * The Godot reference engine exposes state as a first-class object; TypeScript
 * mobile stores it as a struct because engine functions are pure. This wrapper
 * lets consumers call `state.getVariable(...)` etc. while the underlying
 * mutable struct — which every engine function requires — stays available via
 * {@link ChronicaState.raw}.
 *
 * Reads coerce missing paths to the same defaults as `expression-evaluator`,
 * so a compat consumer can never see `undefined` for a game variable.
 */
export class ChronicaState {
  private inner: EngineState;

  constructor(state: EngineState) {
    this.inner = state;
  }

  /** Mutable engine state — pass this to any raw engine function. */
  get raw(): EngineState {
    return this.inner;
  }

  /** Replace the backing struct in-place (used on resume). */
  replace(next: EngineState): void {
    this.inner = next;
  }

  get location(): string {
    return this.inner.location;
  }

  set location(next: string) {
    this.inner.location = next;
  }

  get instability(): number {
    return this.inner.instability;
  }

  get realityLayer(): number {
    return this.inner.reality_layer;
  }

  get dialogueLineIndex(): number {
    return this.inner.dialogueLineIndex ?? 0;
  }

  set dialogueLineIndex(next: number) {
    this.inner.dialogueLineIndex = next;
  }

  getVariable(name: string, fallback: VariableValue = 0): VariableValue {
    const value = this.inner.variables[name];
    return value === undefined ? fallback : value;
  }

  setVariable(name: string, value: VariableValue): void {
    this.inner.variables[name] = value;
    if (name === 'instability' && typeof value === 'number') {
      this.inner.instability = value;
    }
  }

  hasFlag(name: string): boolean {
    return this.inner.memory[name] === true;
  }

  setFlag(name: string, value = true): void {
    this.inner.memory[name] = value;
  }

  clearFlag(name: string): void {
    this.inner.memory[name] = false;
  }

  /** Serialize using the engine's canonical form. */
  serialize(): Record<string, unknown> {
    return JSON.parse(engineSerialize(this.inner));
  }

  /**
   * Restore this state from a serialized snapshot. Returns false if the
   * payload was unusable (matches engine `deserializeState` behavior).
   */
  restore(data: Record<string, unknown>): boolean {
    const next = engineDeserialize(data);
    if (!next) return false;
    this.inner = next;
    return true;
  }
}
