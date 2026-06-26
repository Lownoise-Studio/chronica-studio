import { Platform } from 'react-native';
import {
  assertPackageSize,
  PackageFileTooLargeError,
  readPackageFileBytes,
} from '@/storage/read-package-file';
import { loadGameFromBytes, type LoadGameImportFns, type LoadGameResult } from '@/engine/load-game';

export type { LoadGameImportFns, LoadGameResult };
export { loadGameFromBytes };

function loadGameError(e: unknown): LoadGameResult {
  if (e instanceof PackageFileTooLargeError) {
    return { ok: false, error: e.message };
  }
  const msg = e instanceof Error ? e.message : 'Could not read file.';
  return { ok: false, error: msg };
}

export async function loadGameFromUri(
  uri: string,
  importFns: LoadGameImportFns,
): Promise<LoadGameResult> {
  try {
    const bytes = await readPackageFileBytes(uri);
    return loadGameFromBytes(bytes, importFns);
  } catch (e: unknown) {
    return loadGameError(e);
  }
}

export async function pickAndLoadGame(importFns: LoadGameImportFns): Promise<LoadGameResult> {
  if (Platform.OS === 'web') {
    return {
      ok: false,
      error: 'Load Game is not available in the web preview. Use the native mobile app.',
    };
  }

  const { getDocumentAsync } = await import('expo-document-picker');
  const result = await getDocumentAsync({
    type: ['application/zip', 'application/json', 'text/plain', 'text/json', '*/*'],
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.length) {
    return { ok: false, error: 'No file selected.', cancelled: true };
  }

  return loadGameFromUri(result.assets[0].uri, importFns);
}

export async function loadGameFromPackageBytes(
  bytes: Uint8Array,
  importFns: LoadGameImportFns,
): Promise<LoadGameResult> {
  try {
    assertPackageSize(bytes);
    return await loadGameFromBytes(bytes, importFns);
  } catch (e: unknown) {
    return loadGameError(e);
  }
}
