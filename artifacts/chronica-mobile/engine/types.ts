export type VariableValue = string | number | boolean;

export interface Choice {
  uid: string;
  label: string;
  action: string;
  conditions: string[];
}

export interface Fragment {
  uid: string;
  locationId: string;
  priority: number;
  conditions: string[];
  effects: string[];
  text: string;
  choices: Choice[];
  backgroundImage?: string;
  backgroundAudio?: string;
}

export interface ChronicaState {
  location: string;
  instability: number;
  reality_layer: number;
  memory: Record<string, VariableValue>;
  variables: Record<string, VariableValue>;
}

export interface ProjectAsset {
  id: string;
  name: string;
  type: 'image' | 'audio' | 'data';
  uri: string;
  mimeType: string;
  size: number;
  importedAt: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  startLocation: string;
  initialVariables: Record<string, VariableValue>;
  initialMemory: Record<string, VariableValue>;
  createdAt: string;
  updatedAt: string;
  fragments: Fragment[];
  assets: ProjectAsset[];
}

export interface GameSave {
  projectId: string;
  state: Record<string, unknown>;
  savedAt: string;
}
