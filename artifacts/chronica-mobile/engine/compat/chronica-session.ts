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
import { ChronicaState } from './chronica-state';
import { ChronicaEventBus } from './event-bus';
import { ExpressionEvaluator } from './expression-evaluator';
import { FragmentStore } from './fragment-store';
import type { RuntimeModule } from './module';
import { ModuleRegistry } from './module-registry';
import { TurnResolver } from './turn-resolver';
import {
  COMPAT_SAVE_VERSION,
  type CompatSave,
  type ModuleSavePayload,
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
  | { ok: true; fragment: Fragment | null }
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
 * Top-level compat facade for a Chronica play session. Mirrors the Godot
 * engine's `ChronicaSession` object shape: owns `ChronicaState`,
 * `FragmentStore`, `TurnResolver`, `ExpressionEvaluator`, `ActionResolver`,
 * an `EventBus`, and an optional `ModuleRegistry`.
 *
 * This class does NOT replace {@link ChronicaRuntime}; it is a parallel
 * object-oriented surface that composes the same pure engine functions. The
 * existing runtime + PlayerHost pipeline continues to power playtest and
 * Load Game today; the compat layer is the target for future portability with
 * the main engine's `.chronica` runtime.
 */
export class ChronicaSession {
  readonly game: CompiledGame;
  readonly bus: ChronicaEventBus = new ChronicaEventBus();
  readonly evaluator: ExpressionEvaluator = new ExpressionEvaluator();
  readonly actions: ActionResolver = new ActionResolver();
  readonly fragments: FragmentStore;
  readonly turns: TurnResolver;
  readonly modules: ModuleRegistry;

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
    this.modules = new ModuleRegistry(game, this._state.raw);
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

  attachModule(module: RuntimeModule): void {
    this.modules.attach(module);
  }

  detachModule(moduleId: string): boolean {
    return this.modules.detach(moduleId);
  }

  /** Bootstrap a new session: reset state, enter startLocation, apply entry effects. */
  start(): boolean {
    if (!this.game.fragments.length) return false;

    const nextState = new ChronicaState(
      createInitialState(
        this.game.startLocation,
        this.game.initialVariables,
        this.game.initialMemory,
      ),
    );
    this._state = nextState;
    this.modules.setContext(this.game, nextState.raw);

    const fragment = this.fragments.active(this.game.startLocation, nextState.raw);
    if (fragment) {
      for (const effect of fragment.effects) applyEffect(effect, nextState.raw);
    }

    this._fragment = fragment;
    this._history = fragment
      ? [{ locationId: fragment.locationId, title: fragment.title || fragment.locationId }]
      : [];
    this._started = true;

    this.bus.emit('session-start', { fragment });
    this.bus.emit('fragment-changed', { from: null, to: fragment });
    this.bus.emit('state-changed', { state: nextState.raw });
    this.modules.dispatchSessionStart({ fragment });
    this.emitTurnResolved(fragment, 'entry');
    return true;
  }

  choose(choice: Choice): SessionChooseResult {
    if (!this._started) return { ok: false, reason: 'not-started' };
    if (!(choice.uid in this.game.choiceActions)) {
      return { ok: false, reason: 'unknown-action' };
    }

    const previous = this._fragment;
    this.bus.emit('choice-selected', { choice });
    const fragment = this.turns.applyChoice(choice, this._state.raw);
    if (!fragment) return { ok: false, reason: 'dead-end' };

    this.pushHistory(fragment);
    this.setFragment(previous, fragment);
    this.modules.dispatchChoiceResolved({ choice, fragment });
    this.emitTurnResolved(fragment, 'choice');
    return { ok: true, fragment };
  }

  activateHotspot(hotspot: SceneHotspot): SessionChooseResult {
    if (!this._started) return { ok: false, reason: 'not-started' };
    if (!(hotspot.uid in this.game.hotspotActions)) {
      return { ok: false, reason: 'unknown-action' };
    }

    const previous = this._fragment;
    this.bus.emit('hotspot-activated', { hotspot });
    const fragment = this.turns.applyHotspot(hotspot, this._state.raw);
    if (!fragment) return { ok: false, reason: 'dead-end' };

    if (previous?.locationId !== fragment.locationId) {
      this.pushHistory(fragment);
    }
    this.setFragment(previous, fragment);
    this.modules.dispatchHotspotResolved({ hotspot, fragment });
    this.emitTurnResolved(fragment, 'hotspot');
    return { ok: true, fragment };
  }

  advanceDialogue(): SessionAdvanceDialogueResult {
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
    this.bus.emit('dialogue-advanced', { fromIndex: index, toIndex: next });
    this.bus.emit('state-changed', { state: this._state.raw });
    this.emitTurnResolved(this._fragment, 'dialogue');
    return { ok: true, advanced: true };
  }

  /** True when the current fragment's dialogue script has been fully advanced. */
  isDialogueExhausted(): boolean {
    if (!this._fragment) return true;
    const lines = getFragmentDialogueLines(this._fragment);
    return isDialogueExhausted(this._state.dialogueLineIndex, lines.length);
  }

  toSave(projectId: string): CompatSave | null {
    if (!this._started) return null;
    const modulePayloads = this.modules.serialize();
    const save: CompatSave = {
      compatVersion: COMPAT_SAVE_VERSION,
      projectId,
      gameId: this.game.gameId,
      contentHash: this.game.contentHash,
      state: JSON.parse(serializeState(this._state.raw)),
      history: [...this._history],
      savedAt: new Date().toISOString(),
    };
    if (modulePayloads) {
      save.modules = modulePayloads;
    }
    this.bus.emit('save-created', { moduleIds: Object.keys(modulePayloads ?? {}) });
    return save;
  }

  tryResume({ save }: SessionResumeInput): SessionResumeResult {
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

    this._state = restored;
    this.modules.setContext(this.game, restored.raw);
    this.modules.deserialize(save.modules);
    this._fragment = fragment;
    this._history = save.history ? [...save.history] : [];
    this._started = true;

    this.bus.emit('session-resume', { fragment });
    this.bus.emit('fragment-changed', { from: null, to: fragment });
    this.bus.emit('state-changed', { state: restored.raw });
    this.modules.dispatchSessionResume({ fragment });
    this.emitTurnResolved(fragment, 'resume');
    return { ok: true, fragment };
  }

  reset(): void {
    this._state = new ChronicaState(
      createInitialState(
        this.game.startLocation,
        this.game.initialVariables,
        this.game.initialMemory,
      ),
    );
    this.modules.setContext(this.game, this._state.raw);
    this._fragment = null;
    this._history = [];
    this._started = false;
    this.bus.emit('session-reset', {});
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

  private setFragment(previous: Fragment | null, next: Fragment | null): void {
    const changed = previous?.uid !== next?.uid || previous?.locationId !== next?.locationId;
    this._fragment = next;
    if (changed) {
      this.bus.emit('fragment-changed', { from: previous, to: next });
    }
    this.bus.emit('state-changed', { state: this._state.raw });
  }

  private emitTurnResolved(fragment: Fragment | null, source: TurnSource): void {
    this.bus.emit('turn-resolved', { fragment, source });
    this.modules.dispatchTurnResolved({ fragment, source });
  }
}

export type { ModuleSavePayload };
