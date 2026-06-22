/**
 * Storage adapter — wraps expo-file-system legacy API.
 * Isolate all FileSystem calls here so the rest of the app
 * imports from this module only (easy to swap later).
 */
import * as FS from 'expo-file-system/build/legacy';
import { Platform } from 'react-native';

const isNative = Platform.OS !== 'web';

export const documentDirectory: string = isNative ? (FS.documentDirectory ?? '') : '';

export async function ensureDir(dir: string): Promise<void> {
  if (!isNative) return;
  await FS.makeDirectoryAsync(dir, { intermediates: true });
}

export async function copyFile(from: string, to: string): Promise<void> {
  if (!isNative) return;
  await FS.copyAsync({ from, to });
}

export async function deleteFile(uri: string): Promise<void> {
  if (!isNative) return;
  await FS.deleteAsync(uri, { idempotent: true });
}

export async function readText(uri: string): Promise<string> {
  if (!isNative) return '(file preview not available on web)';
  return FS.readAsStringAsync(uri);
}

export function assetDir(projectId: string): string {
  return `${documentDirectory}pse_assets/${projectId}/`;
}
