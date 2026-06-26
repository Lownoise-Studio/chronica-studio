import { Project } from '../types';
import { parseActionString } from '../actions/parse-action';
import { ActionStep } from '../actions/types';
import { COMPILED_GAME_VERSION, CompiledGame } from './types';
import { buildFragmentIndex } from './fragment-index';

/** Resolve the opening location used when a compiled session starts. */
export function resolveCompileStartLocation(project: Project): string {
  if (!project.fragments.length) return project.startLocation?.trim() ?? '';
  const configured = project.startLocation?.trim();
  if (configured && project.fragments.some(f => f.locationId === configured)) {
    return configured;
  }
  return project.fragments[0].locationId;
}

/** Stable hash of authored project content — used by CompiledGame and package manifests. */
export function computeProjectContentHash(project: Project): string {
  const payload = JSON.stringify({
    gameId: project.gameId,
    schemaVersion: project.schemaVersion,
    startLocation: project.startLocation,
    initialVariables: project.initialVariables,
    initialMemory: project.initialMemory,
    fragments: project.fragments,
    assets: project.assets.map(a => ({
      id: a.id,
      name: a.name,
      type: a.type,
      uri: a.uri,
    })),
    characters: project.characters ?? [],
  });

  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    hash = ((hash << 5) - hash + payload.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function buildChoiceActions(project: Project): Record<string, ActionStep[]> {
  const choiceActions: Record<string, ActionStep[]> = {};
  for (const frag of project.fragments) {
    for (const choice of frag.choices) {
      const parsed = parseActionString(choice.action ?? '');
      if (!parsed.ok) {
        throw new Error(`buildCompiledGame: invalid action for choice ${choice.uid}: ${parsed.error}`);
      }
      choiceActions[choice.uid] = [...parsed.steps];
    }
  }
  return choiceActions;
}

function buildHotspotActions(project: Project): Record<string, ActionStep[]> {
  const hotspotActions: Record<string, ActionStep[]> = {};
  for (const frag of project.fragments) {
    for (const hotspot of frag.hotspots ?? []) {
      const parsed = parseActionString(hotspot.action ?? '');
      if (!parsed.ok) {
        throw new Error(`buildCompiledGame: invalid action for hotspot ${hotspot.uid}: ${parsed.error}`);
      }
      hotspotActions[hotspot.uid] = [...parsed.steps];
    }
  }
  return hotspotActions;
}

/**
 * Build a CompiledGame from a Project without running validation.
 * Use compileProject() at product boundaries; this is for tests and internal reuse.
 */
export function buildCompiledGame(project: Project): CompiledGame {
  const fragments = project.fragments.map(f => ({
    ...f,
    conditions: [...(f.conditions ?? [])],
    effects: [...(f.effects ?? [])],
    choices: (f.choices ?? []).map(c => ({
      ...c,
      conditions: [...(c.conditions ?? [])],
    })),
    hotspots: (f.hotspots ?? []).map(h => ({
      ...h,
      conditions: [...(h.conditions ?? [])],
    })),
    dialogue: (f.dialogue ?? []).map(line => ({ ...line })),
  }));

  return {
    version: COMPILED_GAME_VERSION,
    contentHash: computeProjectContentHash(project),
    gameId: project.gameId,
    installId: project.id,
    projectId: project.id,
    title: project.title,
    description: project.description,
    startLocation: resolveCompileStartLocation(project),
    initialVariables: { ...(project.initialVariables ?? {}) },
    initialMemory: { ...(project.initialMemory ?? {}) },
    fragments,
    assets: project.assets.map(a => ({ ...a })),
    characters: (project.characters ?? []).map(c => ({
      ...c,
      expressions: (c.expressions ?? []).map(e => ({ ...e })),
    })),
    fragmentIndex: buildFragmentIndex(fragments),
    choiceActions: buildChoiceActions(project),
    hotspotActions: buildHotspotActions(project),
  };
}
