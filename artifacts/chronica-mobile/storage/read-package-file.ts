import { File } from 'expo-file-system';

import { toLocalFileUri } from '@/storage/fileSystem';

/** Maximum .chronica package size the player will load into memory. */
export const MAX_CHRONICA_PACKAGE_BYTES = 100 * 1024 * 1024;

export class PackageFileTooLargeError extends Error {
  readonly name = 'PackageFileTooLargeError';

  constructor(
    public readonly sizeBytes: number,
    public readonly maxBytes: number,
  ) {
    super(formatPackageTooLargeMessage(sizeBytes, maxBytes));
  }
}

export function formatPackageTooLargeMessage(sizeBytes: number, maxBytes: number): string {
  const sizeMb = (sizeBytes / (1024 * 1024)).toFixed(1);
  const maxMb = Math.round(maxBytes / (1024 * 1024));
  return `This game package is too large (${sizeMb} MB). Chronica Player supports packages up to ${maxMb} MB.`;
}

export function assertPackageSize(bytes: Uint8Array, maxBytes = MAX_CHRONICA_PACKAGE_BYTES): void {
  if (bytes.byteLength > maxBytes) {
    throw new PackageFileTooLargeError(bytes.byteLength, maxBytes);
  }
}

function resolveFileSize(file: File): number | null {
  try {
    const info = file.info();
    if (typeof info.size === 'number' && info.size >= 0) {
      return info.size;
    }
  } catch {
    // Fall through — read may still succeed without a known size.
  }
  return null;
}

/**
 * Read a picked or shared game file as raw bytes (ZIP package or JSON backup).
 * Uses expo-file-system File.bytes() — no base64 string allocation.
 */
export async function readPackageFileBytes(uri: string): Promise<Uint8Array> {
  const file = new File(toLocalFileUri(uri));

  if (!file.exists) {
    throw new Error('Could not read the selected file.');
  }

  const size = resolveFileSize(file);
  if (size !== null && size > MAX_CHRONICA_PACKAGE_BYTES) {
    throw new PackageFileTooLargeError(size, MAX_CHRONICA_PACKAGE_BYTES);
  }

  const bytes = await file.bytes();

  if (bytes.byteLength > MAX_CHRONICA_PACKAGE_BYTES) {
    throw new PackageFileTooLargeError(bytes.byteLength, MAX_CHRONICA_PACKAGE_BYTES);
  }

  return bytes;
}
