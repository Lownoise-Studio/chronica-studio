import {
  assertPackageSize,
  formatPackageTooLargeMessage,
  MAX_CHRONICA_PACKAGE_BYTES,
  PackageFileTooLargeError,
  readPackageFileBytes,
} from '../storage/read-package-file';

jest.mock('../storage/fileSystem', () => {
  const actual = jest.requireActual('../storage/fileSystem');
  return {
    ...actual,
    readBytes: jest.fn(),
    readPickableBytes: jest.fn(),
  };
});

import { readBytes, readPickableBytes } from '../storage/fileSystem';

const mockReadBytes = readBytes as jest.Mock;
const mockReadPickableBytes = readPickableBytes as jest.Mock;

describe('readPackageFileBytes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReadBytes.mockResolvedValue(new Uint8Array([0x50, 0x4b, 0x03, 0x04]));
    mockReadPickableBytes.mockResolvedValue(new Uint8Array([0x50, 0x4b, 0x03, 0x04]));
  });

  test('reads file:// packages via readBytes', async () => {
    const bytes = await readPackageFileBytes('file:///cache/game.chronica');
    expect(bytes).toEqual(new Uint8Array([0x50, 0x4b, 0x03, 0x04]));
    expect(mockReadBytes).toHaveBeenCalledWith('file:///cache/game.chronica');
    expect(mockReadPickableBytes).not.toHaveBeenCalled();
  });

  test('reads content:// packages via readPickableBytes without readBytes', async () => {
    const bytes = await readPackageFileBytes('content://media/external/downloads/game.chronica');
    expect(bytes).toEqual(new Uint8Array([0x50, 0x4b, 0x03, 0x04]));
    expect(mockReadPickableBytes).toHaveBeenCalledWith('content://media/external/downloads/game.chronica');
    expect(mockReadBytes).not.toHaveBeenCalled();
  });

  test('reads asset:// packages via readPickableBytes without readBytes', async () => {
    await readPackageFileBytes('asset:///bundled/game.chronica');
    expect(mockReadPickableBytes).toHaveBeenCalledWith('asset:///bundled/game.chronica');
    expect(mockReadBytes).not.toHaveBeenCalled();
  });

  test('rejects packages larger than the size guard', async () => {
    mockReadBytes.mockResolvedValue(new Uint8Array(MAX_CHRONICA_PACKAGE_BYTES + 1));
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
