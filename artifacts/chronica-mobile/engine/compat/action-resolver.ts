import { parseActionString } from '../actions/parse-action';
import { resolveActionSteps } from '../actions/resolve-action';
import type { ActionStep, ParseActionResult } from '../actions/types';
import type { ChronicaState } from '../types';

/**
 * Class facade mirroring the Godot engine's ActionResolver. Compiled steps are
 * the primary path; the string form is retained for tests and editor tools.
 */
export class ActionResolver {
  /** Execute compiled action steps against the state (mutates in place). */
  apply(steps: readonly ActionStep[], state: ChronicaState): void {
    resolveActionSteps(steps, state);
  }

  /** Parse a raw action string into typed steps. */
  parse(action: string): ParseActionResult {
    return parseActionString(action);
  }

  /** Parse then execute; unusable strings are silently skipped (matches editor behavior). */
  applyString(action: string, state: ChronicaState): void {
    const parsed = parseActionString(action);
    if (!parsed.ok) return;
    resolveActionSteps(parsed.steps, state);
  }
}
