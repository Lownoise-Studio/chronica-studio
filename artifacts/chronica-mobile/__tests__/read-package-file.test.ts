import {
  assertPackageSize,
  formatPackageTooLargeMessage,
  MAX_CHRONICA_PACKAGE_BYTES,
  PackageFileTooLargeError,
  readPackageFileBytes,
} from '../storage/read-package-file';

const mockBytes = jest.fn();
const mockInfo = jest.fn();
const mockExists = { value: true };

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation(() => ({
    get exists() {
      return mockExists.value;
    },
    info: () => mockInfo(),
    bytes: () => mockBytes(),
  })),
}));

jest.mock('../storage/fileSystem', () => ({
  toLocalFileUri: (uri: string) => uri,
}));

describe('readPackageFileBytes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExists.value = true;
    mockInfo.mockReturnValue({ size: 4 });
    mockBytes.mockResolvedValue(new Uint8Array([0x50, 0x4b, 0x03, 0x04]));
  });

  test('reads binary via File.bytes without legacy readAsStringAsync', async () => {
    const bytes = await readPackageFileBytes('file:///cache/game.chronica');
    expect(bytes).toEqual(new Uint8Array([0x50, 0x4b, 0x03, 0x04]));
    expect(mockBytes).toHaveBeenCalledTimes(1);
  });

  test('rejects packages larger than the size guard from file metadata', async () => {
    mockInfo.mockReturnValue({ size: MAX_CHRONICA_PACKAGE_BYTES + 1 });

    await expect(readPackageFileBytes('file:///cache/huge.chronica')).rejects.toBeInstanceOf(
      PackageFileTooLargeError,
    );
    expect(mockBytes).not.toHaveBeenCalled();
  });

  test('rejects packages larger than the size guard after read', async () => {
    mockInfo.mockReturnValue({ size: 0 });
    mockBytes.mockResolvedValue(new Uint8Array(MAX_CHRONICA_PACKAGE_BYTES + 1));

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

  test('throws when the file does not exist', async () => {
    mockExists.value = false;
    await expect(readPackageFileBytes('file:///missing.chronica')).rejects.toThrow(
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
