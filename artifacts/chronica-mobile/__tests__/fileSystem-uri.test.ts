import * as FS from 'expo-file-system/legacy';
import {
  fileExists,
  isFileSystemCheckableUri,
  isTrustedResourceUri,
} from '../storage/fileSystem';

const mockGetInfoAsync = FS.getInfoAsync as jest.Mock;

beforeEach(() => {
  mockGetInfoAsync.mockReset();
  mockGetInfoAsync.mockResolvedValue({ exists: true });
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

describe('fileExists', () => {
  test('checks file:// URIs with getInfoAsync', async () => {
    mockGetInfoAsync.mockResolvedValueOnce({ exists: false });
    await expect(fileExists('file:///data/user/0/app/missing.jpg')).resolves.toBe(false);
    expect(mockGetInfoAsync).toHaveBeenCalledWith('file:///data/user/0/app/missing.jpg');
  });

  test('normalizes absolute paths before checking', async () => {
    await fileExists('/data/user/0/app/pasture.jpg');
    expect(mockGetInfoAsync).toHaveBeenCalledWith('file:///data/user/0/app/pasture.jpg');
  });

  test('treats asset:// URIs as valid without calling getInfoAsync', async () => {
    await expect(fileExists('asset:///pasture-morning.jpg')).resolves.toBe(true);
    expect(mockGetInfoAsync).not.toHaveBeenCalled();
  });

  test('treats content:// URIs as valid without calling getInfoAsync', async () => {
    await expect(fileExists('content://media/external/images/1')).resolves.toBe(true);
    expect(mockGetInfoAsync).not.toHaveBeenCalled();
  });

  test('treats unknown schemes as valid without calling getInfoAsync', async () => {
    await expect(fileExists('bundle-asset://pasture.jpg')).resolves.toBe(true);
    expect(mockGetInfoAsync).not.toHaveBeenCalled();
  });
});
