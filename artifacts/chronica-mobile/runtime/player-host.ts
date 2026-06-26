import { CompiledGame } from '@/engine/compiler/types';
import { Choice, ChronicaState, Fragment } from '@/engine/types';
import { ChronicaRuntime, ChooseResult, HistoryEntry, RuntimeSave } from './chronica-runtime';
import { ResumeResult } from './validate-runtime-save';

export type PlayerSnapshot = {
  started: boolean;
  state: ChronicaState | null;
  fragment: Fragment | null;
  visibleChoices: Choice[];
  history: HistoryEntry[];
  backgroundUri: string | undefined;
  audioUri: string | undefined;
};

/**
 * Thin orchestration layer over ChronicaRuntime for playtest, Load Game, and future standalone players.
 */
export class PlayerHost {
  readonly runtime: ChronicaRuntime;

  constructor(game: CompiledGame) {
    this.runtime = new ChronicaRuntime(game);
  }

  static create(game: CompiledGame): PlayerHost {
    return new PlayerHost(game);
  }

  get game(): CompiledGame {
    return this.runtime.game;
  }

  startNew(): boolean {
    return this.runtime.start();
  }

  tryResume(save: RuntimeSave): ResumeResult {
    return this.runtime.tryResume(save);
  }

  choose(choice: Choice): ChooseResult {
    return this.runtime.choose(choice);
  }

  setRuntimeState(next: ChronicaState): void {
    this.runtime.setRuntimeState(next);
  }

  snapshot(): PlayerSnapshot {
    return {
      started: this.runtime.isStarted,
      state: this.runtime.runtimeState,
      fragment: this.runtime.currentFragment,
      visibleChoices: this.runtime.visibleChoices,
      history: this.runtime.pathHistory,
      backgroundUri: this.runtime.getBackgroundUri(),
      audioUri: this.runtime.getAudioUri(),
    };
  }

  toSave(installId: string): RuntimeSave | null {
    return this.runtime.toSave(installId);
  }
}

export function createPlayerHost(game: CompiledGame): PlayerHost {
  return PlayerHost.create(game);
}
