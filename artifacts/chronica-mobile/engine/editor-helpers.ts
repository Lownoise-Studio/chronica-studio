import { Fragment, Project, VariableValue } from './types';
import { parseActionString } from './actions/parse-action';
import { collectGameplayConditionSuggestions } from './gameplay-authoring';

export type VariableType = 'boolean' | 'number' | 'string' | 'unknown';

export interface StoryVariable {
  name: string;
  type: VariableType;
  /** Raw assignment literal from effects/actions, used for string templates */
  rawValue: string;
}

export interface SceneOption {
  uid: string;
  locationId: string;
  title: string;
}

const MEMORY_PATH_ASSIGN_RE = /memory\.(\w+)\s*(?:=|[+\-]=)/;

function extractMemoryFlagsFromAction(action: string): string[] {
  const flags: string[] = [];
  const parsed = parseActionString(action);
  if (parsed.ok) {
    for (const step of parsed.steps) {
      if (step.kind === 'set') flags.push(step.flag);
      if (step.kind === 'clear') flags.push(step.flag);
    }
  }
  return flags;
}

function extractMemoryPathsFromEffect(effect: string): string[] {
  const m = effect.trim().match(MEMORY_PATH_ASSIGN_RE);
  return m ? [m[1]] : [];
}

/** Collect memory flags from initialMemory, set/clear actions, and memory.* effects. */
export function extractProjectMemoryFlags(
  project: Pick<Project, 'fragments' | 'initialMemory'>,
): string[] {
  const flags = new Set<string>();

  for (const [key, value] of Object.entries(project.initialMemory ?? {})) {
    if (key.trim()) flags.add(key.trim());
    void value;
  }

  for (const frag of project.fragments) {
    for (const effect of frag.effects) {
      for (const key of extractMemoryPathsFromEffect(effect)) flags.add(key);
    }
    for (const choice of frag.choices) {
      for (const key of extractMemoryFlagsFromAction(choice.action ?? '')) flags.add(key);
    }
    for (const hotspot of frag.hotspots ?? []) {
      for (const key of extractMemoryFlagsFromAction(hotspot.action ?? '')) flags.add(key);
      for (const key of extractMemoryPathsFromEffect(hotspot.action ?? '')) flags.add(key);
    }
  }

  return Array.from(flags).sort();
}

const VARIABLE_ASSIGN_RE = /variables\.(\w+)\s*(?:[+\-*]=|=)\s*(.+)/;

export interface GameplaySuggestion {
  label: string;
  value: string;
}

/** Merge variables, memory flags, and gameplay catalog entries into condition chips. */
export function buildGameplaySuggestions(project: Project): GameplaySuggestion[] {
  const suggestions: GameplaySuggestion[] = [];
  const seen = new Set<string>();

  const add = (label: string, value: string) => {
    const key = value.trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    suggestions.push({ label, value: key });
  };

  for (const variable of extractProjectVariables(project)) {
    add(variable.name, buildUnlockCondition(variable.name, variable.type, variable.rawValue));
  }

  for (const flag of extractProjectMemoryFlags(project)) {
    add(`memory.${flag}`, `memory.${flag} == true`);
  }

  for (const value of collectGameplayConditionSuggestions(project)) {
    add(value, value);
  }

  return suggestions.sort((a, b) => a.label.localeCompare(b.label));
}

function inferType(rawVal: string, jsValue?: VariableValue): VariableType {
  if (jsValue !== undefined) {
    if (typeof jsValue === 'boolean') return 'boolean';
    if (typeof jsValue === 'number') return 'number';
    if (typeof jsValue === 'string') return 'string';
  }
  const t = rawVal.trim();
  if (t === 'true' || t === 'false') return 'boolean';
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return 'string';
  }
  if (!isNaN(Number(t)) && t !== '') return 'number';
  return 'unknown';
}

export function extractVariableFromEffect(effect: string): { name: string; rawValue: string } | null {
  const m = effect.trim().match(VARIABLE_ASSIGN_RE);
  if (!m) return null;
  return { name: m[1], rawValue: m[2].trim() };
}

export function buildUnlockCondition(name: string, type: VariableType, rawValue: string): string {
  switch (type) {
    case 'boolean':
      return `variables.${name} == true`;
    case 'number':
      return `variables.${name} >= 1`;
    case 'string': {
      if (rawValue.startsWith('"') || rawValue.startsWith("'")) {
        return `variables.${name} == ${rawValue}`;
      }
      const unquoted = rawValue.replace(/^["']|["']$/g, '');
      return `variables.${name} == "${unquoted}"`;
    }
    default:
      return `variables.${name} == ${rawValue || 'true'}`;
  }
}

export function conditionUsesVariable(condition: string, varName: string): boolean {
  return new RegExp(`\\bvariables\\.${varName}\\b`).test(condition);
}

export function isVariableInConditions(varName: string, conditions: string[]): boolean {
  return conditions.some(c => conditionUsesVariable(c, varName));
}

/** Collect variables assigned in scene effects, choice actions, and initialVariables. */
export function extractProjectVariables(
  project: Pick<Project, 'fragments' | 'initialVariables'>,
): StoryVariable[] {
  const varMap = new Map<string, StoryVariable>();

  const record = (name: string, rawValue: string, jsValue?: VariableValue) => {
    if (varMap.has(name)) return;
    varMap.set(name, { name, type: inferType(rawValue, jsValue), rawValue });
  };

  for (const frag of project.fragments) {
    for (const effect of frag.effects) {
      const parsed = extractVariableFromEffect(effect);
      if (parsed) record(parsed.name, parsed.rawValue);
    }
    for (const choice of frag.choices) {
      const parsed = parseActionString(choice.action ?? '');
      if (!parsed.ok) continue;
      for (const step of parsed.steps) {
        if (step.kind === 'assign' && step.path.startsWith('variables.')) {
          record(step.path.slice('variables.'.length), step.rawValue);
        } else if (step.kind === 'increment' && step.path.startsWith('variables.')) {
          record(step.path.slice('variables.'.length), String(step.amount));
        } else if (step.kind === 'decrement' && step.path.startsWith('variables.')) {
          record(step.path.slice('variables.'.length), String(-step.amount));
        }
      }
    }
  }

  if (project.initialVariables) {
    for (const [name, value] of Object.entries(project.initialVariables)) {
      record(name, JSON.stringify(value), value);
    }
  }

  return Array.from(varMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function getSceneOptions(fragments: Fragment[]): SceneOption[] {
  return fragments
    .map(f => ({ uid: f.uid, locationId: f.locationId, title: f.title || f.locationId }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export { getGotoTarget } from './actions/parse-action';

export function setGotoInAction(action: string, locationId: string): string {
  const steps = action.split(';').map(s => s.trim()).filter(Boolean);
  const withoutGoto = steps.filter(s => !s.startsWith('goto:'));
  const target = locationId.trim();
  if (!target) return withoutGoto.join('; ');
  return [...withoutGoto, `goto:${target}`].join('; ');
}

export function isValidDestination(locationId: string, knownLocations: Iterable<string>): boolean {
  const known = knownLocations instanceof Set ? knownLocations : new Set(knownLocations);
  return !!locationId && known.has(locationId);
}
