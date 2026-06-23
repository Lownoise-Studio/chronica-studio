import {
  choose as engineChoose,
  deserializeState,
  serializeState,
  startSession,
} from '@/engine/chronica-session';
import { resolveSceneAudioUri, resolveSceneBackgroundUri } from '@/engine/asset-resolver';
import { getActiveFragment } from '@/engine/fragment-store';
import { getVisibleChoices } from '@/engine/turn-resolver';
import { Choice, ChronicaState, Fragment, Project } from '@/engine/types';

export type HistoryEntry = { locationId: string; title: string };

export type RuntimeSave = {
  projectId: string;
  state: Record<string, unknown>;
  history: HistoryEntry[];
  savedAt: string;
};

export type ChooseResult =
  | { ok: true }
  | { ok: false; reason: 'not-started' | 'dead-end' };

/** Resolve the location id used when starting a new session. */
export function resolveStartLocation(project: Project): string {
  if (!project.fragments.length) return project.startLocation?.trim() ?? '';
  const configured = project.startLocation?.trim();
  if (configured && project.fragments.some(f => f.locationId === configured)) {
    return configured;
  }
  return project.fragments[0].locationId;
}

/**
 * Runtime host — orchestrates engine session APIs for playtest and Load Game.
 * No React or storage dependencies; persistence lives in runtime/save-store.ts.
 */
export class ChronicaRuntime {
  readonly project: Project;

  private state: ChronicaState | null = null;
  private fragment: Fragment | null = null;
  private _visibleChoices: Choice[] = [];
  private history: HistoryEntry[] = [];
  private started = false;

  constructor(project: Project) {
    this.project = project;
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

  get pathHistory(): HistoryEntry[] {
    return this.history;
  }

  getBackgroundUri(): string | undefined {
    return resolveSceneBackgroundUri(this.project.assets, this.fragment?.backgroundImage);
  }

  getAudioUri(): string | undefined {
    return resolveSceneAudioUri(this.project.assets, this.fragment?.backgroundAudio);
  }

  start(): boolean {
    if (!this.project.fragments.length) return false;
    const startLoc = resolveStartLocation(this.project);
    const result = startSession(
      startLoc,
      this.project.fragments,
      this.project.initialVariables ?? {},
      this.project.initialMemory ?? {},
    );
    this.history = result.fragment
      ? [{ locationId: result.fragment.locationId, title: result.fragment.title || result.fragment.locationId }]
      : [];
    this.applyTurn(result.state, result.fragment, result.visibleChoices);
    this.started = true;
    return true;
  }

  resume(save: RuntimeSave): boolean {
    const state = deserializeState(save.state);
    if (!state) return false;
    const fragment = getActiveFragment(state.location, state, this.project.fragments);
    const choices = fragment ? getVisibleChoices(fragment, state) : [];
    this.history = save.history ?? [];
    this.applyTurn(state, fragment, choices);
    this.started = true;
    return true;
  }

  choose(choice: Choice): ChooseResult {
    if (!this.started || !this.state) {
      return { ok: false, reason: 'not-started' };
    }
    const result = engineChoose(choice, this.state, this.project.fragments);
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
    this.applyTurn(this.state, result.fragment, result.visibleChoices);
    return { ok: true };
  }

  /** Advanced debug: replace runtime state and refresh visible choices. */
  setRuntimeState(next: ChronicaState): void {
    this.state = { ...next };
    if (this.fragment) {
      this._visibleChoices = getVisibleChoices(this.fragment, this.state);
    }
  }

  toSave(projectId: string): RuntimeSave | null {
    if (!this.state) return null;
    return {
      projectId,
      state: JSON.parse(serializeState(this.state)),
      history: this.pathHistory,
      savedAt: new Date().toISOString(),
    };
  }

  private applyTurn(state: ChronicaState, fragment: Fragment | null, choices: Choice[]): void {
    this.state = { ...state };
    this.fragment = fragment;
    this._visibleChoices = choices;
  }
}
