import { Fragment, ChronicaState } from './types';
import {
  buildFragmentIndex,
  getActiveFragmentFromIndex,
  type FragmentIndex,
} from './compiler/fragment-index';

export type { FragmentIndex };
export { buildFragmentIndex, getActiveFragmentFromIndex };

/** @deprecated Prefer getActiveFragmentFromIndex with a CompiledGame fragmentIndex. */
export function getActiveFragment(
  locationId: string,
  state: ChronicaState,
  fragments: Fragment[],
): Fragment | null {
  return getActiveFragmentFromIndex(locationId, state, buildFragmentIndex(fragments));
}
