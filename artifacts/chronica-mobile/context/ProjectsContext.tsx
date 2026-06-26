import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Project, Fragment, ProjectAsset, Choice, VariableValue, ValidationError } from '@/engine/types';
import { compileProject } from '@/engine/compiler';
import { createId } from '@/engine/identity';
import { migrateProject, PROJECT_SCHEMA_VERSION } from '@/engine/project-migration';
import { parseChronicaPackage } from '@/storage/chronica-package-io';
import { isBundledDemoProject, SAMPLE_GAME_ID } from '@/demo/bundled-demos';
import {
  APP_STORAGE_KEYS,
  clearAdvancedModePreference,
  clearProjectAssets,
  clearRuntimeSaves,
} from '@/storage/dev-reset';
import {
  clearAllProjectRecords,
  deleteProjectRecord,
  deleteProjectRecords,
  loadAllProjects,
  migrateLegacyProjectsBlob,
  saveProjectRecord,
} from '@/storage/projects-store';

const ONBOARDED_KEY = APP_STORAGE_KEYS.onboarded;

const nowIso = () => new Date().toISOString();

// ---------------------------------------------------------------------------
// Sample project
// ---------------------------------------------------------------------------
function makeSampleProject(): Project {
  const id = 'sample-01';
  const f1uid = createId();
  const f2uid = createId();
  const f3uid = createId();
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    gameId: SAMPLE_GAME_ID,
    id,
    title: 'The Crossroads',
    description: 'A short demo story — explore it, then build your own.',
    startLocation: 'intro',
    initialVariables: {},
    initialMemory: {},
    createdAt: nowIso(),
    updatedAt: nowIso(),
    assets: [],
    characters: [],
    fragments: [
      {
        uid: f1uid,
        title: 'Intro',
        locationId: 'intro',
        priority: 0,
        conditions: [],
        effects: [],
        text: 'You stand at a crossroads. The wind carries whispers from two paths. Which way do you go?',
        choices: [
          { uid: createId(), label: 'Take the forest path', action: 'goto:forest', conditions: [] },
          { uid: createId(), label: 'Follow the river', action: 'goto:river', conditions: [] },
        ],
        backgroundImage: undefined,
        backgroundAudio: undefined,
      },
      {
        uid: f2uid,
        title: 'Forest',
        locationId: 'forest',
        priority: 0,
        conditions: [],
        effects: ['variables.visited_forest = true'],
        text: 'The forest is dark but alive. Ancient trees loom overhead, their roots tangled like old stories.',
        choices: [
          { uid: createId(), label: 'Turn back', action: 'goto:intro', conditions: [] },
        ],
        backgroundImage: undefined,
        backgroundAudio: undefined,
      },
      {
        uid: f3uid,
        title: 'River',
        locationId: 'river',
        priority: 0,
        conditions: [],
        effects: [],
        text: 'The river glitters in the fading light. You feel at peace. This is where your story ends — for now.',
        choices: [],
        backgroundImage: undefined,
        backgroundAudio: undefined,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Context type
// ---------------------------------------------------------------------------
interface ProjectsContextType {
  projects: Project[];
  isLoaded: boolean;
  hasOnboarded: boolean;
  setHasOnboarded: (v: boolean) => void;
  createProject: (title: string, description: string) => Project;
  updateProject: (id: string, updates: Partial<Pick<Project, 'title' | 'description' | 'startLocation' | 'initialVariables' | 'initialMemory' | 'characters'>>) => void;
  duplicateProject: (id: string) => Project | null;
  deleteProject: (id: string) => void;
  addFragment: (projectId: string, fragment: Omit<Fragment, 'uid'>) => Fragment;
  updateFragment: (projectId: string, uid: string, updates: Partial<Fragment>) => void;
  deleteFragment: (projectId: string, uid: string) => void;
  addAsset: (projectId: string, asset: ProjectAsset) => void;
  deleteAsset: (projectId: string, assetId: string) => void;
  getProject: (id: string) => Project | undefined;
  exportProject: (id: string) => string | null;
  importProject: (json: string) => { ok: boolean; error?: string; project?: Project };
  importProjectPackage: (bytes: Uint8Array) => Promise<{ ok: boolean; error?: string; project?: Project; diagnostics?: ValidationError[] }>;
  getValidationErrors: (id: string) => ValidationError[];
  /** Non-blocking semantic warnings (typos, unreachable targets, etc.). */
  getValidationWarnings: (id: string) => ValidationError[];
  resetOnboarding: () => Promise<void>;
  removeDemoProjects: () => Promise<void>;
  clearLibrary: () => Promise<void>;
  resetAppState: () => Promise<void>;
}

const ProjectsContext = createContext<ProjectsContextType | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasOnboarded, setHasOnboardedState] = useState(true);
  // One debounce timer per project id — editing one project must not
  // rewrite every other project's storage record.
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Load on mount
  useEffect(() => {
    (async () => {
      try {
        const [migrated, onboarded] = await Promise.all([
          migrateLegacyProjectsBlob(),
          AsyncStorage.getItem(ONBOARDED_KEY),
        ]);
        let loaded = migrated ?? await loadAllProjects();
        // Migrate: backfill schemaVersion + Fragment.title on old data
        loaded = loaded.map(migrateProject);
        // Seed sample project on first launch
        if (!onboarded && loaded.length === 0) {
          const sample = makeSampleProject();
          await saveProjectRecord(sample);
          loaded = [sample];
        }
        setProjects(loaded);
        setHasOnboardedState(!!onboarded);
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  const setHasOnboarded = (v: boolean) => {
    setHasOnboardedState(v);
    AsyncStorage.setItem(ONBOARDED_KEY, v ? '1' : '');
  };

  const clearSaveTimer = (id: string) => {
    const timer = saveTimers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      saveTimers.current.delete(id);
    }
  };

  /** Debounced per-project save — only the changed project's record is rewritten. */
  const scheduleSave = (project: Project) => {
    clearSaveTimer(project.id);
    const timer = setTimeout(() => {
      saveTimers.current.delete(project.id);
      saveProjectRecord(project).catch(() => {});
    }, 300);
    saveTimers.current.set(project.id, timer);
  };

  /** Updates in-memory state and schedules a debounced save for only the listed project ids. */
  const persist = (next: Project[], changedIds: string[]) => {
    setProjects(next);
    for (const id of changedIds) {
      const project = next.find(p => p.id === id);
      if (project) scheduleSave(project);
    }
  };

  /** Like `persist`, but saves the changed projects immediately instead of debouncing. */
  const persistNow = (next: Project[], changedIds: string[]) => {
    setProjects(next);
    for (const id of changedIds) {
      clearSaveTimer(id);
      const project = next.find(p => p.id === id);
      if (project) saveProjectRecord(project).catch(() => {});
    }
  };

  const removeProjects = async (predicate: (project: Project) => boolean) => {
    const removed = projects.filter(predicate);
    const remaining = projects.filter(project => !predicate(project));
    const removedIds = removed.map(project => project.id);
    removedIds.forEach(clearSaveTimer);
    setProjects(remaining);
    await deleteProjectRecords(removedIds);
    await clearRuntimeSaves(removedIds);
    await clearProjectAssets(removedIds);
  };

  const resetOnboarding = async () => {
    setHasOnboardedState(false);
    await AsyncStorage.removeItem(ONBOARDED_KEY);
  };

  const removeDemoProjects = async () => {
    await removeProjects(isBundledDemoProject);
  };

  const clearLibrary = async () => {
    const allIds = projects.map(project => project.id);
    allIds.forEach(clearSaveTimer);
    setProjects([]);
    await clearAllProjectRecords();
    await clearRuntimeSaves(allIds);
    await clearProjectAssets(allIds);
  };

  const resetAppState = async () => {
    await clearLibrary();
    await resetOnboarding();
    await clearAdvancedModePreference();
  };

  const createProject = (title: string, description: string): Project => {
    const p: Project = {
      schemaVersion: PROJECT_SCHEMA_VERSION,
      gameId: createId(),
      id: createId(),
      title,
      description,
      startLocation: 'start',
      initialVariables: {},
      initialMemory: {},
      createdAt: nowIso(),
      updatedAt: nowIso(),
      fragments: [],
      assets: [],
      characters: [],
    };
    persistNow([...projects, p], [p.id]);
    return p;
  };

  const updateProject = (
    id: string,
    updates: Partial<Pick<Project, 'title' | 'description' | 'startLocation' | 'initialVariables' | 'initialMemory' | 'characters'>>
  ) => persist(projects.map(p => p.id === id ? { ...p, ...updates, updatedAt: nowIso() } : p), [id]);

  const duplicateProject = (id: string): Project | null => {
    const source = projects.find(p => p.id === id);
    if (!source) return null;
    const copy: Project = {
      ...JSON.parse(JSON.stringify(source)),
      id: createId(),
      gameId: createId(),
      title: `${source.title} (copy)`,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      fragments: source.fragments.map(f => ({
        ...f,
        uid: createId(),
        choices: f.choices.map(c => ({ ...c, uid: createId() })),
        hotspots: (f.hotspots ?? []).map(h => ({ ...h, uid: createId() })),
        dialogue: (f.dialogue ?? []).map(line => ({ ...line, uid: createId() })),
      })),
      characters: (source.characters ?? []).map(c => ({
        ...c,
        uid: createId(),
        expressions: (c.expressions ?? []).map(e => ({ ...e })),
      })),
    };
    persistNow([...projects, copy], [copy.id]);
    return copy;
  };

  const deleteProject = (id: string) => {
    clearSaveTimer(id);
    setProjects(prev => prev.filter(p => p.id !== id));
    deleteProjectRecord(id).catch(() => {});
  };

  const addFragment = (projectId: string, fragment: Omit<Fragment, 'uid'>): Fragment => {
    const f: Fragment = { ...fragment, uid: createId() };
    persist(projects.map(p => {
      if (p.id !== projectId) return p;
      const isFirst = p.fragments.length === 0;
      return {
        ...p,
        fragments: [...p.fragments, f],
        // Auto-wire the opening scene when the very first scene is created
        startLocation: isFirst ? f.locationId : p.startLocation,
        updatedAt: nowIso(),
      };
    }), [projectId]);
    return f;
  };

  const updateFragment = (projectId: string, uid: string, updates: Partial<Fragment>) =>
    persist(projects.map(p => p.id === projectId
      ? { ...p, updatedAt: nowIso(), fragments: p.fragments.map(f => f.uid === uid ? { ...f, ...updates } : f) }
      : p), [projectId]);

  const deleteFragment = (projectId: string, uid: string) =>
    persist(projects.map(p => p.id === projectId
      ? { ...p, updatedAt: nowIso(), fragments: p.fragments.filter(f => f.uid !== uid) }
      : p), [projectId]);

  const addAsset = (projectId: string, asset: ProjectAsset) =>
    persist(projects.map(p => p.id === projectId
      ? { ...p, assets: [...p.assets, asset], updatedAt: nowIso() } : p), [projectId]);

  const deleteAsset = (projectId: string, assetId: string) =>
    persist(projects.map(p => p.id === projectId
      ? { ...p, assets: p.assets.filter(a => a.id !== assetId), updatedAt: nowIso() } : p), [projectId]);

  const getProject = (id: string) => projects.find(p => p.id === id);

  const exportProject = (id: string): string | null => {
    const p = getProject(id);
    if (!p) return null;
    // Strip local asset URIs from the export (they're device-specific)
    const exportable: Project = {
      ...p,
      schemaVersion: PROJECT_SCHEMA_VERSION,
      assets: p.assets.map(a => ({ ...a, uri: '' })),
    };
    return JSON.stringify(exportable, null, 2);
  };

  const importProject = (json: string): { ok: boolean; error?: string; project?: Project } => {
    try {
      const data = JSON.parse(json);
      if (!data || typeof data !== 'object') return { ok: false, error: 'Not a valid JSON object.' };
      if (!data.schemaVersion) return { ok: false, error: 'Missing schemaVersion — not a Chronica Studio project file.' };
      if (!data.id || !data.title) return { ok: false, error: 'Missing required fields (id, title).' };
      if (!Array.isArray(data.fragments)) return { ok: false, error: 'Invalid project: fragments must be an array.' };

      const migrated = migrateProject(data as Project);
      const newInstallId = projects.some(p => p.id === migrated.id) ? createId() : migrated.id;
      const project: Project = { ...migrated, id: newInstallId, updatedAt: nowIso() };
      persistNow([...projects, project], [project.id]);
      return { ok: true, project };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? 'Failed to parse file.' };
    }
  };

  const importProjectPackage = async (
    bytes: Uint8Array,
  ): Promise<{ ok: boolean; error?: string; project?: Project; diagnostics?: ValidationError[] }> => {
    try {
      const newInstallId = createId();
      const result = await parseChronicaPackage(bytes, newInstallId);
      if (!result.ok) {
        return { ok: false, error: result.error, diagnostics: result.diagnostics };
      }

      persistNow([...projects, result.project], [result.project.id]);
      return { ok: true, project: result.project };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? 'Failed to import package.' };
    }
  };

  const getValidationErrors = (id: string): ValidationError[] => {
    const p = getProject(id);
    if (!p) return [];
    const result = compileProject(p);
    return result.ok ? [] : result.diagnostics;
  };

  const getValidationWarnings = (id: string): ValidationError[] => {
    const p = getProject(id);
    if (!p) return [];
    const result = compileProject(p);
    return result.ok ? result.warnings : [];
  };

  return (
    <ProjectsContext.Provider value={{
      projects, isLoaded, hasOnboarded, setHasOnboarded,
      createProject, updateProject, duplicateProject, deleteProject,
      addFragment, updateFragment, deleteFragment,
      addAsset, deleteAsset, getProject,
      exportProject, importProject, importProjectPackage, getValidationErrors, getValidationWarnings,
      resetOnboarding, removeDemoProjects, clearLibrary, resetAppState,
    }}>
      {children}
    </ProjectsContext.Provider>
  );
}

export function useProjects(): ProjectsContextType {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error('useProjects must be used within ProjectsProvider');
  return ctx;
}

// migrateProject lives in engine/project-migration.ts
