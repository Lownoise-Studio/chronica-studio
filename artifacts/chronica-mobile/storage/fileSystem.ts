/**
 * Storage adapter — wraps expo-file-system legacy API.
 * Isolate all FileSystem calls here so the rest of the app
 * imports from this module only (easy to swap later).
 */
import { File } from 'expo-file-system';
import * as FS from 'expo-file-system/legacy';
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

export async function readBytes(uri: string): Promise<Uint8Array> {
  if (!isNative) throw new Error('readBytes is not available on web');
  const file = new File(toLocalFileUri(uri));
  if (!file.exists) {
    throw new Error('File not found.');
  }
  return file.bytes();
}

/** Local filesystem path suitable for expo-file-system and expo-image. */
export function toLocalFileUri(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return trimmed;
  if (
    trimmed.startsWith('file://') ||
    trimmed.startsWith('content://')
  ) {
    return trimmed;
  }
  if (trimmed.startsWith('/')) {
    return `file://${trimmed}`;
  }
  return trimmed;
}

export async function writeBytes(uri: string, data: Uint8Array): Promise<void> {
  if (!isNative) throw new Error('writeBytes is not available on web');
  const file = new File(toLocalFileUri(uri));
  if (!file.exists) {
    file.create({ overwrite: true });
  }
  file.write(data);
}

export async function fileExists(uri: string): Promise<boolean> {
  if (!isNative) return false;
  const info = await FS.getInfoAsync(uri);
  return info.exists;
}

export function assetDir(projectId: string): string {
  return `${documentDirectory}pse_assets/${projectId}/`;
}
