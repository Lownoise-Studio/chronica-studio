import {
  assertPackageSize,
  formatPackageTooLargeMessage,
  MAX_CHRONICA_PACKAGE_BYTES,
  PackageFileTooLargeError,
  readPackageFileBytes,
} from '../storage/read-package-file';

jest.mock('../storage/fileSystem', () => ({
  readPickableBytes: jest.fn(),
}));

import { readPickableBytes } from '../storage/fileSystem';

const mockReadPickableBytes = readPickableBytes as jest.Mock;

describe('readPackageFileBytes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReadPickableBytes.mockResolvedValue(new Uint8Array([0x50, 0x4b, 0x03, 0x04]));
  });

  test('reads packages through readPickableBytes for file:// URIs', async () => {
    const bytes = await readPackageFileBytes('file:///cache/game.chronica');
    expect(bytes).toEqual(new Uint8Array([0x50, 0x4b, 0x03, 0x04]));
    expect(mockReadPickableBytes).toHaveBeenCalledWith('file:///cache/game.chronica');
  });

  test('reads packages through readPickableBytes for content:// URIs', async () => {
    const bytes = await readPackageFileBytes('content://media/external/downloads/game.chronica');
    expect(bytes).toEqual(new Uint8Array([0x50, 0x4b, 0x03, 0x04]));
    expect(mockReadPickableBytes).toHaveBeenCalledWith('content://media/external/downloads/game.chronica');
  });

  test('rejects packages larger than the size guard', async () => {
    mockReadPickableBytes.mockResolvedValue(new Uint8Array(MAX_CHRONICA_PACKAGE_BYTES + 1));
    await expect(readPackageFileBytes('file:///cache/huge.chronica')).rejects.toBeInstanceOf(
      PackageFileTooLargeError,
    );
  });

  test('returns a friendly too-large message', () => {
    const message = formatPackageTooLargeMessage(150 * 1024 * 1024, MAX_CHRONICA_PACKAGE_BYTES);
    expect(message).toContain('too large');
    expect(message).toContain('150.0 MB');
    expect(message).toContain('100 MB');
  });

  test('throws when pickable read fails', async () => {
    mockReadPickableBytes.mockRejectedValue(new Error('Could not read the selected file.'));
    await expect(readPackageFileBytes('content://media/external/missing.chronica')).rejects.toThrow(
      'Could not read the selected file.',
    );
  });
});

describe('assertPackageSize', () => {
  test('allows packages within the limit', () => {
    expect(() => assertPackageSize(new Uint8Array(16))).not.toThrow();
  });

  test('rejects in-memory packages above the limit', () => {
    expect(() => assertPackageSize(new Uint8Array(MAX_CHRONICA_PACKAGE_BYTES + 1))).toThrow(
      PackageFileTooLargeError,
    );
  });
});
