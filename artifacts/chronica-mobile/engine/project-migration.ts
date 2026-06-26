import { Fragment, Project } from './types';
import { createId } from './identity/create-id';

export const PROJECT_SCHEMA_VERSION = 2;

/** Match a fragment by canonical locationId or legacy human-readable title. */
function findFragmentByLocationKey(fragments: Fragment[], key: string): Fragment | undefined {
  const k = key.trim();
  if (!k) return undefined;

  const byId = fragments.find(f => f.locationId?.trim() === k);
  if (byId) return byId;

  const lower = k.toLowerCase();
  const byIdCi = fragments.find(f => f.locationId?.trim().toLowerCase() === lower);
  if (byIdCi) return byIdCi;

  const byTitle = fragments.find(f => f.title?.trim() === k);
  if (byTitle) return byTitle;

  return fragments.find(f => f.title?.trim().toLowerCase() === lower);
}

/** Resolve startLocation to a canonical fragment locationId when possible. */
export function resolveStartLocation(fragments: Fragment[], startLocation: string | undefined): string {
  const configured = startLocation?.trim();
  if (!configured) {
    return fragments[0]?.locationId?.trim() || 'start';
  }

  const match = findFragmentByLocationKey(fragments, configured);
  if (match?.locationId?.trim()) {
    return match.locationId.trim();
  }

  return configured;
}

function migrateChoiceAction(action: string, fragments: Fragment[]): string {
  const knownIds = new Set(fragments.map(f => f.locationId.trim()).filter(Boolean));
  const parts = action.split(';').map(s => s.trim()).filter(Boolean);
  if (!parts.length) return action;

  const migrated = parts.map(part => {
    if (!part.startsWith('goto:')) return part;
    const target = part.slice('goto:'.length).trim();
    if (!target || knownIds.has(target)) return part;
    const resolved = findFragmentByLocationKey(fragments, target);
    return resolved?.locationId?.trim() ? `goto:${resolved.locationId.trim()}` : part;
  });

  return migrated.join('; ');
}

function migrateFragmentFields(f: Fragment): Fragment {
  const title = (f.title ?? '').trim();
  const locationId = (f.locationId ?? '').trim() || title || 'scene';

  return {
    ...f,
    title: title || locationId,
    locationId,
    conditions: f.conditions ?? [],
    effects: f.effects ?? [],
    choices: (f.choices ?? []).map(c => ({
      ...c,
      conditions: c.conditions ?? [],
    })),
    hotspots: (f.hotspots ?? []).map(h => ({
      ...h,
      conditions: h.conditions ?? [],
    })),
  };
}

/**
 * Backfill missing fields on loaded or imported projects.
 */
export function migrateProject(p: Project): Project {
  const fragments = (p.fragments ?? []).map(migrateFragmentFields);
  const withActions = fragments.map(f => ({
    ...f,
    choices: f.choices.map(c => ({
      ...c,
      action: migrateChoiceAction(c.action ?? '', fragments),
    })),
    hotspots: (f.hotspots ?? []).map(h => ({
      ...h,
      action: migrateChoiceAction(h.action ?? '', fragments),
    })),
  }));

  return {
    ...p,
    schemaVersion: p.schemaVersion ?? PROJECT_SCHEMA_VERSION,
    gameId: p.gameId?.trim() || createId(),
    startLocation: resolveStartLocation(withActions, p.startLocation),
    initialVariables: p.initialVariables ?? {},
    initialMemory: p.initialMemory ?? {},
    assets: p.assets ?? [],
    fragments: withActions,
  };
}
