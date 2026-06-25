import { Fragment, ProjectAsset, ValidationError, VariableValue } from '../types';
import type { FragmentIndex } from './fragment-index';

export const COMPILED_GAME_VERSION = 1;

/**
 * Immutable runtime input produced by the compiler.
 * The runtime must only execute CompiledGame — never raw Project JSON.
 */
export interface CompiledGame {
  version: number;
  /** Changes when any runtime-relevant project content changes. */
  contentHash: string;
  projectId: string;
  title: string;
  description: string;
  startLocation: string;
  initialVariables: Readonly<Record<string, VariableValue>>;
  initialMemory: Readonly<Record<string, VariableValue>>;
  fragments: readonly Fragment[];
  assets: readonly ProjectAsset[];
  fragmentIndex: FragmentIndex;
}

export type CompileResult =
  | { ok: true; game: CompiledGame }
  | { ok: false; diagnostics: ValidationError[] };
