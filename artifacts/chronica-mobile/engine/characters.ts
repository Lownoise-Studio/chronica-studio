import { findAssetByName } from './chronica-package';
import type { Character, ProjectAsset, ValidationError } from './types';

export function buildCharacterIndex(characters: readonly Character[]): Map<string, Character> {
  const map = new Map<string, Character>();
  for (const character of characters) {
    const id = character.characterId?.trim();
    if (id) map.set(id, character);
  }
  return map;
}

export function findCharacterById(
  characters: readonly Character[],
  characterId: string | null | undefined,
): Character | undefined {
  const id = characterId?.trim();
  if (!id) return undefined;
  return buildCharacterIndex(characters).get(id);
}

export function resolveCharacterPortrait(
  character: Character,
  expressionId?: string | null,
): string | undefined {
  const exprId = expressionId?.trim();
  if (exprId) {
    const expression = character.expressions?.find(e => e.id === exprId);
    if (expression?.portrait?.trim()) return expression.portrait.trim();
  }
  return character.defaultPortrait?.trim() || undefined;
}

export function portraitAssetExists(assets: readonly ProjectAsset[], portrait?: string): boolean {
  if (!portrait?.trim()) return true;
  const asset = findAssetByName([...assets], portrait.trim());
  return !!asset?.uri?.trim();
}

export function validateCharacters(characters: readonly Character[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const meta = { fragmentUid: '', fragmentTitle: 'Characters' };
  const seen = new Set<string>();

  for (const character of characters) {
    const id = character.characterId?.trim();
    if (!id) {
      errors.push({
        ...meta,
        type: 'missing-character',
        message: `Character "${character.displayName || '(unnamed)'}" is missing a character ID`,
      });
      continue;
    }
    if (seen.has(id)) {
      errors.push({
        ...meta,
        type: 'missing-character',
        message: `Duplicate character ID "${id}"`,
      });
    }
    seen.add(id);

    const expressionIds = new Set<string>();
    for (const expression of character.expressions ?? []) {
      if (!expression.id?.trim()) {
        errors.push({
          ...meta,
          type: 'invalid-dialogue',
          message: `Character "${character.displayName}" has an expression without an ID`,
        });
      } else if (expressionIds.has(expression.id)) {
        errors.push({
          ...meta,
          type: 'invalid-dialogue',
          message: `Character "${character.displayName}" has duplicate expression "${expression.id}"`,
        });
      } else {
        expressionIds.add(expression.id);
      }
    }
  }

  return errors;
}

export function validateCharacterAssetRefs(
  characters: readonly Character[],
  assets: readonly ProjectAsset[],
): ValidationError[] {
  const errors: ValidationError[] = [];
  const meta = { fragmentUid: '', fragmentTitle: 'Characters' };

  for (const character of characters) {
    if (character.defaultPortrait?.trim() && !portraitAssetExists(assets, character.defaultPortrait)) {
      errors.push({
        ...meta,
        type: 'missing-asset',
        message: `Character "${character.displayName}" default portrait "${character.defaultPortrait}" is not in the asset library`,
      });
    }
    for (const expression of character.expressions ?? []) {
      if (expression.portrait?.trim() && !portraitAssetExists(assets, expression.portrait)) {
        errors.push({
          ...meta,
          type: 'missing-asset',
          message: `Character "${character.displayName}" expression "${expression.id}" portrait "${expression.portrait}" is not in the asset library`,
        });
      }
    }
  }

  return errors;
}
