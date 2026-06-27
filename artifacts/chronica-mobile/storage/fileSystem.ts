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
  if (!isFileSystemCheckableUri(uri)) {
    throw new Error('readBytes requires a local file URI.');
  }
  const file = new File(normalizeFileSystemUri(uri));
  if (!file.exists) {
    throw new Error('File not found.');
  }
  return file.bytes();
}

/** Local filesystem path suitable for expo-file-system File and expo-image file sources. */
export function toLocalFileUri(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith('file://')) return trimmed;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return `file://${trimmed}`;
  return trimmed;
}

/** True when the URI can be checked with expo-file-system local file APIs. */
export function isFileSystemCheckableUri(uri: string): boolean {
  const trimmed = uri.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('file://')) return true;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return true;
  return false;
}

/** Bundled or platform-managed URIs that load without a local file existence check. */
export function isTrustedResourceUri(uri: string): boolean {
  const trimmed = uri.trim();
  if (!trimmed) return false;
  return (
    trimmed.startsWith('asset://') ||
    trimmed.startsWith('content://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  );
}

function normalizeFileSystemUri(uri: string): string {
  const trimmed = uri.trim();
  if (trimmed.startsWith('file://')) return trimmed;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return `file://${trimmed}`;
  return trimmed;
}

export async function writeBytes(uri: string, data: Uint8Array): Promise<void> {
  if (!isNative) throw new Error('writeBytes is not available on web');
  if (!isFileSystemCheckableUri(uri)) {
    throw new Error('writeBytes requires a local file URI.');
  }
  const file = new File(normalizeFileSystemUri(uri));
  if (!file.exists) {
    file.create({ overwrite: true });
  }
  file.write(data);
}

export async function fileExists(uri: string): Promise<boolean> {
  if (!isNative) return false;
  if (isTrustedResourceUri(uri) || !isFileSystemCheckableUri(uri)) {
    return true;
  }
  try {
    const info = await FS.getInfoAsync(normalizeFileSystemUri(uri));
    return info.exists;
  } catch {
    return false;
  }
}

export function assetDir(projectId: string): string {
  return `${documentDirectory}pse_assets/${projectId}/`;
}
