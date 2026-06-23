import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Project, Fragment, ProjectAsset, Choice, VariableValue, ValidationError } from '@/engine/types';
import { validateProject } from '@/engine/validator';
import { parseChronicaPackage } from '@/storage/chronica-package-io';

const STORAGE_KEY = 'pse_projects_v1';
const ONBOARDED_KEY = 'pse_onboarded_v1';
const SCHEMA_VERSION = 1;

const generateId = (): string =>
  Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

const nowIso = () => new Date().toISOString();

// ---------------------------------------------------------------------------
// Sample project
// ---------------------------------------------------------------------------
function makeSampleProject(): Project {
  const id = 'sample-01';
  const f1uid = generateId();
  const f2uid = generateId();
  const f3uid = generateId();
  return {
    schemaVersion: SCHEMA_VERSION,
    id,
    title: 'The Crossroads',
    description: 'A short demo story — explore it, then build your own.',
    startLocation: 'intro',
    initialVariables: {},
    initialMemory: {},
    createdAt: nowIso(),
    updatedAt: nowIso(),
    assets: [],
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
          { uid: generateId(), label: 'Take the forest path', action: 'goto:forest', conditions: [] },
          { uid: generateId(), label: 'Follow the river', action: 'goto:river', conditions: [] },
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
          { uid: generateId(), label: 'Turn back', action: 'goto:intro', conditions: [] },
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
  updateProject: (id: string, updates: Partial<Pick<Project, 'title' | 'description' | 'startLocation' | 'initialVariables' | 'initialMemory'>>) => void;
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
  importProjectPackage: (bytes: Uint8Array) => Promise<{ ok: boolean; error?: string; project?: Project }>;
  getValidationErrors: (id: string) => ValidationError[];
}

const ProjectsContext = createContext<ProjectsContextType | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasOnboarded, setHasOnboardedState] = useState(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load on mount
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(STORAGE_KEY),
      AsyncStorage.getItem(ONBOARDED_KEY),
    ]).then(([json, onboarded]) => {
      let loaded: Project[] = [];
      if (json) {
        try { loaded = JSON.parse(json); } catch {}
      }
      // Migrate: backfill schemaVersion + Fragment.title on old data
      loaded = loaded.map(migrateProject);
      // Seed sample project on first launch
      if (!onboarded && loaded.length === 0) {
        loaded = [makeSampleProject()];
      }
      setProjects(loaded);
      setHasOnboardedState(!!onboarded);
      setIsLoaded(true);
    }).catch(() => setIsLoaded(true));
  }, []);

  const setHasOnboarded = (v: boolean) => {
    setHasOnboardedState(v);
    AsyncStorage.setItem(ONBOARDED_KEY, v ? '1' : '');
  };

  // Debounced autosave
  const persist = (next: Project[]) => {
    setProjects(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    }, 300);
  };

  const createProject = (title: string, description: string): Project => {
    const p: Project = {
      schemaVersion: SCHEMA_VERSION,
      id: generateId(),
      title,
      description,
      startLocation: 'start',
      initialVariables: {},
      initialMemory: {},
      createdAt: nowIso(),
      updatedAt: nowIso(),
      fragments: [],
      assets: [],
    };
    persist([...projects, p]);
    return p;
  };

  const updateProject = (
    id: string,
    updates: Partial<Pick<Project, 'title' | 'description' | 'startLocation' | 'initialVariables' | 'initialMemory'>>
  ) => persist(projects.map(p => p.id === id ? { ...p, ...updates, updatedAt: nowIso() } : p));

  const duplicateProject = (id: string): Project | null => {
    const source = projects.find(p => p.id === id);
    if (!source) return null;
    const copy: Project = {
      ...JSON.parse(JSON.stringify(source)),
      id: generateId(),
      title: `${source.title} (copy)`,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      // Re-generate fragment UIDs to avoid collisions
      fragments: source.fragments.map(f => ({
        ...f,
        uid: generateId(),
        choices: f.choices.map(c => ({ ...c, uid: generateId() })),
      })),
    };
    persist([...projects, copy]);
    return copy;
  };

  const deleteProject = (id: string) => persist(projects.filter(p => p.id !== id));

  const addFragment = (projectId: string, fragment: Omit<Fragment, 'uid'>): Fragment => {
    const f: Fragment = { ...fragment, uid: generateId() };
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
    }));
    return f;
  };

  const updateFragment = (projectId: string, uid: string, updates: Partial<Fragment>) =>
    persist(projects.map(p => p.id === projectId
      ? { ...p, updatedAt: nowIso(), fragments: p.fragments.map(f => f.uid === uid ? { ...f, ...updates } : f) }
      : p));

  const deleteFragment = (projectId: string, uid: string) =>
    persist(projects.map(p => p.id === projectId
      ? { ...p, updatedAt: nowIso(), fragments: p.fragments.filter(f => f.uid !== uid) }
      : p));

  const addAsset = (projectId: string, asset: ProjectAsset) =>
    persist(projects.map(p => p.id === projectId
      ? { ...p, assets: [...p.assets, asset], updatedAt: nowIso() } : p));

  const deleteAsset = (projectId: string, assetId: string) =>
    persist(projects.map(p => p.id === projectId
      ? { ...p, assets: p.assets.filter(a => a.id !== assetId), updatedAt: nowIso() } : p));

  const getProject = (id: string) => projects.find(p => p.id === id);

  const exportProject = (id: string): string | null => {
    const p = getProject(id);
    if (!p) return null;
    // Strip local asset URIs from the export (they're device-specific)
    const exportable: Project = {
      ...p,
      schemaVersion: SCHEMA_VERSION,
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
      // Give it a new ID if there's a collision
      const newId = projects.some(p => p.id === migrated.id) ? generateId() : migrated.id;
      const project: Project = { ...migrated, id: newId, updatedAt: nowIso() };
      persist([...projects, project]);
      return { ok: true, project };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? 'Failed to parse file.' };
    }
  };

  const importProjectPackage = async (
    bytes: Uint8Array,
  ): Promise<{ ok: boolean; error?: string; project?: Project }> => {
    try {
      const newId = generateId();
      const result = await parseChronicaPackage(bytes, newId);
      if (!result.ok) return { ok: false, error: result.error };

      const migrated = migrateProject(result.project);
      const project: Project = { ...migrated, id: newId, updatedAt: nowIso() };
      persist([...projects, project]);
      return { ok: true, project };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? 'Failed to import package.' };
    }
  };

  const getValidationErrors = (id: string): ValidationError[] => {
    const p = getProject(id);
    return p ? validateProject(p) : [];
  };

  return (
    <ProjectsContext.Provider value={{
      projects, isLoaded, hasOnboarded, setHasOnboarded,
      createProject, updateProject, duplicateProject, deleteProject,
      addFragment, updateFragment, deleteFragment,
      addAsset, deleteAsset, getProject,
      exportProject, importProject, importProjectPackage, getValidationErrors,
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

// ---------------------------------------------------------------------------
// Migration helpers
// ---------------------------------------------------------------------------
function migrateProject(p: Project): Project {
  return {
    ...p,
    schemaVersion: p.schemaVersion ?? SCHEMA_VERSION,
    startLocation: p.startLocation ?? 'start',
    initialVariables: p.initialVariables ?? {},
    initialMemory: p.initialMemory ?? {},
    assets: p.assets ?? [],
    fragments: (p.fragments ?? []).map(f => ({
      ...f,
      title: f.title ?? f.locationId ?? '',
      conditions: f.conditions ?? [],
      effects: f.effects ?? [],
      choices: (f.choices ?? []).map(c => ({
        ...c,
        conditions: c.conditions ?? [],
      })),
    })),
  };
}
