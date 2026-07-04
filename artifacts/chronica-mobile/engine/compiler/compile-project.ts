import { Project } from '../types';
import { analyzeProjectWarnings } from '../analyze-warnings';
import {
  collectCompileValidation,
  filterCompileBlockers,
  type CompileValidationOptions,
} from '../validation-severity';
import { buildCompiledGame } from './build-compiled-game';
import { CompileResult } from './types';

export type CompileOptions = CompileValidationOptions;

/**
 * Compile an editor Project into a runtime-ready CompiledGame.
 * Returns diagnostics when the project fails validation — runtime must not start.
 * On success, attaches non-blocking semantic warnings (typos, dead-end targets).
 *
 * Default validation preserves legacy compile blocking (severity !== 'warning').
 * Pass `{ strictValidation: true }` to also gate on adventure invariants and duplicate interactable ids.
 */
export function compileProject(project: Project, options?: CompileOptions): CompileResult {
  const diagnostics = collectCompileValidation(project, options);
  const errors = filterCompileBlockers(diagnostics, options);
  if (errors.length > 0) {
    return { ok: false, diagnostics: errors };
  }
  return { ok: true, game: buildCompiledGame(project), warnings: analyzeProjectWarnings(project) };
}
