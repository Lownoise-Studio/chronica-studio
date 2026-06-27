import {
  readBytes,
  readPickableBytes,
  shouldSkipFilesystemExistenceCheck,
} from '@/storage/fileSystem';

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

/**
 * Read a picked or shared game file as raw bytes (ZIP package or JSON backup).
 * Uses expo-file-system File.bytes() for local file:// URIs only.
 * content:// and other picker URIs use legacy readAsStringAsync — never File.exists.
 */
export async function readPackageFileBytes(uri: string): Promise<Uint8Array> {
  if (shouldSkipFilesystemExistenceCheck(uri)) {
    const bytes = await readPickableBytes(uri);
    assertPackageSize(bytes);
    return bytes;
  }

  const bytes = await readBytes(uri);
  assertPackageSize(bytes);
  return bytes;
}
