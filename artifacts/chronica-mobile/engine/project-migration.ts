import { Project } from './types';
import { createId } from './identity/create-id';

export const PROJECT_SCHEMA_VERSION = 2;

/**
 * Backfill missing fields on loaded or imported projects.
 */
export function migrateProject(p: Project): Project {
  return {
    ...p,
    schemaVersion: p.schemaVersion ?? PROJECT_SCHEMA_VERSION,
    gameId: p.gameId?.trim() || createId(),
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
