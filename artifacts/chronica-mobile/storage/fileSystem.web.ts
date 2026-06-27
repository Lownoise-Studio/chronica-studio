/**
 * Web stub for the file-system storage adapter.
 * All file operations are no-ops on web — only native (Android/iOS) has real FS.
 */
import type { FileSystemOperation } from '@/storage/fileSystem';

export type { FileSystemOperation };

export function logFileSystemAccess(_operation: string, _uri: string): void {}

export const documentDirectory: string = '';

export async function ensureDir(_dir: string): Promise<void> {}

export async function copyFile(_from: string, _to: string): Promise<void> {}

export async function deleteFile(_uri: string): Promise<void> {}

export async function readText(_uri: string): Promise<string> {
  return '(file preview not available on web)';
}

export async function readBytes(_uri: string): Promise<Uint8Array> {
  return new Uint8Array();
}

export async function readPickableBytes(_uri: string): Promise<Uint8Array> {
  return new Uint8Array();
}

export async function writeBytes(_uri: string, _data: Uint8Array): Promise<void> {}

export function toLocalFileUri(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith('file://')) return trimmed;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return `file://${trimmed}`;
  return trimmed;
}

export function isFileSystemCheckableUri(uri: string): boolean {
  const trimmed = uri.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('file:')) return true;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return true;
  return false;
}

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

export function shouldSkipFilesystemExistenceCheck(uri: string): boolean {
  return isTrustedResourceUri(uri) || !isFileSystemCheckableUri(uri);
}

export async function fileExists(uri: string): Promise<boolean> {
  if (shouldSkipFilesystemExistenceCheck(uri)) return true;
  return false;
}

export function assetDir(_projectId: string): string {
  return '';
}
