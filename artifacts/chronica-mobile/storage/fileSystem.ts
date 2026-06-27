/**
 * Storage adapter — wraps expo-file-system legacy API.
 * Isolate all FileSystem calls here so the rest of the app
 * imports from this module only (easy to swap later).
 */
import { File } from 'expo-file-system';
import * as FS from 'expo-file-system/legacy';
import { Platform } from 'react-native';

const isNative = Platform.OS !== 'web';

export type FileSystemOperation =
  | 'fileExists'
  | 'readBytes'
  | 'writeBytes'
  | 'readText'
  | 'copyFile'
  | 'deleteFile'
  | 'ensureDir'
  | 'readPickableBytes';

/** Dev-only trace of filesystem access — surfaces bad URIs on device. */
export function logFileSystemAccess(operation: string, uri: string): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn(`[ChronicaFS] ${operation}: ${uri}`);
  }
}

export const documentDirectory: string = isNative ? (FS.documentDirectory ?? '') : '';

export async function ensureDir(dir: string): Promise<void> {
  if (!isNative) return;
  logFileSystemAccess('ensureDir', dir);
  await FS.makeDirectoryAsync(dir, { intermediates: true });
}

export async function copyFile(from: string, to: string): Promise<void> {
  if (!isNative) return;
  logFileSystemAccess('copyFile', `${from} -> ${to}`);
  await FS.copyAsync({ from, to });
}

export async function deleteFile(uri: string): Promise<void> {
  if (!isNative) return;
  logFileSystemAccess('deleteFile', uri);
  await FS.deleteAsync(uri, { idempotent: true });
}

export async function readText(uri: string): Promise<string> {
  if (!isNative) return '(file preview not available on web)';
  logFileSystemAccess('readText', uri);
  return FS.readAsStringAsync(uri);
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

/** True when Expo File / getInfoAsync existence probes must be skipped. */
export function shouldSkipFilesystemExistenceCheck(uri: string): boolean {
  return isTrustedResourceUri(uri) || !isFileSystemCheckableUri(uri);
}

function normalizeFileSystemUri(uri: string): string {
  const trimmed = uri.trim();
  if (trimmed.startsWith('file://')) return trimmed;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return `file://${trimmed}`;
  return trimmed;
}

function decodeBase64(base64: string): Uint8Array {
  if (typeof globalThis.atob !== 'function') {
    throw new Error('Base64 decoding is unavailable in this runtime.');
  }
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function openLocalFile(uri: string, operation: FileSystemOperation): File {
  if (!isFileSystemCheckableUri(uri)) {
    throw new Error(`${operation} requires a local file URI; received "${uri}".`);
  }
  const normalized = normalizeFileSystemUri(uri);
  logFileSystemAccess(operation, normalized);
  return new File(normalized);
}

export async function readBytes(uri: string): Promise<Uint8Array> {
  if (!isNative) throw new Error('readBytes is not available on web');
  if (!isFileSystemCheckableUri(uri)) {
    throw new Error('readBytes requires a local file URI.');
  }
  const file = openLocalFile(uri, 'readBytes');
  if (!file.exists) {
    throw new Error('File not found.');
  }
  return file.bytes();
}

/**
 * Read bytes from a document-picker or share URI (file:// or content://).
 * Never probes Expo File.exists on non-local schemes.
 */
export async function readPickableBytes(uri: string): Promise<Uint8Array> {
  if (!isNative) throw new Error('readPickableBytes is not available on web');
  const trimmed = uri.trim();
  if (isFileSystemCheckableUri(trimmed)) {
    return readBytes(trimmed);
  }

  logFileSystemAccess('readPickableBytes', trimmed);
  try {
    return decodeBase64(await FS.readAsStringAsync(trimmed, { encoding: FS.EncodingType.Base64 }));
  } catch {
    throw new Error('Could not read the selected file.');
  }
}

export async function writeBytes(uri: string, data: Uint8Array): Promise<void> {
  if (!isNative) throw new Error('writeBytes is not available on web');
  if (!isFileSystemCheckableUri(uri)) {
    throw new Error('writeBytes requires a local file URI.');
  }
  const file = openLocalFile(uri, 'writeBytes');
  if (!file.exists) {
    file.create({ overwrite: true });
  }
  file.write(data);
}

export async function fileExists(uri: string): Promise<boolean> {
  if (!isNative) return false;
  if (shouldSkipFilesystemExistenceCheck(uri)) {
    logFileSystemAccess('fileExists:skip', uri);
    return true;
  }
  logFileSystemAccess('fileExists', uri);
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
