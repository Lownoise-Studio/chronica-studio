import { resolveSceneBackgroundUri } from './asset-resolver';
import { findCharacterById, resolveCharacterPortrait } from './characters';
import {
  canAdvanceDialogue,
  clampDialogueLineIndex,
  getFragmentDialogueLines,
  isDialogueExhausted,
} from './dialogue';
import type { CompiledGame } from './compiler/types';
import type { Fragment, ProjectAsset } from './types';
import type { Character } from './types';

export type DialoguePresentation = {
  lineIndex: number;
  lineCount: number;
  text: string;
  speakerId?: string;
  speakerName?: string;
  expressionId?: string;
  isNarration: boolean;
  portraitUri?: string;
  canAdvance: boolean;
  exhausted: boolean;
};

function resolvePortraitUri(
  assets: readonly ProjectAsset[],
  portraitName?: string,
): string | undefined {
  if (!portraitName) return undefined;
  return resolveSceneBackgroundUri(assets, portraitName);
}

export function resolveDialoguePresentation(
  fragment: Fragment | null,
  characters: readonly Character[],
  assets: readonly ProjectAsset[],
  lineIndex: number,
): DialoguePresentation | null {
  if (!fragment) return null;

  const lines = getFragmentDialogueLines(fragment);
  if (!lines.length) {
    return {
      lineIndex: 0,
      lineCount: 0,
      text: '',
      isNarration: true,
      canAdvance: false,
      exhausted: true,
    };
  }

  const safeIndex = clampDialogueLineIndex(lineIndex, lines.length);
  const line = lines[safeIndex]!;
  const speakerId = line.speakerId?.trim() || undefined;
  const character = speakerId ? findCharacterById(characters, speakerId) : undefined;
  const portraitName = character
    ? resolveCharacterPortrait(character, line.expressionId)
    : undefined;

  return {
    lineIndex: safeIndex,
    lineCount: lines.length,
    text: line.text,
    speakerId,
    speakerName: character?.displayName,
    expressionId: line.expressionId,
    isNarration: !speakerId,
    portraitUri: resolvePortraitUri(assets, portraitName),
    canAdvance: canAdvanceDialogue(safeIndex, lines.length),
    exhausted: isDialogueExhausted(safeIndex, lines.length),
  };
}

export function resolveDialoguePresentationFromGame(
  game: CompiledGame,
  fragment: Fragment | null,
  lineIndex: number,
): DialoguePresentation | null {
  return resolveDialoguePresentation(fragment, game.characters, game.assets, lineIndex);
}
