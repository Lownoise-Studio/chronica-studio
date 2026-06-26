import { loadGameFromPackageBytes, loadGameFromUri } from '../storage/load-game';
import { MAX_CHRONICA_PACKAGE_BYTES, PackageFileTooLargeError } from '../storage/read-package-file';
import { Project } from '../engine/types';

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('../storage/read-package-file', () => {
  const actual = jest.requireActual('../storage/read-package-file');
  return {
    ...actual,
    readPackageFileBytes: jest.fn(),
  };
});

import { readPackageFileBytes } from '../storage/read-package-file';

const STORY: Project = {
  schemaVersion: 2,
  gameId: 'a0000001-0000-4000-8000-000000000099',
  id: 'imported-id',
  title: 'Loaded Tale',
  description: '',
  startLocation: 'intro',
  initialVariables: {},
  initialMemory: {},
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  assets: [],
    characters: [],
  fragments: [
    {
      uid: 'f1',
      title: 'Intro',
      locationId: 'intro',
      priority: 0,
      conditions: [],
      effects: [],
      text: 'Hello.',
      choices: [],
    },
  ],
};

describe('loadGameFromUri', () => {
  const importFns = {
    importProject: jest.fn(),
    importProjectPackage: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('loads package bytes from uri through the shared binary path', async () => {
    const zipBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
    (readPackageFileBytes as jest.Mock).mockResolvedValue(zipBytes);
    importFns.importProjectPackage.mockResolvedValue({ ok: true, project: STORY });

    const result = await loadGameFromUri('file:///cache/game.chronica', importFns);

    expect(readPackageFileBytes).toHaveBeenCalledWith('file:///cache/game.chronica');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.kind).toBe('package');
    expect(importFns.importProjectPackage).toHaveBeenCalledWith(zipBytes);
  });

  test('imports legacy JSON backup from uri bytes', async () => {
    const json = JSON.stringify(STORY);
    (readPackageFileBytes as jest.Mock).mockResolvedValue(new TextEncoder().encode(json));
    importFns.importProject.mockReturnValue({ ok: true, project: STORY });

    const result = await loadGameFromUri('file:///cache/backup.json', importFns);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.kind).toBe('json');
    expect(importFns.importProject).toHaveBeenCalledWith(json);
    expect(importFns.importProjectPackage).not.toHaveBeenCalled();
  });

  test('returns friendly error when package file is too large', async () => {
    (readPackageFileBytes as jest.Mock).mockRejectedValue(
      new PackageFileTooLargeError(MAX_CHRONICA_PACKAGE_BYTES + 1, MAX_CHRONICA_PACKAGE_BYTES),
    );

    const result = await loadGameFromUri('file:///cache/huge.chronica', importFns);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('too large');
  });
});

describe('loadGameFromPackageBytes', () => {
  test('rejects oversized in-memory demo/package bytes before import', async () => {
    const result = await loadGameFromPackageBytes(
      new Uint8Array(MAX_CHRONICA_PACKAGE_BYTES + 1),
      {
        importProject: jest.fn(),
        importProjectPackage: jest.fn(),
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('too large');
  });
});
