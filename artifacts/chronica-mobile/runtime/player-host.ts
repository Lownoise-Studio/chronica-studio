import { CompiledGame } from '@/engine/compiler/types';
import { resolveSceneAssetIssues } from '@/engine/asset-resolver';
import { DialoguePresentation, resolveDialoguePresentationFromGame } from '@/engine/dialogue-presentation';
import { Choice, ChronicaState, Fragment, SceneHotspot } from '@/engine/types';
import { ChronicaRuntime, ChooseResult, HistoryEntry, RuntimeSave } from './chronica-runtime';
import { ResumeResult } from './validate-runtime-save';

export type PlayerSnapshot = {
  started: boolean;
  state: ChronicaState | null;
  fragment: Fragment | null;
  visibleChoices: Choice[];
  visibleHotspots: SceneHotspot[];
  history: HistoryEntry[];
  backgroundUri: string | undefined;
  audioUri: string | undefined;
  assetWarnings: string[];
  dialogue: DialoguePresentation | null;
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

  activateHotspot(hotspot: SceneHotspot): ChooseResult {
    return this.runtime.activateHotspot(hotspot);
  }

  advanceDialogue() {
    return this.runtime.advanceDialogue();
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
      visibleHotspots: this.runtime.visibleHotspots,
      history: this.runtime.pathHistory,
      backgroundUri: this.runtime.getBackgroundUri(),
      audioUri: this.runtime.getAudioUri(),
      assetWarnings,
      dialogue: resolveDialoguePresentationFromGame(
        this.game,
        fragment,
        this.runtime.runtimeState?.dialogueLineIndex ?? 0,
      ),
    };
  }

  toSave(installId: string): RuntimeSave | null {
    return this.runtime.toSave(installId);
  }
}

export function createPlayerHost(game: CompiledGame): PlayerHost {
  return PlayerHost.create(game);
}
