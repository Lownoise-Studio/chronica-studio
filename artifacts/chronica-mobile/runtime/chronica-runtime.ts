import {
  choose as engineChoose,
  activateHotspot as engineActivateHotspot,
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
import { CompiledGame } from '@/engine/compiler/types';
import { Choice, ChronicaState, Fragment, SceneHotspot } from '@/engine/types';
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

  get pathHistory(): HistoryEntry[] {
    return this.history;
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

    const fragment = getActiveFragmentFromIndex(state.location, state, this.game.fragmentIndex);
    this.history = save.history ?? [];
    this.applyTurn(state, fragment);
    this.started = true;
    return { ok: true };
  }

  resume(save: RuntimeSave): boolean {
    return this.tryResume(save).ok;
  }

  advanceDialogue(): AdvanceDialogueResult {
    if (!this.started || !this.state || !this.fragment) {
      return { ok: false, reason: 'not-started' };
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
      return;
    }

    const lines = getFragmentDialogueLines(this.fragment);
    const exhausted = isDialogueExhausted(this.state.dialogueLineIndex, lines.length);
    this._visibleChoices = exhausted ? getVisibleChoices(this.fragment, this.state) : [];
    this._visibleHotspots = exhausted ? getVisibleHotspots(this.fragment, this.state) : [];
  }

  private applyTurn(state: ChronicaState, fragment: Fragment | null): void {
    const prevLocation = this.fragment?.locationId;
    const nextLocation = fragment?.locationId;
    const resetDialogue = this.fragment != null && prevLocation !== nextLocation;

    this.state = {
      ...state,
      dialogueLineIndex: resetDialogue ? 0 : (state.dialogueLineIndex ?? 0),
    };
    this.fragment = fragment;
    this.refreshInteractions();
  }
}
