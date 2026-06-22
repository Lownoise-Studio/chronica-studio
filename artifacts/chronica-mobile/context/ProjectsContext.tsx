import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Project, Fragment, ProjectAsset, Choice } from '@/engine/types';

const STORAGE_KEY = 'chronica_projects_v1';

const generateId = (): string =>
  Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

interface ProjectsContextType {
  projects: Project[];
  isLoaded: boolean;
  createProject: (title: string, description: string) => Project;
  updateProject: (id: string, updates: Partial<Pick<Project, 'title' | 'description'>>) => void;
  deleteProject: (id: string) => void;
  addFragment: (projectId: string, fragment: Omit<Fragment, 'uid'>) => Fragment;
  updateFragment: (projectId: string, uid: string, updates: Partial<Fragment>) => void;
  deleteFragment: (projectId: string, uid: string) => void;
  addAsset: (projectId: string, asset: ProjectAsset) => void;
  deleteAsset: (projectId: string, assetId: string) => void;
  getProject: (id: string) => Project | undefined;
  syncProjectToCloud: (projectId: string) => Promise<boolean>;
  downloadProjectFromCloud: (projectId: string) => Promise<boolean>;
}

const ProjectsContext = createContext<ProjectsContextType | null>(null);

const getApiBase = () => {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}` : '';
};

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(json => { if (json) setProjects(JSON.parse(json)); })
      .catch(() => {})
      .finally(() => setIsLoaded(true));
  }, []);

  const save = (next: Project[]) => {
    setProjects(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  };

  const now = () => new Date().toISOString();

  const createProject = (title: string, description: string): Project => {
    const p: Project = {
      id: generateId(), title, description,
      createdAt: now(), updatedAt: now(),
      fragments: [], assets: [],
    };
    save([...projects, p]);
    return p;
  };

  const updateProject = (id: string, updates: Partial<Pick<Project, 'title' | 'description'>>) =>
    save(projects.map(p => p.id === id ? { ...p, ...updates, updatedAt: now() } : p));

  const deleteProject = (id: string) => save(projects.filter(p => p.id !== id));

  const addFragment = (projectId: string, fragment: Omit<Fragment, 'uid'>): Fragment => {
    const f: Fragment = { ...fragment, uid: generateId() };
    save(projects.map(p => p.id === projectId
      ? { ...p, fragments: [...p.fragments, f], updatedAt: now() } : p));
    return f;
  };

  const updateFragment = (projectId: string, uid: string, updates: Partial<Fragment>) =>
    save(projects.map(p => p.id === projectId
      ? { ...p, updatedAt: now(), fragments: p.fragments.map(f => f.uid === uid ? { ...f, ...updates } : f) }
      : p));

  const deleteFragment = (projectId: string, uid: string) =>
    save(projects.map(p => p.id === projectId
      ? { ...p, updatedAt: now(), fragments: p.fragments.filter(f => f.uid !== uid) }
      : p));

  const addAsset = (projectId: string, asset: ProjectAsset) =>
    save(projects.map(p => p.id === projectId
      ? { ...p, assets: [...p.assets, asset], updatedAt: now() } : p));

  const deleteAsset = (projectId: string, assetId: string) =>
    save(projects.map(p => p.id === projectId
      ? { ...p, assets: p.assets.filter(a => a.id !== assetId), updatedAt: now() } : p));

  const getProject = (id: string) => projects.find(p => p.id === id);

  const syncProjectToCloud = async (projectId: string): Promise<boolean> => {
    const project = getProject(projectId);
    if (!project) return false;
    try {
      const base = getApiBase();
      if (!base) return false;
      const res = await fetch(`${base}/api/projects/${projectId}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project }),
      });
      return res.ok;
    } catch { return false; }
  };

  const downloadProjectFromCloud = async (projectId: string): Promise<boolean> => {
    try {
      const base = getApiBase();
      if (!base) return false;
      const res = await fetch(`${base}/api/projects/${projectId}/sync`);
      if (!res.ok) return false;
      const data = await res.json();
      if (data.project) {
        const exists = projects.some(p => p.id === projectId);
        if (exists) {
          save(projects.map(p => p.id === projectId ? data.project : p));
        } else {
          save([...projects, data.project]);
        }
        return true;
      }
      return false;
    } catch { return false; }
  };

  return (
    <ProjectsContext.Provider value={{
      projects, isLoaded,
      createProject, updateProject, deleteProject,
      addFragment, updateFragment, deleteFragment,
      addAsset, deleteAsset, getProject,
      syncProjectToCloud, downloadProjectFromCloud,
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
