import { Project, Fragment } from '../types';
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

const FNV_OFFSET_BASIS_64 = 0xcbf29ce484222325n;
const FNV_PRIME_64 = 0x100000001b3n;
const U64_MASK = 0xffffffffffffffffn;

/**
 * FNV-1a 64-bit hash over a UTF-16 string, processed two bytes per code unit so
 * every character (including non-ASCII story text) affects the digest.
 *
 * Replaces the prior 32-bit rolling hash: this is load-bearing for stale-save
 * rejection and package-manifest integrity, where a collision would silently
 * accept incompatible content. A 64-bit digest makes that collision
 * probability negligible (~5e-20 per edit vs ~2e-10 at 32-bit).
 */
function fnv1a64Hex(input: string): string {
  let hash = FNV_OFFSET_BASIS_64;
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    hash ^= BigInt(code & 0xff);
    hash = (hash * FNV_PRIME_64) & U64_MASK;
    hash ^= BigInt((code >> 8) & 0xff);
    hash = (hash * FNV_PRIME_64) & U64_MASK;
  }
  return hash.toString(16).padStart(16, '0');
}

/** Strip editor-only stage composition before compile/hash. */
export function fragmentForRuntimeCompile<T extends Fragment>(fragment: T): Omit<T, 'stageAuthoring'> {
  const { stageAuthoring: _stageAuthoring, ...runtimeFragment } = fragment;
  return runtimeFragment;
}

/** Stable hash of authored project content — used by CompiledGame and package manifests. */
export function computeProjectContentHash(project: Project): string {
  const payload = JSON.stringify({
    gameId: project.gameId,
    schemaVersion: project.schemaVersion,
    startLocation: project.startLocation,
    initialVariables: project.initialVariables,
    initialMemory: project.initialMemory,
    fragments: project.fragments.map(fragmentForRuntimeCompile),
    assets: project.assets.map(a => ({
      id: a.id,
      name: a.name,
      type: a.type,
      uri: a.uri,
    })),
    characters: project.characters ?? [],
  });

  return fnv1a64Hex(payload);
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

function buildInteractableActions(project: Project): Record<string, ActionStep[]> {
  const interactableActions: Record<string, ActionStep[]> = {};
  for (const frag of project.fragments) {
    for (const interactable of frag.adventure?.interactables ?? []) {
      const parsed = parseActionString(interactable.action ?? '');
      if (!parsed.ok) {
        throw new Error(
          `buildCompiledGame: invalid action for interactable ${interactable.uid}: ${parsed.error}`,
        );
      }
      interactableActions[interactable.uid] = [...parsed.steps];
    }
  }
  return interactableActions;
}

/**
 * Build a CompiledGame from a Project without running validation.
 * Use compileProject() at product boundaries; this is for tests and internal reuse.
 */
export function buildCompiledGame(project: Project): CompiledGame {
  const fragments = project.fragments.map(f => {
    const runtime = fragmentForRuntimeCompile(f);
    return {
    ...runtime,
    conditions: [...(runtime.conditions ?? [])],
    effects: [...(runtime.effects ?? [])],
    choices: (runtime.choices ?? []).map(c => ({
      ...c,
      conditions: [...(c.conditions ?? [])],
    })),
    hotspots: (runtime.hotspots ?? []).map(h => ({
      ...h,
      conditions: [...(h.conditions ?? [])],
    })),
    stageActors: (runtime.stageActors ?? []).map(a => ({
      ...a,
      expressions: (a.expressions ?? []).map(e => ({ ...e })),
      visibleWhen: [...(a.visibleWhen ?? [])],
    })),
    dialogue: (runtime.dialogue ?? []).map(line => ({ ...line })),
    adventure: runtime.adventure
      ? {
          ...runtime.adventure,
          entry: {
            default: { ...runtime.adventure.entry.default },
            from: runtime.adventure.entry.from
              ? Object.fromEntries(
                  Object.entries(runtime.adventure.entry.from).map(([k, v]) => [k, { ...v }]),
                )
              : undefined,
          },
          colliders: (runtime.adventure.colliders ?? []).map(c => ({ ...c })),
          interactables: (runtime.adventure.interactables ?? []).map(i => ({
            ...i,
            conditions: [...(i.conditions ?? [])],
          })),
          sfx: runtime.adventure.sfx ? { ...runtime.adventure.sfx } : undefined,
        }
      : undefined,
  };
  });

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
    interactableActions: buildInteractableActions(project),
  };
}
