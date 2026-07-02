import type { CompiledGame } from '../compiler/types';
import {
  createInitialState,
  serializeState,
} from '../chronica-session';
import { applyEffect } from '../expression-evaluator';
import {
  advanceDialogueIndex,
  canAdvanceDialogue,
  getFragmentDialogueLines,
  isDialogueExhausted,
} from '../dialogue';
import type { Choice, Fragment, SceneHotspot } from '../types';
import { ActionResolver } from './action-resolver';
import { ChronicaRuntimeContext } from './context';
import { ChronicaState } from './chronica-state';
import { ChronicaEventBus } from './event-bus';
import { ExpressionEvaluator } from './expression-evaluator';
import { FragmentStore } from './fragment-store';
import type { ChronicaModule } from './module';
import { ModuleRegistry } from './module-registry';
import { TurnResolver } from './turn-resolver';
import {
  COMPAT_SAVE_VERSION,
  type CompatSave,
  type ModuleSavePayload,
  type TurnResult,
  type TurnSource,
} from './types';

export interface SessionSnapshot {
  started: boolean;
  fragment: Fragment | null;
  visibleChoices: Choice[];
  visibleHotspots: SceneHotspot[];
  state: ChronicaState;
  history: HistoryEntry[];
}

export interface HistoryEntry {
  locationId: string;
  title: string;
}

export type SessionChooseResult =
  | { ok: true; result: TurnResult }
  | { ok: false; reason: 'not-started' | 'dead-end' | 'unknown-action' };

export type SessionAdvanceDialogueResult =
  | { ok: true; advanced: boolean }
  | { ok: false; reason: 'not-started' | 'invalid-index' };

export interface SessionResumeInput {
  save: CompatSave;
}

export type SessionResumeResult =
  | { ok: true; fragment: Fragment | null }
  | { ok: false; reason: 'wrong-game' | 'stale-content' | 'corrupt-state' };

/**
 * Top-level compat facade for a Chronica play session.
 *
 * Owns the shared services (state, fragment store, turn resolver, evaluator,
 * action resolver, event bus, module registry) and drives the deterministic
 * turn flow specified by the runtime compatibility spec:
 *
 * 1. `emit choice_selected`
 * 2. `await` module `onChoiceSelected`
 * 3. resolve turn via {@link TurnResolver}
 * 4. commit state + fragment
 * 5. `await` module `onTurnResolved`
 * 6. `emit turn_resolved`
 * 7. `emit state_changed` if state changed
 * 8. `emit fragment_changed` if fragment changed
 */
export class ChronicaSession {
  readonly game: CompiledGame;
  readonly bus: ChronicaEventBus = new ChronicaEventBus();
  readonly evaluator: ExpressionEvaluator = new ExpressionEvaluator();
  readonly actions: ActionResolver = new ActionResolver();
  readonly fragments: FragmentStore;
  readonly turns: TurnResolver;
  readonly modules: ModuleRegistry = new ModuleRegistry();
  readonly context: ChronicaRuntimeContext;

  private _state: ChronicaState;
  private _fragment: Fragment | null = null;
  private _history: HistoryEntry[] = [];
  private _started = false;

  constructor(game: CompiledGame) {
    this.game = game;
    this.fragments = new FragmentStore(game);
    this.turns = new TurnResolver(game);
    this._state = new ChronicaState(
      createInitialState(game.startLocation, game.initialVariables, game.initialMemory),
    );
    this.context = new ChronicaRuntimeContext(
      game,
      this.bus,
      () => this._state,
      () => this._fragment,
      this.fragments,
    );
  }

  get state(): ChronicaState {
    return this._state;
  }

  get fragment(): Fragment | null {
    return this._fragment;
  }

  get isStarted(): boolean {
    return this._started;
  }

  get history(): readonly HistoryEntry[] {
    return this._history;
  }

  get visibleChoices(): Choice[] {
    if (!this._fragment) return [];
    return this.turns.visibleChoices(this._fragment, this._state.raw);
  }

  get visibleHotspots(): SceneHotspot[] {
    if (!this._fragment) return [];
    return this.turns.visibleHotspots(this._fragment, this._state.raw);
  }

  /** Register a module. Same as `session.modules.register(...)`. */
  register(module: ChronicaModule): void {
    this.modules.register(module);
  }

  /** Unregister a module. Same as `session.modules.unregister(...)`. */
  unregister(moduleId: string): boolean {
    return this.modules.unregister(moduleId);
  }

  /**
   * Bootstrap a new session:
   * - reset state to the compiled game's initial values
   * - enter `startLocation`, apply the fragment's entry effects
   * - `initializeAll` any newly-registered modules
   * - emit `session_started` / `fragment_changed` / `state_changed`
   * - run `onSessionStart` hooks
   */
  async start(): Promise<boolean> {
    if (!this.game.fragments.length) return false;

    const previousFragment = this._fragment;
    this._state.replace(
      createInitialState(
        this.game.startLocation,
        this.game.initialVariables,
        this.game.initialMemory,
      ),
    );

    const fragment = this.fragments.active(this.game.startLocation, this._state.raw);
    if (fragment) {
      for (const effect of fragment.effects) applyEffect(effect, this._state.raw);
    }

    this._fragment = fragment;
    this._history = fragment
      ? [{ locationId: fragment.locationId, title: fragment.title || fragment.locationId }]
      : [];
    this._started = true;

    await this.modules.initializeAll(this.context);

    this.bus.emit('session_started', { fragment });
    this.bus.emit('fragment_changed', { from: previousFragment, to: fragment });
    this.bus.emit('state_changed', { state: this._state.raw });

    await this.modules.callHook('onSessionStart', this.context);
    await this.emitTurnResolved({
      source: 'entry',
      fragment,
      previousFragment,
      stateChanged: true,
      fragmentChanged: previousFragment?.uid !== fragment?.uid,
    });
    return true;
  }

  /**
   * Resolve a choice under the spec'd turn flow. See class-level JSDoc.
   */
  async choose(choice: Choice): Promise<SessionChooseResult> {
    if (!this._started) return { ok: false, reason: 'not-started' };
    if (!(choice.uid in this.game.choiceActions)) {
      return { ok: false, reason: 'unknown-action' };
    }

    const previousFragment = this._fragment;
    const stateBefore = serializeState(this._state.raw);

    this.bus.emit('choice_selected', { choice });
    await this.modules.callHook('onChoiceSelected', this.context, choice);

    const fragment = this.turns.applyChoice(choice, this._state.raw);
    if (!fragment) return { ok: false, reason: 'dead-end' };

    this.pushHistory(fragment);
    this._fragment = fragment;

    const stateAfter = serializeState(this._state.raw);
    const stateChanged = stateBefore !== stateAfter;
    const fragmentChanged = previousFragment?.uid !== fragment.uid;

    const result: TurnResult = {
      source: 'choice',
      fragment,
      previousFragment,
      choice,
      stateChanged,
      fragmentChanged,
    };

    await this.modules.callHook('onTurnResolved', this.context, result);
    this.bus.emit('turn_resolved', { result });
    if (stateChanged) this.bus.emit('state_changed', { state: this._state.raw });
    if (fragmentChanged) this.bus.emit('fragment_changed', { from: previousFragment, to: fragment });
    return { ok: true, result };
  }

  async activateHotspot(hotspot: SceneHotspot): Promise<SessionChooseResult> {
    if (!this._started) return { ok: false, reason: 'not-started' };
    if (!(hotspot.uid in this.game.hotspotActions)) {
      return { ok: false, reason: 'unknown-action' };
    }

    const previousFragment = this._fragment;
    const stateBefore = serializeState(this._state.raw);

    this.bus.emit('hotspot_activated', { hotspot });

    const fragment = this.turns.applyHotspot(hotspot, this._state.raw);
    if (!fragment) return { ok: false, reason: 'dead-end' };

    if (previousFragment?.locationId !== fragment.locationId) {
      this.pushHistory(fragment);
    }
    this._fragment = fragment;

    const stateAfter = serializeState(this._state.raw);
    const stateChanged = stateBefore !== stateAfter;
    const fragmentChanged = previousFragment?.uid !== fragment.uid;

    const result: TurnResult = {
      source: 'hotspot',
      fragment,
      previousFragment,
      hotspot,
      stateChanged,
      fragmentChanged,
    };

    await this.modules.callHook('onTurnResolved', this.context, result);
    this.bus.emit('turn_resolved', { result });
    if (stateChanged) this.bus.emit('state_changed', { state: this._state.raw });
    if (fragmentChanged) this.bus.emit('fragment_changed', { from: previousFragment, to: fragment });
    return { ok: true, result };
  }

  async advanceDialogue(): Promise<SessionAdvanceDialogueResult> {
    if (!this._started || !this._fragment) {
      return { ok: false, reason: 'not-started' };
    }
    const index = this._state.dialogueLineIndex;
    if (!Number.isFinite(index) || index < 0) {
      return { ok: false, reason: 'invalid-index' };
    }

    const lines = getFragmentDialogueLines(this._fragment);
    if (!canAdvanceDialogue(index, lines.length)) {
      return { ok: true, advanced: false };
    }
    const next = advanceDialogueIndex(index, lines.length);
    this._state.dialogueLineIndex = next;
    this.bus.emit('dialogue_advanced', { fromIndex: index, toIndex: next });
    this.bus.emit('state_changed', { state: this._state.raw });
    await this.emitTurnResolved({
      source: 'dialogue',
      fragment: this._fragment,
      previousFragment: this._fragment,
      stateChanged: true,
      fragmentChanged: false,
    });
    return { ok: true, advanced: true };
  }

  /** True when the current fragment's dialogue script has been fully advanced. */
  isDialogueExhausted(): boolean {
    if (!this._fragment) return true;
    const lines = getFragmentDialogueLines(this._fragment);
    return isDialogueExhausted(this._state.dialogueLineIndex, lines.length);
  }

  /**
   * Build a compat save envelope for the current session.
   *
   * Returns null before {@link ChronicaSession.start} has been called.
   * After building, emits `session_saved` with the moduleIds that contributed
   * a payload — subscribers can persist the save to storage from there.
   */
  toSave(projectId: string): CompatSave | null {
    if (!this._started) return null;
    const modulePayloads = this.modules.saveAll(this.context);
    const save: CompatSave = {
      compatVersion: COMPAT_SAVE_VERSION,
      projectId,
      gameId: this.game.gameId,
      contentHash: this.game.contentHash,
      state: JSON.parse(serializeState(this._state.raw)),
      history: [...this._history],
      savedAt: new Date().toISOString(),
    };
    if (this._fragment) save.fragmentId = this._fragment.uid;
    if (modulePayloads) save.modules = modulePayloads;
    this.bus.emit('session_saved', {
      moduleIds: Object.keys(modulePayloads ?? {}),
      save,
    });
    return save;
  }

  /**
   * Restore a session from a save envelope. Legacy saves (no `modules` block,
   * no `fragmentId`) are supported — modules receive `undefined` payloads and
   * the fragment is re-resolved from `state.location`.
   */
  async tryResume({ save }: SessionResumeInput): Promise<SessionResumeResult> {
    if (!save.gameId?.trim() || save.gameId !== this.game.gameId) {
      return { ok: false, reason: 'wrong-game' };
    }
    if (!save.contentHash?.trim() || save.contentHash !== this.game.contentHash) {
      return { ok: false, reason: 'stale-content' };
    }
    if (!save.state || typeof save.state !== 'object') {
      return { ok: false, reason: 'corrupt-state' };
    }

    const restored = new ChronicaState(
      createInitialState(
        this.game.startLocation,
        this.game.initialVariables,
        this.game.initialMemory,
      ),
    );
    if (!restored.restore(save.state)) {
      return { ok: false, reason: 'corrupt-state' };
    }

    let fragment: Fragment | null;
    try {
      fragment = this.fragments.active(restored.location, restored.raw);
    } catch {
      return { ok: false, reason: 'corrupt-state' };
    }

    const previousFragment = this._fragment;
    this._state.replace(restored.raw);
    this._fragment = fragment;
    this._history = save.history ? [...save.history] : [];
    this._started = true;

    await this.modules.initializeAll(this.context);
    await this.modules.loadAll(this.context, save.modules);

    this.bus.emit('session_loaded', { fragment });
    this.bus.emit('fragment_changed', { from: previousFragment, to: fragment });
    this.bus.emit('state_changed', { state: this._state.raw });
    await this.emitTurnResolved({
      source: 'resume',
      fragment,
      previousFragment,
      stateChanged: true,
      fragmentChanged: previousFragment?.uid !== fragment?.uid,
    });
    return { ok: true, fragment };
  }

  reset(): void {
    const previousFragment = this._fragment;
    this._state.replace(
      createInitialState(
        this.game.startLocation,
        this.game.initialVariables,
        this.game.initialMemory,
      ),
    );
    this._fragment = null;
    this._history = [];
    this._started = false;
    this.context.clearModuleData();
    this.bus.emit('session_reset', {});
    if (previousFragment) {
      this.bus.emit('fragment_changed', { from: previousFragment, to: null });
    }
  }

  snapshot(): SessionSnapshot {
    return {
      started: this._started,
      fragment: this._fragment,
      visibleChoices: this.visibleChoices,
      visibleHotspots: this.visibleHotspots,
      state: this._state,
      history: [...this._history],
    };
  }

  private pushHistory(fragment: Fragment): void {
    this._history = [
      ...this._history,
      { locationId: fragment.locationId, title: fragment.title || fragment.locationId },
    ];
  }

  /**
   * Dispatch `onTurnResolved` to modules and emit `turn_resolved` on the bus.
   * Used from lifecycle points other than `choose` / `activateHotspot` (entry,
   * resume, dialogue advance) where the bus event alone is not enough — the
   * hook must fire too so modules see every turn, not just choice/hotspot turns.
   */
  private async emitTurnResolved(result: TurnResult): Promise<void> {
    await this.modules.callHook('onTurnResolved', this.context, result);
    this.bus.emit('turn_resolved', { result });
  }
}

export type { ModuleSavePayload, TurnResult, TurnSource };
