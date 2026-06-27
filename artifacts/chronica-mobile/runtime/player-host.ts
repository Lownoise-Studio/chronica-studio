import { CompiledGame } from '@/engine/compiler/types';
import { resolveSceneAssetIssues } from '@/engine/asset-resolver';
import { DialoguePresentation, resolveDialoguePresentationFromGame } from '@/engine/dialogue-presentation';
import { StageActorPresentation, resolveStageActorPresentations } from '@/engine/stage-actors';
import { Choice, ChronicaState, Fragment, SceneHotspot } from '@/engine/types';
import { fileExists } from '@/storage/fileSystem';
import { ChronicaRuntime, HistoryEntry, RuntimeInvariantError, RuntimeSave } from './chronica-runtime';
import {
  AssetWarning,
  AssetWarningField,
  PlayerActionResult,
  PlayerAdvanceDialogueResult,
  PlayerFailureReason,
  RuntimeWarning,
} from './player-action-result';
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
  assetWarnings: AssetWarning[];
  runtimeWarnings: RuntimeWarning[];
  dialogue: DialoguePresentation | null;
  stageActors: StageActorPresentation[];
};

const ASSET_FIELD_LABEL: Record<AssetWarningField, string> = {
  backgroundImage: 'Background',
  backgroundAudio: 'Audio',
  portrait: 'Portrait',
};

function isLocalFileUri(uri: string): boolean {
  return uri.startsWith('file://');
}

/**
 * Thin orchestration layer over ChronicaRuntime for playtest, Load Game, and future standalone players.
 *
 * PlayerHost is the runtime safety boundary: every entry point that can throw
 * (a malformed action, a stale hotspot reference, an out-of-bounds dialogue
 * index) is caught here and turned into a structured PlayerActionResult.
 * React only ever consumes results — it never needs to catch an exception.
 */
export class PlayerHost {
  readonly runtime: ChronicaRuntime;

  /** Uri -> warning, populated by verifyAssets(); consulted by snapshot(). */
  private missingAssets: Map<string, AssetWarning> = new Map();
  private runtimeWarnings: RuntimeWarning[] = [];

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
    this.missingAssets = new Map();
    this.runtimeWarnings = [];
    return this.runtime.start();
  }

  tryResume(save: RuntimeSave): ResumeResult {
    this.missingAssets = new Map();
    this.runtimeWarnings = [];
    try {
      return this.runtime.tryResume(save);
    } catch {
      // Belt-and-suspenders: tryResume already contains its own failures,
      // but a save must never crash the host on resume.
      return { ok: false, reason: 'corrupt-state' };
    }
  }

  choose(choice: Choice): PlayerActionResult {
    this.runtimeWarnings = [];
    try {
      return this.runtime.choose(choice);
    } catch (err) {
      return this.recordFailure(err);
    }
  }

  activateHotspot(hotspot: SceneHotspot): PlayerActionResult {
    this.runtimeWarnings = [];
    try {
      return this.runtime.activateHotspot(hotspot);
    } catch (err) {
      return this.recordFailure(err);
    }
  }

  advanceDialogue(): PlayerAdvanceDialogueResult {
    this.runtimeWarnings = [];
    try {
      return this.runtime.advanceDialogue();
    } catch (err) {
      return this.recordFailure(err);
    }
  }

  setRuntimeState(next: ChronicaState): void {
    this.runtime.setRuntimeState(next);
  }

  /**
   * Verifies on-disk existence of the current scene's referenced assets
   * (background, audio, current dialogue portrait) and caches the result.
   * Missing files are omitted from the next snapshot() rather than crashing
   * presentation — gameplay continues, the asset is just dropped with a warning.
   */
  async verifyAssets(): Promise<void> {
    const fragment = this.runtime.currentFragment;
    const candidates: { uri: string; field: AssetWarningField; reference: string }[] = [];

    const backgroundUri = this.runtime.getBackgroundUri();
    if (backgroundUri) {
      candidates.push({ uri: backgroundUri, field: 'backgroundImage', reference: fragment?.backgroundImage ?? backgroundUri });
    }

    const audioUri = this.runtime.getAudioUri();
    if (audioUri) {
      candidates.push({ uri: audioUri, field: 'backgroundAudio', reference: fragment?.backgroundAudio ?? audioUri });
    }

    const dialogue = this.runtime.getDialoguePresentation();
    if (dialogue?.portraitUri) {
      candidates.push({
        uri: dialogue.portraitUri,
        field: 'portrait',
        reference: dialogue.speakerName ?? dialogue.portraitUri,
      });
    }

    const next = new Map<string, AssetWarning>();
    await Promise.all(candidates.map(async candidate => {
      if (!isLocalFileUri(candidate.uri)) return;
      let exists: boolean;
      try {
        exists = await fileExists(candidate.uri);
      } catch {
        exists = false;
      }
      if (!exists) {
        next.set(candidate.uri, {
          field: candidate.field,
          reference: candidate.reference,
          message: `${ASSET_FIELD_LABEL[candidate.field]} "${candidate.reference}" file is missing on this device.`,
        });
      }
    }));

    this.missingAssets = next;
  }

  snapshot(): PlayerSnapshot {
    const fragment = this.runtime.currentFragment;

    const libraryWarnings: AssetWarning[] = fragment
      ? resolveSceneAssetIssues(this.game.assets, fragment).map(issue => ({
          field: issue.field,
          reference: issue.reference,
          message: issue.kind === 'not-in-library'
            ? `${ASSET_FIELD_LABEL[issue.field]} "${issue.reference}" is not in the asset library.`
            : `${ASSET_FIELD_LABEL[issue.field]} "${issue.reference}" (${issue.assetName}) has no loadable URI.`,
        }))
      : [];

    let backgroundUri = this.runtime.getBackgroundUri();
    let audioUri = this.runtime.getAudioUri();
    let dialogue = resolveDialoguePresentationFromGame(
      this.game,
      fragment,
      this.runtime.runtimeState?.dialogueLineIndex ?? 0,
    );

    const missingWarnings: AssetWarning[] = [];

    if (backgroundUri && this.missingAssets.has(backgroundUri)) {
      missingWarnings.push(this.missingAssets.get(backgroundUri)!);
      backgroundUri = undefined;
    }
    if (audioUri && this.missingAssets.has(audioUri)) {
      missingWarnings.push(this.missingAssets.get(audioUri)!);
      audioUri = undefined;
    }
    if (dialogue?.portraitUri && this.missingAssets.has(dialogue.portraitUri)) {
      missingWarnings.push(this.missingAssets.get(dialogue.portraitUri)!);
      dialogue = { ...dialogue, portraitUri: undefined };
    }

    const stageActors = resolveStageActorPresentations(
      fragment,
      this.runtime.runtimeState,
      this.game.assets,
    ).map(actor => {
      if (actor.spriteUri && this.missingAssets.has(actor.spriteUri)) {
        missingWarnings.push({
          field: 'backgroundImage',
          reference: actor.assetName,
          message: `Sprite "${actor.assetName}" file is missing on this device.`,
        });
        return { ...actor, spriteUri: undefined };
      }
      return actor;
    });

    return {
      started: this.runtime.isStarted,
      state: this.runtime.runtimeState,
      fragment,
      visibleChoices: this.runtime.visibleChoices,
      visibleHotspots: this.runtime.visibleHotspots,
      history: this.runtime.pathHistory,
      backgroundUri,
      audioUri,
      assetWarnings: [...libraryWarnings, ...missingWarnings],
      runtimeWarnings: this.runtimeWarnings,
      dialogue,
      stageActors,
    };
  }

  toSave(installId: string): RuntimeSave | null {
    return this.runtime.toSave(installId);
  }

  private recordFailure(err: unknown): { ok: false; reason: PlayerFailureReason; message: string } {
    const message = err instanceof Error ? err.message : 'Unknown runtime error.';
    const reason: PlayerFailureReason = err instanceof RuntimeInvariantError ? 'runtime-invariant' : 'action-failed';
    this.runtimeWarnings = [...this.runtimeWarnings, { code: reason, message }];
    return { ok: false, reason, message };
  }
}

export function createPlayerHost(game: CompiledGame): PlayerHost {
  return PlayerHost.create(game);
}
