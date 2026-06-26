import type { Project } from '@/engine/types';
import { SHOWCASE_GAME_ID } from './showcase-project';

/** Stable gameId for the first-launch sample project seeded in the library. */
export const SAMPLE_GAME_ID = 'c1000001-0000-4000-8000-000000000001';

export function isBundledDemoProject(project: Pick<Project, 'gameId'>): boolean {
  return project.gameId === SAMPLE_GAME_ID || project.gameId === SHOWCASE_GAME_ID;
}
