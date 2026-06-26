import {
  clearAllProjectRecords,
  deleteProjectRecord,
  deleteProjectRecords,
  loadAllProjects,
  migrateLegacyProjectsBlob,
  saveProjectRecord,
} from '../storage/projects-store';
import { APP_STORAGE_KEYS } from '../storage/dev-reset';
import type { Project } from '../engine/types';

// Map-backed AsyncStorage mock with the multi-* APIs projects-store relies on.
const mockStore = new Map<string, string>();
const mockSetItemSpy = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (k: string) => (mockStore.has(k) ? mockStore.get(k)! : null)),
    setItem: jest.fn(async (k: string, v: string) => { mockSetItemSpy(k, v); mockStore.set(k, v); }),
    removeItem: jest.fn(async (k: string) => { mockStore.delete(k); }),
    multiGet: jest.fn(async (keys: string[]) => keys.map(k => [k, mockStore.has(k) ? mockStore.get(k)! : null])),
    multiRemove: jest.fn(async (keys: string[]) => { keys.forEach(k => mockStore.delete(k)); }),
    getAllKeys: jest.fn(async () => [...mockStore.keys()]),
  },
}));

const LEGACY_KEY = APP_STORAGE_KEYS.projects;
const INDEX_KEY = `${APP_STORAGE_KEYS.projects}_index`;
const recordKey = (id: string) => `${APP_STORAGE_KEYS.projects}_${id}`;

function makeProject(id: string, title = id): Project {
  return {
    schemaVersion: 3,
    gameId: `game-${id}`,
    id,
    title,
    description: '',
    startLocation: 'intro',
    initialVariables: {},
    initialMemory: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    assets: [],
    characters: [],
    fragments: [],
  };
}

beforeEach(() => {
  mockStore.clear();
  mockSetItemSpy.mockClear();
});

describe('legacy blob migration', () => {
  test('migrates single-blob library into per-project records + index, drops legacy key', async () => {
    const projects = [makeProject('a'), makeProject('b')];
    mockStore.set(LEGACY_KEY, JSON.stringify(projects));

    const migrated = await migrateLegacyProjectsBlob();

    expect(migrated).toHaveLength(2);
    expect(JSON.parse(mockStore.get(recordKey('a'))!).id).toBe('a');
    expect(JSON.parse(mockStore.get(recordKey('b'))!).id).toBe('b');
    expect(JSON.parse(mockStore.get(INDEX_KEY)!)).toEqual(['a', 'b']);
    expect(mockStore.has(LEGACY_KEY)).toBe(false);
  });

  test('returns null when there is no legacy blob', async () => {
    expect(await migrateLegacyProjectsBlob()).toBeNull();
  });

  test('corrupt legacy blob is dropped, not fatal', async () => {
    mockStore.set(LEGACY_KEY, '{ not valid json');
    const migrated = await migrateLegacyProjectsBlob();
    expect(migrated).toEqual([]);
    expect(mockStore.has(LEGACY_KEY)).toBe(false);
    expect(JSON.parse(mockStore.get(INDEX_KEY)!)).toEqual([]);
  });
});

describe('per-project records', () => {
  test('saving a project writes only that record, not the whole library', async () => {
    await saveProjectRecord(makeProject('a'));
    await saveProjectRecord(makeProject('b'));
    mockSetItemSpy.mockClear();

    await saveProjectRecord(makeProject('a', 'Edited'));

    // Only project a's record key should have been written (index unchanged: id not new).
    const writtenKeys = mockSetItemSpy.mock.calls.map(c => c[0]);
    expect(writtenKeys).toEqual([recordKey('a')]);
    expect(JSON.parse(mockStore.get(recordKey('a'))!).title).toBe('Edited');
  });

  test('saving a new project appends to the index exactly once', async () => {
    await saveProjectRecord(makeProject('a'));
    await saveProjectRecord(makeProject('a', 'again')); // same id, no dup
    expect(JSON.parse(mockStore.get(INDEX_KEY)!)).toEqual(['a']);
  });

  test('loadAllProjects reads every indexed record', async () => {
    await saveProjectRecord(makeProject('a'));
    await saveProjectRecord(makeProject('b'));
    const all = await loadAllProjects();
    expect(all.map(p => p.id).sort()).toEqual(['a', 'b']);
  });

  test('loadAllProjects skips a corrupt individual record instead of failing the library', async () => {
    await saveProjectRecord(makeProject('a'));
    await saveProjectRecord(makeProject('b'));
    mockStore.set(recordKey('b'), '{ corrupt');

    const all = await loadAllProjects();
    expect(all.map(p => p.id)).toEqual(['a']);
  });

  test('loadAllProjects returns empty when index is empty', async () => {
    expect(await loadAllProjects()).toEqual([]);
  });
});

describe('deletion + clearing', () => {
  test('deleteProjectRecord removes the record and its index entry', async () => {
    await saveProjectRecord(makeProject('a'));
    await saveProjectRecord(makeProject('b'));
    await deleteProjectRecord('a');

    expect(mockStore.has(recordKey('a'))).toBe(false);
    expect(JSON.parse(mockStore.get(INDEX_KEY)!)).toEqual(['b']);
  });

  test('deleteProjectRecords removes many at once', async () => {
    await saveProjectRecord(makeProject('a'));
    await saveProjectRecord(makeProject('b'));
    await saveProjectRecord(makeProject('c'));
    await deleteProjectRecords(['a', 'c']);

    expect(JSON.parse(mockStore.get(INDEX_KEY)!)).toEqual(['b']);
    expect(mockStore.has(recordKey('a'))).toBe(false);
    expect(mockStore.has(recordKey('c'))).toBe(false);
  });

  test('clearAllProjectRecords wipes records and the index', async () => {
    await saveProjectRecord(makeProject('a'));
    await saveProjectRecord(makeProject('b'));
    await clearAllProjectRecords();

    expect(mockStore.has(recordKey('a'))).toBe(false);
    expect(mockStore.has(recordKey('b'))).toBe(false);
    expect(mockStore.has(INDEX_KEY)).toBe(false);
    expect(await loadAllProjects()).toEqual([]);
  });
});
