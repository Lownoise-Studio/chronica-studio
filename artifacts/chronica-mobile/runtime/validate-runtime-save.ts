import { CompiledGame } from '@/engine/compiler/types';
import { RuntimeSave } from './chronica-runtime';

export type ResumeRejectionReason = 'wrong-game' | 'stale-content' | 'corrupt-state';

export type ResumeResult =
  | { ok: true }
  | { ok: false; reason: ResumeRejectionReason };

/** Verify a save belongs to this compiled game and matches current project content. */
export function validateRuntimeSave(save: RuntimeSave, game: CompiledGame): ResumeResult {
  if (!save.gameId?.trim() || save.gameId !== game.gameId) {
    return { ok: false, reason: 'wrong-game' };
  }
  if (!save.contentHash?.trim() || save.contentHash !== game.contentHash) {
    return { ok: false, reason: 'stale-content' };
  }
  if (!save.state || typeof save.state !== 'object') {
    return { ok: false, reason: 'corrupt-state' };
  }
  return { ok: true };
}

export function resumeRejectionMessage(reason: ResumeRejectionReason): string {
  switch (reason) {
    case 'wrong-game':
      return 'This save belongs to a different game.';
    case 'stale-content':
      return 'This project was edited after your save was created.';
    case 'corrupt-state':
      return 'The save data could not be read.';
  }
}
