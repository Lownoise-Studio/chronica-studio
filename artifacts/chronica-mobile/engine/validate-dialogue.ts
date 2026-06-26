import { findCharacterById } from './characters';
import { getFragmentDialogueLines } from './dialogue';
import type { Character, DialogueLine, Fragment, ValidationError } from './types';

export function validateFragmentDialogue(
  fragment: Fragment,
  characters: readonly Character[],
): ValidationError[] {
  const errors: ValidationError[] = [];
  const meta = { fragmentUid: fragment.uid, fragmentTitle: fragment.title || fragment.locationId };
  const lines = getFragmentDialogueLines(fragment);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line.text?.trim()) {
      errors.push({
        ...meta,
        type: 'invalid-dialogue',
        message: `Dialogue line ${i + 1} is empty`,
      });
    }

    const speakerId = line.speakerId?.trim();
    if (speakerId && !findCharacterById(characters, speakerId)) {
      errors.push({
        ...meta,
        type: 'missing-character',
        message: `Dialogue line ${i + 1} references unknown character "${speakerId}"`,
      });
    }

    if (speakerId && line.expressionId?.trim()) {
      const character = findCharacterById(characters, speakerId);
      const expression = character?.expressions?.find(e => e.id === line.expressionId?.trim());
      if (!expression) {
        errors.push({
          ...meta,
          type: 'invalid-dialogue',
          message: `Dialogue line ${i + 1} references unknown expression "${line.expressionId}" for "${speakerId}"`,
        });
      }
    }
  }

  return errors;
}

export function normalizeDialogueLines(lines: DialogueLine[]): DialogueLine[] {
  return lines.map(line => ({
    ...line,
    speakerId: line.speakerId?.trim() ? line.speakerId.trim() : null,
    expressionId: line.expressionId?.trim() || undefined,
    text: line.text ?? '',
  }));
}
