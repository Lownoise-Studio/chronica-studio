import { Project } from '../types';
import { validateProject } from '../validator';
import { buildCompiledGame } from './build-compiled-game';
import { CompileResult } from './types';

/**
 * Compile an editor Project into a runtime-ready CompiledGame.
 * Returns diagnostics when the project fails validation — runtime must not start.
 */
export function compileProject(project: Project): CompileResult {
  const diagnostics = validateProject(project);
  if (diagnostics.length > 0) {
    return { ok: false, diagnostics };
  }
  return { ok: true, game: buildCompiledGame(project) };
}
