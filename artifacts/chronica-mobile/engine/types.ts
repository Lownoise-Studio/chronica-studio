export type VariableValue = string | number | boolean;

export interface Choice {
  uid: string;
  label: string;
  /** action string: goto:<locationId> | set:<flag> | clear:<flag> | expr | multi-step semicolon */
  action: string;
  /** conditions that must all pass for this choice to appear */
  conditions: string[];
}

export interface Fragment {
  uid: string;
  /** human-readable name, shown in the editor list */
  title: string;
  /** semantic graph node id; choices use goto:<locationId> to navigate here */
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
  schemaVersion: number;
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

export interface ValidationError {
  fragmentUid: string;
  fragmentTitle: string;
  type: 'broken-link' | 'invalid-condition' | 'invalid-effect' | 'missing-start';
  message: string;
}
