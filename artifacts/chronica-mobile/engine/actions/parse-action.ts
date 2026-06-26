import { isValidEffect } from '../expression-evaluator';
import { ActionStep, ParseActionResult } from './types';

const incrementRegex = /^\s*(\w+(?:\.\w+)?)\s*\+=\s*(-?\d+)\s*$/;
const decrementRegex = /^\s*(\w+(?:\.\w+)?)\s*-=\s*(-?\d+)\s*$/;
const assignmentRegex = /^\s*(\w+(?:\.\w+)?)\s*=\s*(.+?)\s*$/;

function parseSingleStep(step: string): ParseActionResult {
  const t = step.trim();
  if (!t) {
    return { ok: false, error: 'Empty action step.' };
  }

  if (t.startsWith('goto:')) {
    const locationId = t.slice('goto:'.length).trim();
    if (!locationId) {
      return { ok: false, error: 'goto: requires a location id.' };
    }
    return { ok: true, steps: [{ kind: 'goto', locationId }] };
  }

  if (t.startsWith('set:')) {
    const flag = t.slice('set:'.length).trim();
    if (!flag) {
      return { ok: false, error: 'set: requires a flag name.' };
    }
    return { ok: true, steps: [{ kind: 'set', flag }] };
  }

  if (t.startsWith('clear:')) {
    const flag = t.slice('clear:'.length).trim();
    if (!flag) {
      return { ok: false, error: 'clear: requires a flag name.' };
    }
    return { ok: true, steps: [{ kind: 'clear', flag }] };
  }

  const incrMatch = t.match(incrementRegex);
  if (incrMatch) {
    return {
      ok: true,
      steps: [{ kind: 'increment', path: incrMatch[1], amount: parseInt(incrMatch[2], 10) }],
    };
  }

  const decrMatch = t.match(decrementRegex);
  if (decrMatch) {
    return {
      ok: true,
      steps: [{ kind: 'decrement', path: decrMatch[1], amount: parseInt(decrMatch[2], 10) }],
    };
  }

  const assignMatch = t.match(assignmentRegex);
  if (assignMatch && isValidEffect(t)) {
    return {
      ok: true,
      steps: [{ kind: 'assign', path: assignMatch[1], rawValue: assignMatch[2].trim() }],
    };
  }

  return { ok: false, error: `Unrecognized action step: "${t}"` };
}

/**
 * Parse a choice action string into typed steps (semicolon-separated).
 */
export function parseActionString(action: string): ParseActionResult {
  const raw = action.trim();
  if (!raw) {
    return { ok: true, steps: [] };
  }

  const parts = raw.split(';').map(s => s.trim()).filter(Boolean);
  if (!parts.length) {
    return { ok: true, steps: [] };
  }

  const steps: ActionStep[] = [];
  for (const part of parts) {
    const result = parseSingleStep(part);
    if (!result.ok) return result;
    steps.push(...result.steps);
  }

  return { ok: true, steps };
}

/** Extract all goto targets from an action string. */
export function getGotoTargetsFromAction(action: string): string[] {
  const parsed = parseActionString(action);
  if (!parsed.ok) return [];
  return parsed.steps
    .filter((s): s is ActionStep & { kind: 'goto' } => s.kind === 'goto')
    .map(s => s.locationId);
}

/** First goto target in an action string, if any. */
export function getGotoTarget(action: string): string | null {
  const targets = getGotoTargetsFromAction(action);
  return targets[0] ?? null;
}
