import AsyncStorage from '@react-native-async-storage/async-storage';
import { RuntimeSave } from './chronica-runtime';

function saveKey(projectId: string): string {
  return `pse_save_${projectId}`;
}

/** Why a runtime save could not be loaded — distinguishes absent from unreadable. */
export type LoadSaveReason =
  | 'no-save'        // no save exists for this project (normal first-run state)
  | 'corrupt-save'   // a save exists but is not parseable JSON
  | 'invalid-save'   // parseable JSON, but not a usable RuntimeSave shape
  | 'storage-error'; // the storage layer itself threw while reading

export type LoadSaveResult =
  | { ok: true; save: RuntimeSave }
  | { ok: false; reason: LoadSaveReason };

/** Structural shape check — deep validity (gameId/contentHash) is checked at resume. */
function isRuntimeSaveShape(value: unknown): value is RuntimeSave {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.gameId === 'string' &&
    !!v.state &&
    typeof v.state === 'object'
  );
}

/**
 * Load a runtime save as a typed result so callers can tell "no save exists"
 * (offer a fresh start) apart from "a save exists but can't be read" (explain
 * that progress could not be restored).
 */
export async function loadRuntimeSaveResult(projectId: string): Promise<LoadSaveResult> {
  let json: string | null;
  try {
    json = await AsyncStorage.getItem(saveKey(projectId));
  } catch {
    return { ok: false, reason: 'storage-error' };
  }

  if (!json) return { ok: false, reason: 'no-save' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, reason: 'corrupt-save' };
  }

  if (!isRuntimeSaveShape(parsed)) {
    return { ok: false, reason: 'invalid-save' };
  }

  return { ok: true, save: parsed };
}

/**
 * Back-compat wrapper: returns the save or null for any failure.
 * Prefer loadRuntimeSaveResult when the failure reason matters to the UI.
 */
export async function loadRuntimeSave(projectId: string): Promise<RuntimeSave | null> {
  const result = await loadRuntimeSaveResult(projectId);
  return result.ok ? result.save : null;
}

export async function persistRuntimeSave(save: RuntimeSave): Promise<void> {
  await AsyncStorage.setItem(saveKey(save.projectId), JSON.stringify(save));
}

/** User-facing message for a load failure (excluding the normal no-save case). */
export function loadSaveFailureMessage(reason: LoadSaveReason): string {
  switch (reason) {
    case 'no-save':
      return 'No saved progress was found.';
    case 'corrupt-save':
    case 'invalid-save':
      return 'Your saved progress could not be restored because the save data is damaged.';
    case 'storage-error':
      return 'Your saved progress could not be read from this device.';
  }
}
