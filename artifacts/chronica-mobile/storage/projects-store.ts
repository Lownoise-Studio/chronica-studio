import AsyncStorage from '@react-native-async-storage/async-storage';
import { Project } from '@/engine/types';
import { APP_STORAGE_KEYS } from './dev-reset';

const LEGACY_PROJECTS_KEY = APP_STORAGE_KEYS.projects;
const INDEX_KEY = `${APP_STORAGE_KEYS.projects}_index`;
const projectKey = (id: string) => `${APP_STORAGE_KEYS.projects}_${id}`;

async function readIndex(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(INDEX_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeIndex(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(ids));
}

/**
 * One-time migration from the legacy single-blob `pse_projects_v1` key
 * (which held every project's full JSON in one AsyncStorage entry, so
 * editing one fragment rewrote the entire library) into per-project
 * records keyed by id, plus a lightweight id index for listing.
 *
 * Returns the migrated projects, or null if there was no legacy blob.
 */
export async function migrateLegacyProjectsBlob(): Promise<Project[] | null> {
  const legacyRaw = await AsyncStorage.getItem(LEGACY_PROJECTS_KEY);
  if (!legacyRaw) return null;

  let legacyProjects: Project[] = [];
  try {
    const parsed = JSON.parse(legacyRaw);
    if (Array.isArray(parsed)) legacyProjects = parsed;
  } catch {
    // Corrupt legacy blob — drop it rather than block startup.
  }

  await Promise.all(
    legacyProjects.map(p => AsyncStorage.setItem(projectKey(p.id), JSON.stringify(p))),
  );
  await writeIndex(legacyProjects.map(p => p.id));
  await AsyncStorage.removeItem(LEGACY_PROJECTS_KEY);

  return legacyProjects;
}

export async function loadAllProjects(): Promise<Project[]> {
  const ids = await readIndex();
  if (ids.length === 0) return [];

  const entries = await AsyncStorage.multiGet(ids.map(projectKey));
  const projects: Project[] = [];
  for (const [, raw] of entries) {
    if (!raw) continue;
    try {
      projects.push(JSON.parse(raw));
    } catch {
      // Skip a corrupt individual record rather than failing the whole library.
    }
  }
  return projects;
}

/** Writes a single project's record. Updates the index only if the id is new. */
export async function saveProjectRecord(project: Project): Promise<void> {
  await AsyncStorage.setItem(projectKey(project.id), JSON.stringify(project));
  const ids = await readIndex();
  if (!ids.includes(project.id)) {
    await writeIndex([...ids, project.id]);
  }
}

export async function deleteProjectRecord(id: string): Promise<void> {
  await AsyncStorage.removeItem(projectKey(id));
  const ids = await readIndex();
  if (ids.includes(id)) {
    await writeIndex(ids.filter(existing => existing !== id));
  }
}

export async function deleteProjectRecords(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await AsyncStorage.multiRemove(ids.map(projectKey));
  const existing = await readIndex();
  await writeIndex(existing.filter(id => !ids.includes(id)));
}

export async function clearAllProjectRecords(): Promise<void> {
  const ids = await readIndex();
  if (ids.length) await AsyncStorage.multiRemove(ids.map(projectKey));
  await AsyncStorage.removeItem(INDEX_KEY);
}
