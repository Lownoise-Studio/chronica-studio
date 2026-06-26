import type { DialogueLine, Fragment } from './types';

export function getFragmentDialogueLines(fragment: Fragment): DialogueLine[] {
  if (fragment.dialogue?.length) {
    return fragment.dialogue.filter(line => line.text !== undefined);
  }
  if (fragment.text?.trim()) {
    return [{ uid: `${fragment.uid}-legacy`, text: fragment.text }];
  }
  return [];
}

export function syncFragmentTextFromDialogue(dialogue: DialogueLine[]): string {
  return dialogue.map(line => line.text).join('\n\n').trim();
}

export function isDialogueExhausted(lineIndex: number, lineCount: number): boolean {
  if (lineCount <= 0) return true;
  return lineIndex >= lineCount - 1;
}

export function canAdvanceDialogue(lineIndex: number, lineCount: number): boolean {
  return lineCount > 1 && lineIndex < lineCount - 1;
}

export function advanceDialogueIndex(lineIndex: number, lineCount: number): number {
  if (lineCount <= 0) return 0;
  return Math.min(lineIndex + 1, lineCount - 1);
}

export function clampDialogueLineIndex(lineIndex: number, lineCount: number): number {
  if (lineCount <= 0) return 0;
  return Math.max(0, Math.min(lineIndex, lineCount - 1));
}
