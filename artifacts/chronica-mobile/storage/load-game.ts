import { Platform } from 'react-native';
import { loadGameFromBytes, type LoadGameImportFns, type LoadGameResult } from '@/engine/load-game';
import { readBytes } from '@/storage/fileSystem';

export type { LoadGameImportFns, LoadGameResult };
export { loadGameFromBytes };

export async function pickAndLoadGame(importFns: LoadGameImportFns): Promise<LoadGameResult> {
  if (Platform.OS === 'web') {
    return {
      ok: false,
      error: 'Load Game is not available in the web preview. Use the iOS or Android app.',
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

  try {
    const bytes = await readBytes(result.assets[0].uri);
    return loadGameFromBytes(bytes, importFns);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Could not read file.';
    return { ok: false, error: msg };
  }
}
