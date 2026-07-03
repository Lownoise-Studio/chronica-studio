import {
  choose as engineChoose,
  activateHotspot as engineActivateHotspot,
  activateInteractable as engineActivateInteractable,
  deserializeState,
  serializeState,
  startSession,
} from '@/engine/chronica-session';
import { resolveSceneAudioUri, resolveSceneBackgroundUri } from '@/engine/asset-resolver';
import { getActiveFragmentFromIndex } from '@/engine/compiler/fragment-index';
import {
  advanceDialogueIndex,
  canAdvanceDialogue,
  getFragmentDialogueLines,
  isDialogueExhausted,
} from '@/engine/dialogue';
import { resolveDialoguePresentationFromGame } from '@/engine/dialogue-presentation';
import { getVisibleChoices, getVisibleHotspots } from '@/engine/turn-resolver';
import {
  DEFAULT_ADVENTURE_SPEED,
  findInteractableInRange,
  getPlayerPosition,
  getVisibleInteractables,
  movePlayer as computeMovePlayer,
  resolveEntryPoint,
} from '@/engine/adventure';
import { CompiledGame } from '@/engine/compiler/types';
import {
  AdventureInteractable,
  Choice,
  ChronicaState,
  Fragment,
  SceneHotspot,
} from '@/engine/types';
import { ResumeResult, validateRuntimeSave } from './validate-runtime-save';

export type HistoryEntry = { locationId: string; title: string };

export type RuntimeSave = {
  projectId: string;
  gameId: string;
  contentHash: string;
  state: Record<string, unknown>;
  history: HistoryEntry[];
  savedAt: string;
};

export type ChooseResult =
  | { ok: true }
  | { ok: false; reason: 'not-started' | 'dead-end' };

export type AdvanceDialogueResult =
  | { ok: true; advanced: boolean }
  | { ok: false; reason: 'not-started' };

export type AdventureInteractionEvent =
  | { kind: 'interact'; interactableKind: AdventureInteractable['kind']; sfx?: string }
  | { kind: 'pickup'; sfx?: string }
  | { kind: 'transition'; from: string; to: string; sfx?: string };

export type ActivateInteractableResult =
  | { ok: true; events: AdventureInteractionEvent[] }
  | { ok: false; reason: 'not-started' | 'dead-end' };

export type MovePlayerResult =
  | { ok: true; moved: boolean; blocked: boolean; x: number; y: number }
  | { ok: false; reason: 'not-started' | 'no-adventure' };

/**
 * Thrown when a runtime assumption is violated (e.g. a stale hotspot/choice
 * reference, or an out-of-bounds dialogue index). PlayerHost is responsible
 * for catching these and turning them into structured results — they must
 * never escape to a UI event handler as an uncaught exception.
 */
export class RuntimeInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RuntimeInvariantError';
  }
}

/**
 * Runtime host — executes a CompiledGame produced by the compiler.
 * No React or storage dependencies; persistence lives in runtime/save-store.ts.
 */
export class ChronicaRuntime {
  readonly game: CompiledGame;

  private state: ChronicaState | null = null;
  private fragment: Fragment | null = null;
  private _visibleChoices: Choice[] = [];
  private _visibleHotspots: SceneHotspot[] = [];
  private _visibleInteractables: AdventureInteractable[] = [];
  private history: HistoryEntry[] = [];
  private started = false;

  constructor(game: CompiledGame) {
    this.game = game;
  }

  get isStarted(): boolean {
    return this.started;
  }

  get runtimeState(): ChronicaState | null {
    return this.state;
  }

  get currentFragment(): Fragment | null {
    return this.fragment;
  }

  get visibleChoices(): Choice[] {
    return this._visibleChoices;
  }

  get visibleHotspots(): SceneHotspot[] {
    return this._visibleHotspots;
  }

  get visibleInteractables(): AdventureInteractable[] {
    return this._visibleInteractables;
  }

  get pathHistory(): HistoryEntry[] {
    return this.history;
  }

  /** Current player position in 0-1 room coordinates. Falls back to the entry point. */
  getPlayerPosition(): { x: number; y: number } {
    if (!this.state) return { x: 0.5, y: 0.75 };
    return getPlayerPosition(this.state);
  }

  /** Interactable currently in range of the player, or null. */
  getInteractableInRange(): AdventureInteractable | null {
    if (!this.state || !this.fragment?.adventure) return null;
    const pos = getPlayerPosition(this.state);
    return findInteractableInRange(this._visibleInteractables, pos.x, pos.y);
  }

  getBackgroundUri(): string | undefined {
    return resolveSceneBackgroundUri(this.game.assets, this.fragment?.backgroundImage);
  }

  getAudioUri(): string | undefined {
    return resolveSceneAudioUri(this.game.assets, this.fragment?.backgroundAudio);
  }

  getDialoguePresentation() {
    if (!this.state) return null;
    return resolveDialoguePresentationFromGame(
      this.game,
      this.fragment,
      this.state.dialogueLineIndex ?? 0,
    );
  }

  start(): boolean {
    if (!this.game.fragments.length) return false;
    const result = startSession(this.game);
    this.history = result.fragment
      ? [{ locationId: result.fragment.locationId, title: result.fragment.title || result.fragment.locationId }]
      : [];
    this.applyTurn(result.state, result.fragment);
    this.started = true;
    return true;
  }

  tryResume(save: RuntimeSave): ResumeResult {
    const validation = validateRuntimeSave(save, this.game);
    if (!validation.ok) return validation;

    const state = deserializeState(save.state);
    if (!state) return { ok: false, reason: 'corrupt-state' };

    try {
      const fragment = getActiveFragmentFromIndex(state.location, state, this.game.fragmentIndex);
      this.history = save.history ?? [];
      this.applyTurn(state, fragment, { preservePlayer: true });
      this.started = true;
      return { ok: true };
    } catch {
      // Defensive: a malformed-but-parseable save (e.g. variables of the wrong
      // type) must not crash resume — treat it as corrupt rather than throwing.
      return { ok: false, reason: 'corrupt-state' };
    }
  }

  resume(save: RuntimeSave): boolean {
    return this.tryResume(save).ok;
  }

  advanceDialogue(): AdvanceDialogueResult {
    if (!this.started || !this.state || !this.fragment) {
      return { ok: false, reason: 'not-started' };
    }
    if (!Number.isFinite(this.state.dialogueLineIndex) || this.state.dialogueLineIndex < 0) {
      throw new RuntimeInvariantError('Dialogue line index is out of bounds.');
    }

    const lines = getFragmentDialogueLines(this.fragment);
    if (!canAdvanceDialogue(this.state.dialogueLineIndex, lines.length)) {
      return { ok: true, advanced: false };
    }

    this.state = {
      ...this.state,
      dialogueLineIndex: advanceDialogueIndex(this.state.dialogueLineIndex, lines.length),
    };
    this.refreshInteractions();
    return { ok: true, advanced: true };
  }

  choose(choice: Choice): ChooseResult {
    if (!this.started || !this.state) {
      return { ok: false, reason: 'not-started' };
    }
    if (!this.fragment) {
      throw new RuntimeInvariantError('No active fragment to resolve a choice against.');
    }
    if (!(choice.uid in this.game.choiceActions)) {
      throw new RuntimeInvariantError(`Choice "${choice.uid}" has no compiled action in this game.`);
    }
    const result = engineChoose(choice, this.state, this.game);
    if (!result.fragment) {
      return { ok: false, reason: 'dead-end' };
    }
    this.history = [
      ...this.history,
      {
        locationId: result.fragment.locationId,
        title: result.fragment.title || result.fragment.locationId,
      },
    ];
    this.applyTurn(this.state, result.fragment);
    return { ok: true };
  }

  activateHotspot(hotspot: SceneHotspot): ChooseResult {
    if (!this.started || !this.state) {
      return { ok: false, reason: 'not-started' };
    }
    if (!this.fragment) {
      throw new RuntimeInvariantError('No active fragment to resolve a hotspot against.');
    }
    if (!this.fragment.hotspots?.some(h => h.uid === hotspot.uid)) {
      throw new RuntimeInvariantError(`Hotspot "${hotspot.uid}" does not belong to the active fragment.`);
    }
    if (!(hotspot.uid in this.game.hotspotActions)) {
      throw new RuntimeInvariantError(`Hotspot "${hotspot.uid}" has no compiled action in this game.`);
    }
    const result = engineActivateHotspot(hotspot, this.state, this.game);
    if (!result.fragment) {
      return { ok: false, reason: 'dead-end' };
    }
    const locationChanged = result.fragment.locationId !== this.fragment?.locationId;
    if (locationChanged) {
      this.history = [
        ...this.history,
        {
          locationId: result.fragment.locationId,
          title: result.fragment.title || result.fragment.locationId,
        },
      ];
    }
    this.applyTurn(this.state, result.fragment);
    return { ok: true };
  }

  /** Advanced debug: replace runtime state and refresh visible interactions. */
  setRuntimeState(next: ChronicaState): void {
    this.state = { ...next, dialogueLineIndex: next.dialogueLineIndex ?? 0 };
    this.refreshInteractions();
  }

  toSave(projectId: string): RuntimeSave | null {
    if (!this.state) return null;
    return {
      projectId,
      gameId: this.game.gameId,
      contentHash: this.game.contentHash,
      state: JSON.parse(serializeState(this.state)),
      history: this.pathHistory,
      savedAt: new Date().toISOString(),
    };
  }

  private refreshInteractions(): void {
    if (!this.state || !this.fragment) {
      this._visibleChoices = [];
      this._visibleHotspots = [];
      this._visibleInteractables = [];
      return;
    }

    const lines = getFragmentDialogueLines(this.fragment);
    const exhausted = isDialogueExhausted(this.state.dialogueLineIndex, lines.length);
    this._visibleChoices = exhausted ? getVisibleChoices(this.fragment, this.state) : [];
    this._visibleHotspots = exhausted ? getVisibleHotspots(this.fragment, this.state) : [];
    this._visibleInteractables = this.fragment.adventure
      ? getVisibleInteractables(this.fragment, this.state)
      : [];
  }

  private applyTurn(
    state: ChronicaState,
    fragment: Fragment | null,
    opts: { preservePlayer?: boolean } = {},
  ): void {
    const resetDialogue =
      this.fragment != null &&
      (this.fragment.locationId !== fragment?.locationId ||
        this.fragment.uid !== fragment?.uid);
    const changedFragment =
      this.fragment == null ||
      this.fragment.uid !== fragment?.uid ||
      this.fragment.locationId !== fragment?.locationId;

    const previousLocation = this.fragment?.locationId;

    let nextState: ChronicaState = {
      ...state,
      dialogueLineIndex: resetDialogue ? 0 : (state.dialogueLineIndex ?? 0),
    };

    if (fragment?.adventure && changedFragment && !opts.preservePlayer) {
      const spawn = resolveEntryPoint(fragment.adventure.entry, previousLocation);
      nextState = {
        ...nextState,
        playerX: spawn.x,
        playerY: spawn.y,
        lastLocationId: previousLocation,
      };
    }

    this.state = nextState;
    this.fragment = fragment;
    this.refreshInteractions();
  }

  /** Move the player by (dx, dy) in normalized units, respecting collisions. */
  movePlayer(dx: number, dy: number): MovePlayerResult {
    if (!this.started || !this.state) {
      return { ok: false, reason: 'not-started' };
    }
    if (!this.fragment?.adventure) {
      return { ok: false, reason: 'no-adventure' };
    }
    const result = computeMovePlayer(this.fragment, this.state, dx, dy);
    this.state = { ...this.state, playerX: result.x, playerY: result.y };
    return { ok: true, moved: result.moved, blocked: result.blocked, x: result.x, y: result.y };
  }

  /** Move using seconds elapsed; internally scales by the scene speed. */
  movePlayerByDelta(dxNorm: number, dyNorm: number, seconds: number): MovePlayerResult {
    const speed = this.fragment?.adventure?.speed ?? DEFAULT_ADVENTURE_SPEED;
    return this.movePlayer(dxNorm * speed * seconds, dyNorm * speed * seconds);
  }

  activateInteractable(interactable: AdventureInteractable): ActivateInteractableResult {
    if (!this.started || !this.state) {
      return { ok: false, reason: 'not-started' };
    }
    if (!this.fragment?.adventure) {
      throw new RuntimeInvariantError('No adventure fragment to resolve an interactable against.');
    }
    if (!this.fragment.adventure.interactables?.some(i => i.uid === interactable.uid)) {
      throw new RuntimeInvariantError(
        `Interactable "${interactable.uid}" does not belong to the active fragment.`,
      );
    }
    if (!(interactable.uid in this.game.interactableActions)) {
      throw new RuntimeInvariantError(
        `Interactable "${interactable.uid}" has no compiled action in this game.`,
      );
    }

    const previousLocation = this.fragment.locationId;
    const sfxSet = this.fragment.adventure.sfx;
    const events: AdventureInteractionEvent[] = [];

    const result = engineActivateInteractable(interactable, this.state, this.game);
    if (!result.fragment) {
      return { ok: false, reason: 'dead-end' };
    }

    const targetLocation = result.fragment.locationId;
    const locationChanged = targetLocation !== previousLocation;

    events.push({
      kind: 'interact',
      interactableKind: interactable.kind,
      sfx: interactable.sfx ?? sfxSet?.interact,
    });
    if (interactable.kind === 'pickup') {
      events.push({ kind: 'pickup', sfx: interactable.sfx ?? sfxSet?.pickup });
    }
    if (locationChanged) {
      events.push({
        kind: 'transition',
        from: previousLocation,
        to: targetLocation,
        sfx: result.fragment.adventure?.sfx?.transition ?? sfxSet?.transition,
      });
      this.history = [
        ...this.history,
        {
          locationId: result.fragment.locationId,
          title: result.fragment.title || result.fragment.locationId,
        },
      ];
    }
    this.applyTurn(this.state, result.fragment);
    return { ok: true, events };
  }
}
