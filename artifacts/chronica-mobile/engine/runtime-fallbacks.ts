import {
  DEFAULT_ENTRY_POINT,
  resolveEntryPoint,
} from './adventure';
import { resolveAssetUri, resolveSceneAudioUri, resolveSceneBackgroundUri } from './asset-resolver';
import type {
  AdventureEntry,
  AdventureInteractable,
  ChronicaState,
  Fragment,
  ProjectAsset,
  SceneAdventure,
} from './types';

export type RuntimeFallbackCode =
  | 'missing-background'
  | 'missing-audio'
  | 'missing-player-sprite'
  | 'missing-interactable-sprite'
  | 'missing-sfx'
  | 'missing-player-position';

export interface RuntimeFallbackWarning {
  code: RuntimeFallbackCode;
  reference?: string;
  message: string;
}

/** Player position with safe defaults when save fields are absent. */
export function resolvePlayerPositionSafe(
  state: ChronicaState,
  entry?: AdventureEntry,
): { x: number; y: number; usedDefault: boolean } {
  const hasSaved =
    typeof state.playerX === 'number' &&
    Number.isFinite(state.playerX) &&
    typeof state.playerY === 'number' &&
    Number.isFinite(state.playerY);

  if (hasSaved) {
    return { x: state.playerX!, y: state.playerY!, usedDefault: false };
  }

  const spawn = entry ? resolveEntryPoint(entry, state.lastLocationId) : DEFAULT_ENTRY_POINT;
  return { x: spawn.x, y: spawn.y, usedDefault: true };
}

/** Background URI — undefined when missing; never throws. */
export function resolveBackgroundUriSafe(
  assets: readonly ProjectAsset[],
  backgroundImage?: string,
): string | undefined {
  try {
    return resolveSceneBackgroundUri(assets, backgroundImage);
  } catch {
    return undefined;
  }
}

/** Scene audio URI — undefined when missing; never throws. */
export function resolveAudioUriSafe(
  assets: readonly ProjectAsset[],
  backgroundAudio?: string,
): string | undefined {
  try {
    return resolveSceneAudioUri(assets, backgroundAudio);
  } catch {
    return undefined;
  }
}

/** Interactable sprite URI — undefined when missing; never throws. */
export function resolveInteractableSpriteSafe(
  assets: readonly ProjectAsset[],
  sprite?: string,
): string | undefined {
  const ref = sprite?.trim();
  if (!ref) return undefined;
  try {
    return resolveAssetUri(assets.filter(a => a.type === 'image'), ref);
  } catch {
    return undefined;
  }
}

/** Adventure SFX URI — undefined when missing; never throws. */
export function resolveAdventureSfxUriSafe(
  assets: readonly ProjectAsset[],
  assetName?: string,
): string | undefined {
  const ref = assetName?.trim();
  if (!ref) return undefined;
  try {
    return resolveAssetUri(assets.filter(a => a.type === 'audio'), ref);
  } catch {
    return undefined;
  }
}

function pushMissing(
  warnings: RuntimeFallbackWarning[],
  code: RuntimeFallbackCode,
  reference: string | undefined,
  message: string,
): void {
  warnings.push({ code, reference, message });
}

/** Non-destructive scan of runtime media fallbacks for the active adventure scene. */
export function collectSceneRuntimeFallbacks(
  fragment: Fragment | null | undefined,
  state: ChronicaState | null | undefined,
  assets: readonly ProjectAsset[],
): RuntimeFallbackWarning[] {
  if (!fragment) return [];

  const warnings: RuntimeFallbackWarning[] = [];
  const adventure: SceneAdventure | undefined = fragment.adventure;

  if (fragment.backgroundImage?.trim() && !resolveBackgroundUriSafe(assets, fragment.backgroundImage)) {
    pushMissing(
      warnings,
      'missing-background',
      fragment.backgroundImage,
      `Background "${fragment.backgroundImage}" is unavailable — scene renders without it.`,
    );
  }

  if (fragment.backgroundAudio?.trim() && !resolveAudioUriSafe(assets, fragment.backgroundAudio)) {
    pushMissing(
      warnings,
      'missing-audio',
      fragment.backgroundAudio,
      `Background audio "${fragment.backgroundAudio}" is unavailable — playback is skipped.`,
    );
  }

  if (adventure?.playerSprite?.trim() && !resolveInteractableSpriteSafe(assets, adventure.playerSprite)) {
    pushMissing(
      warnings,
      'missing-player-sprite',
      adventure.playerSprite,
      `Player sprite "${adventure.playerSprite}" is unavailable — placeholder is shown.`,
    );
  }

  for (const interactable of adventure?.interactables ?? []) {
    const sprite = interactable.sprite?.trim();
    if (sprite && !resolveInteractableSpriteSafe(assets, sprite)) {
      pushMissing(
        warnings,
        'missing-interactable-sprite',
        sprite,
        `Interactable "${interactable.label || interactable.uid}" sprite "${sprite}" is unavailable — icon fallback is shown.`,
      );
    }
  }

  for (const [slot, value] of Object.entries(adventure?.sfx ?? {})) {
    const ref = value?.trim();
    if (!ref) continue;
    if (!resolveAdventureSfxUriSafe(assets, ref)) {
      pushMissing(
        warnings,
        'missing-sfx',
        ref,
        `Adventure sfx.${slot} "${ref}" is unavailable — sound is skipped.`,
      );
    }
  }

  if (state && adventure) {
    const hasSaved =
      typeof state.playerX === 'number' &&
      Number.isFinite(state.playerX) &&
      typeof state.playerY === 'number' &&
      Number.isFinite(state.playerY);
    if (!hasSaved) {
      pushMissing(
        warnings,
        'missing-player-position',
        undefined,
        'Player position was missing from save state — entry point default is used.',
      );
    }
  }

  return warnings;
}
