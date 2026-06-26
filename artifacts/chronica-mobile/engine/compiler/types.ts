import { Fragment, ProjectAsset, ValidationError, VariableValue, Character } from '../types';
import type { ActionStep } from '../actions/types';
import type { FragmentIndex } from './fragment-index';

export const COMPILED_GAME_VERSION = 2;

/**
 * Immutable runtime input produced by the compiler.
 * The runtime must only execute CompiledGame — never raw Project JSON.
 */
export interface CompiledGame {
  version: number;
  /** Changes when any runtime-relevant project content changes. */
  contentHash: string;
  /** Stable game identity from Project.gameId. */
  gameId: string;
  /** Local install id from Project.id. */
  installId: string;
  /** @deprecated Use installId — kept for compatibility. */
  projectId: string;
  title: string;
  description: string;
  startLocation: string;
  initialVariables: Readonly<Record<string, VariableValue>>;
  initialMemory: Readonly<Record<string, VariableValue>>;
  fragments: readonly Fragment[];
  assets: readonly ProjectAsset[];
  characters: readonly Character[];
  fragmentIndex: FragmentIndex;
  /** Compiled action steps keyed by choice.uid */
  choiceActions: Readonly<Record<string, readonly ActionStep[]>>;
  /** Compiled action steps keyed by hotspot.uid */
  hotspotActions: Readonly<Record<string, readonly ActionStep[]>>;
}

export type CompileResult =
  | { ok: true; game: CompiledGame; warnings: ValidationError[] }
  | { ok: false; diagnostics: ValidationError[] };
