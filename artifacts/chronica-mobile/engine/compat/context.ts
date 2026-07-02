import type { CompiledGame } from '../compiler/types';
import type { Fragment } from '../types';
import type { ChronicaState } from './chronica-state';
import type { ChronicaEventBus } from './event-bus';
import type { FragmentStore } from './fragment-store';

/**
 * Shared runtime context passed to every module hook.
 *
 * The context is stable across the whole session — modules can hold onto
 * their reference safely. `state` and `fragment` are exposed as getters so the
 * module always reads current values without the session having to push
 * updates through the context.
 *
 * `moduleData` is a per-module scratch store so modules can attach transient
 * data (e.g. cached lookups, timers) without polluting the engine state
 * struct. Serialized module data still goes through the save envelope's
 * `modules[<id>]` payload.
 */
export class ChronicaRuntimeContext {
  private readonly moduleData: Map<string, unknown> = new Map();

  constructor(
    readonly game: CompiledGame,
    readonly bus: ChronicaEventBus,
    private readonly getState: () => ChronicaState,
    private readonly getFragment: () => Fragment | null,
    private readonly fragments: FragmentStore,
  ) {}

  /** Live view of the current session state. */
  get state(): ChronicaState {
    return this.getState();
  }

  /** Live view of the current active fragment. */
  get fragment(): Fragment | null {
    return this.getFragment();
  }

  /**
   * Fragment lookup helper — resolves the active fragment for a location under
   * the current state, honoring authored conditions.
   */
  findFragment(locationId: string): Fragment | null {
    return this.fragments.active(locationId, this.state.raw);
  }

  /**
   * Safe state mutation helper. Emits `state_changed` after the mutator runs.
   * Modules should prefer this over touching `state.raw` directly so the rest
   * of the runtime learns about changes.
   */
  updateState(mutator: (state: ChronicaState) => void): void {
    mutator(this.state);
    this.bus.emit('state_changed', { state: this.state.raw });
  }

  getModuleData<T>(moduleId: string): T | undefined {
    return this.moduleData.get(moduleId) as T | undefined;
  }

  setModuleData<T>(moduleId: string, data: T): void {
    this.moduleData.set(moduleId, data);
  }

  deleteModuleData(moduleId: string): void {
    this.moduleData.delete(moduleId);
  }

  clearModuleData(): void {
    this.moduleData.clear();
  }
}
