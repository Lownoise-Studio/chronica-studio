import { Fragment, Project, VariableValue } from './types';

export type VariableType = 'boolean' | 'number' | 'string' | 'unknown';

export interface StoryVariable {
  name: string;
  type: VariableType;
  /** Raw assignment literal from effects/actions, used for string templates */
  rawValue: string;
}

export interface SceneOption {
  locationId: string;
  title: string;
}

const VARIABLE_ASSIGN_RE = /variables\.(\w+)\s*(?:[+\-*]=|=)\s*(.+)/;

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
      for (const step of choice.action.split(';').map(s => s.trim()).filter(Boolean)) {
        const parsed = extractVariableFromEffect(step);
        if (parsed) record(parsed.name, parsed.rawValue);
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
    .map(f => ({ locationId: f.locationId, title: f.title || f.locationId }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function getGotoTarget(action: string): string | null {
  for (const step of action.split(';').map(s => s.trim()).filter(Boolean)) {
    if (step.startsWith('goto:')) return step.slice(5).trim();
  }
  return null;
}

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
