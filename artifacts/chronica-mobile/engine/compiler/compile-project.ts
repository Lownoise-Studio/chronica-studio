import { Project } from '../types';
import { validateProject } from '../validator';
import { analyzeProjectWarnings } from '../analyze-warnings';
import { buildCompiledGame } from './build-compiled-game';
import { CompileResult } from './types';

/**
 * Compile an editor Project into a runtime-ready CompiledGame.
 * Returns diagnostics when the project fails validation — runtime must not start.
 * On success, attaches non-blocking semantic warnings (typos, dead-end targets).
 */
export function compileProject(project: Project): CompileResult {
  const diagnostics = validateProject(project);
  const errors = diagnostics.filter(d => d.severity !== 'warning');
  if (errors.length > 0) {
    return { ok: false, diagnostics: errors };
  }
  return { ok: true, game: buildCompiledGame(project), warnings: analyzeProjectWarnings(project) };
}
