/**
 * Storage adapter — wraps expo-file-system legacy API.
 * Isolate all FileSystem calls here so the rest of the app
 * imports from this module only (easy to swap later).
 */
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

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export async function readBytes(uri: string): Promise<Uint8Array> {
  if (!isNative) throw new Error('readBytes is not available on web');
  const b64 = await FS.readAsStringAsync(uri, { encoding: FS.EncodingType.Base64 });
  return base64ToBytes(b64);
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
  const fileUri = toLocalFileUri(uri);
  await FS.writeAsStringAsync(fileUri, bytesToBase64(data), { encoding: FS.EncodingType.Base64 });
}

export async function fileExists(uri: string): Promise<boolean> {
  if (!isNative) return false;
  const info = await FS.getInfoAsync(uri);
  return info.exists;
}

export function assetDir(projectId: string): string {
  return `${documentDirectory}pse_assets/${projectId}/`;
}
