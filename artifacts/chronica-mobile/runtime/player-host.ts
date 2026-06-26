import { CompiledGame } from '@/engine/compiler/types';
import { resolveSceneAssetIssues } from '@/engine/asset-resolver';
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
  assetWarnings: string[];
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
    const fragment = this.runtime.currentFragment;
    const assetWarnings = fragment
      ? resolveSceneAssetIssues(this.game.assets, fragment).map(issue => {
          if (issue.kind === 'not-in-library') {
            return `${issue.field} "${issue.reference}" is not in the asset library`;
          }
          return `${issue.field} "${issue.reference}" (${issue.assetName}) has no loadable URI`;
        })
      : [];

    return {
      started: this.runtime.isStarted,
      state: this.runtime.runtimeState,
      fragment,
      visibleChoices: this.runtime.visibleChoices,
      history: this.runtime.pathHistory,
      backgroundUri: this.runtime.getBackgroundUri(),
      audioUri: this.runtime.getAudioUri(),
      assetWarnings,
    };
  }

  toSave(installId: string): RuntimeSave | null {
    return this.runtime.toSave(installId);
  }
}

export function createPlayerHost(game: CompiledGame): PlayerHost {
  return PlayerHost.create(game);
}
