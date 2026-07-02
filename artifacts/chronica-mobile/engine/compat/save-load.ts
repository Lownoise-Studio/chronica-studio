import type { RuntimeSave } from '@/runtime/chronica-runtime';
import { COMPAT_SAVE_VERSION, type CompatSave } from './types';

/**
 * Structural check for a compat save envelope. Depth checks (gameId /
 * contentHash match, module payload usability) happen at
 * {@link ChronicaSession.tryResume} time.
 */
export function isCompatSaveShape(value: unknown): value is CompatSave {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    v.compatVersion === COMPAT_SAVE_VERSION &&
    typeof v.projectId === 'string' &&
    typeof v.gameId === 'string' &&
    typeof v.contentHash === 'string' &&
    !!v.state &&
    typeof v.state === 'object' &&
    Array.isArray(v.history)
  );
}

/**
 * Adapt a legacy {@link RuntimeSave} (produced by ChronicaRuntime.toSave) into
 * the compat envelope. Legacy saves have no per-module payloads.
 */
export function fromRuntimeSave(save: RuntimeSave): CompatSave {
  return {
    compatVersion: COMPAT_SAVE_VERSION,
    projectId: save.projectId,
    gameId: save.gameId,
    contentHash: save.contentHash,
    state: save.state,
    history: [...save.history],
    savedAt: save.savedAt,
  };
}

/**
 * Reduce a compat save back to the shape ChronicaRuntime already understands.
 * Module payloads are dropped — legacy runtime does not know about modules.
 */
export function toRuntimeSave(save: CompatSave): RuntimeSave {
  return {
    projectId: save.projectId,
    gameId: save.gameId,
    contentHash: save.contentHash,
    state: save.state,
    history: [...save.history],
    savedAt: save.savedAt,
  };
}
