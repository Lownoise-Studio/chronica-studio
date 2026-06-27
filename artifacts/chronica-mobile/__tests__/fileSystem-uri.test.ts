import * as FS from 'expo-file-system/legacy';
import { File } from 'expo-file-system';
import {
  fileExists,
  isFileSystemCheckableUri,
  isTrustedResourceUri,
  readBytes,
  readPickableBytes,
  shouldSkipFilesystemExistenceCheck,
  writeBytes,
} from '../storage/fileSystem';

const mockGetInfoAsync = FS.getInfoAsync as jest.Mock;
const mockReadAsStringAsync = FS.readAsStringAsync as jest.Mock;
const MockFile = File as unknown as jest.Mock;

function lastFileUri(): string | undefined {
  const lastCall = MockFile.mock.calls[MockFile.mock.calls.length - 1];
  return lastCall?.[0] as string | undefined;
}

beforeEach(() => {
  mockGetInfoAsync.mockReset();
  mockGetInfoAsync.mockResolvedValue({ exists: true });
  mockReadAsStringAsync.mockReset();
  mockReadAsStringAsync.mockResolvedValue('');
  MockFile.mockClear();
  MockFile.mockImplementation((uri: string) => ({
    _uri: uri,
    get exists() {
      return true;
    },
    bytes: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    create: jest.fn(),
    write: jest.fn(),
  }));
});

describe('isFileSystemCheckableUri', () => {
  test('accepts file:// and absolute paths only', () => {
    expect(isFileSystemCheckableUri('file:///data/user/0/app/pasture.jpg')).toBe(true);
    expect(isFileSystemCheckableUri('/data/user/0/app/pasture.jpg')).toBe(true);
    expect(isFileSystemCheckableUri('asset:///pasture.jpg')).toBe(false);
    expect(isFileSystemCheckableUri('content://media/external/images/1')).toBe(false);
    expect(isFileSystemCheckableUri('https://example.com/image.jpg')).toBe(false);
  });
});

describe('isTrustedResourceUri', () => {
  test('recognizes bundled and platform resource schemes', () => {
    expect(isTrustedResourceUri('asset:///pasture.jpg')).toBe(true);
    expect(isTrustedResourceUri('content://media/external/images/1')).toBe(true);
    expect(isTrustedResourceUri('https://example.com/image.jpg')).toBe(true);
    expect(isTrustedResourceUri('file:///data/user/0/app/pasture.jpg')).toBe(false);
  });
});

describe('shouldSkipFilesystemExistenceCheck', () => {
  test('skips bundled, remote, and non-local schemes', () => {
    expect(shouldSkipFilesystemExistenceCheck('asset:///pasture.jpg')).toBe(true);
    expect(shouldSkipFilesystemExistenceCheck('content://media/external/images/1')).toBe(true);
    expect(shouldSkipFilesystemExistenceCheck('assets/pasture-morning.jpg')).toBe(true);
    expect(shouldSkipFilesystemExistenceCheck('file:///data/user/0/app/pasture.jpg')).toBe(false);
  });
});

describe('fileExists', () => {
  test('checks file:// URIs with getInfoAsync', async () => {
    mockGetInfoAsync.mockResolvedValueOnce({ exists: false });
    await expect(fileExists('file:///data/user/0/app/missing.jpg')).resolves.toBe(false);
    expect(mockGetInfoAsync).toHaveBeenCalledWith('file:///data/user/0/app/missing.jpg');
    expect(MockFile).not.toHaveBeenCalled();
  });

  test('normalizes absolute paths before checking', async () => {
    await fileExists('/data/user/0/app/pasture.jpg');
    expect(mockGetInfoAsync).toHaveBeenCalledWith('file:///data/user/0/app/pasture.jpg');
    expect(MockFile).not.toHaveBeenCalled();
  });

  test('treats asset:// URIs as valid without calling getInfoAsync or File', async () => {
    await expect(fileExists('asset:///pasture-morning.jpg')).resolves.toBe(true);
    expect(mockGetInfoAsync).not.toHaveBeenCalled();
    expect(MockFile).not.toHaveBeenCalled();
  });

  test('treats content:// URIs as valid without calling getInfoAsync or File', async () => {
    await expect(fileExists('content://media/external/images/1')).resolves.toBe(true);
    expect(mockGetInfoAsync).not.toHaveBeenCalled();
    expect(MockFile).not.toHaveBeenCalled();
  });

  test('treats unknown schemes as valid without calling getInfoAsync or File', async () => {
    await expect(fileExists('bundle-asset://pasture.jpg')).resolves.toBe(true);
    expect(mockGetInfoAsync).not.toHaveBeenCalled();
    expect(MockFile).not.toHaveBeenCalled();
  });
});

describe('readBytes', () => {
  test('reads local file:// URIs through File.bytes()', async () => {
    await expect(readBytes('file:///data/user/0/app/pasture.jpg')).resolves.toEqual(new Uint8Array([1, 2, 3]));
    expect(lastFileUri()).toBe('file:///data/user/0/app/pasture.jpg');
  });

  test('rejects asset:// URIs before constructing File', async () => {
    await expect(readBytes('asset:///pasture.jpg')).rejects.toThrow('local file URI');
    expect(MockFile).not.toHaveBeenCalled();
  });

  test('rejects content:// URIs before constructing File', async () => {
    await expect(readBytes('content://media/external/images/1')).rejects.toThrow('local file URI');
    expect(MockFile).not.toHaveBeenCalled();
  });
});

describe('writeBytes', () => {
  test('writes local file:// URIs through File.write()', async () => {
    await writeBytes('file:///data/user/0/app/out.png', new Uint8Array([9]));
    expect(lastFileUri()).toBe('file:///data/user/0/app/out.png');
  });

  test('rejects content:// URIs before constructing File', async () => {
    await expect(writeBytes('content://media/external/images/1', new Uint8Array([9]))).rejects.toThrow(
      'local file URI',
    );
    expect(MockFile).not.toHaveBeenCalled();
  });
});

describe('readPickableBytes', () => {
  test('delegates file:// URIs to readBytes', async () => {
    await expect(readPickableBytes('file:///cache/game.chronica')).resolves.toEqual(new Uint8Array([1, 2, 3]));
    expect(lastFileUri()).toBe('file:///cache/game.chronica');
  });

  test('reads content:// URIs via legacy readAsStringAsync without File', async () => {
    mockReadAsStringAsync.mockResolvedValueOnce(btoa('PK'));
    await expect(readPickableBytes('content://media/external/file/1')).resolves.toEqual(
      new Uint8Array([80, 75]),
    );
    expect(mockReadAsStringAsync).toHaveBeenCalledWith(
      'content://media/external/file/1',
      { encoding: 'base64' },
    );
    expect(MockFile).not.toHaveBeenCalled();
  });
});

describe('non-local URI regression guard', () => {
  const forbiddenUris = [
    'asset:///pasture-morning.jpg',
    'content://media/external/images/1',
    'https://example.com/image.jpg',
    'assets/pasture-morning.jpg',
  ];

  test.each(forbiddenUris)('fileExists never probes File or getInfoAsync for %s', async uri => {
    await expect(fileExists(uri)).resolves.toBe(true);
    expect(mockGetInfoAsync).not.toHaveBeenCalled();
    expect(MockFile).not.toHaveBeenCalled();
  });
});
