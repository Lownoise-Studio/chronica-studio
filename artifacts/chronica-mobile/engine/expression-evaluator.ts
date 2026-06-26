import { ChronicaState, VariableValue } from './types';

const conditionRegex = /^\s*(\w+(?:\.\w+)?)\s*(>=|<=|==|!=|>|<)\s*(.+?)\s*$/;
const incrementRegex = /^\s*(\w+(?:\.\w+)?)\s*\+=\s*(-?\d+)\s*$/;
const decrementRegex = /^\s*(\w+(?:\.\w+)?)\s*-=\s*(-?\d+)\s*$/;
const assignmentRegex = /^\s*(\w+(?:\.\w+)?)\s*=\s*(.+?)\s*$/;

function parseValue(raw: string): VariableValue {
  const t = raw.trim();
  if (t === 'true') return true;
  if (t === 'false') return false;
  const n = Number(t);
  // Only treat as numeric when finite — "1e400"/Infinity/NaN must never enter
  // state, since JSON.stringify turns them into null on save (silent corruption).
  if (Number.isFinite(n) && t !== '') return n;
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

/** Coerce any stored value to a finite number for arithmetic; non-numeric -> 0. */
function coerceNumber(value: VariableValue | undefined): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function resolvePath(path: string, state: ChronicaState): VariableValue {
  if (path.startsWith('variables.')) {
    const key = path.slice('variables.'.length);
    const v = state.variables[key];
    return v !== undefined ? (v as VariableValue) : 0;
  }
  if (path.startsWith('memory.')) {
    const key = path.slice('memory.'.length);
    const v = state.memory[key];
    return v !== undefined ? (v as VariableValue) : false;
  }
  switch (path) {
    case 'instability': return state.instability;
    case 'reality_layer': return state.reality_layer;
    case 'location': return state.location;
    default: return 0;
  }
}

function compare(left: VariableValue, op: string, right: VariableValue): boolean {
  switch (op) {
    // Ordering comparisons are numeric; coerce both sides deterministically so a
    // string-vs-number comparison can't depend on JS's implicit coercion rules.
    case '>=': return coerceNumber(left) >= coerceNumber(right);
    case '<=': return coerceNumber(left) <= coerceNumber(right);
    case '>': return coerceNumber(left) > coerceNumber(right);
    case '<': return coerceNumber(left) < coerceNumber(right);
    case '==': return left === right;
    case '!=': return left !== right;
    default: return false;
  }
}

export function evaluateCondition(expression: string, state: ChronicaState): boolean {
  const t = expression.trim();
  if (!t) return true;
  const match = t.match(conditionRegex);
  if (!match) return false;
  const [, leftPath, operator, rightRaw] = match;
  return compare(resolvePath(leftPath, state), operator, parseValue(rightRaw));
}

function applyIncrement(path: string, amount: number, state: ChronicaState): void {
  if (path.startsWith('memory.')) {
    const key = path.slice('memory.'.length);
    // coerceNumber, not `as number`: incrementing a non-numeric value must not
    // silently string-concatenate ("abc" += 1 -> "abc1").
    state.memory[key] = coerceNumber(state.memory[key]) + amount;
    return;
  }
  if (path.startsWith('variables.')) {
    const key = path.slice('variables.'.length);
    state.variables[key] = coerceNumber(state.variables[key]) + amount;
    if (key === 'instability') state.instability = state.variables[key] as number;
    return;
  }
  switch (path) {
    case 'instability':
      state.instability += amount;
      state.variables['instability'] = state.instability;
      break;
    case 'reality_layer':
      state.reality_layer += amount;
      break;
  }
}

function applyAssignment(path: string, value: VariableValue, state: ChronicaState): void {
  if (path.startsWith('memory.')) {
    state.memory[path.slice('memory.'.length)] = value;
    return;
  }
  if (path.startsWith('variables.')) {
    const key = path.slice('variables.'.length);
    state.variables[key] = value;
    if (key === 'instability') state.instability = value as number;
    return;
  }
  switch (path) {
    case 'instability':
      state.instability = value as number;
      state.variables['instability'] = state.instability;
      break;
    case 'reality_layer':
      state.reality_layer = value as number;
      break;
    case 'location':
      state.location = value as string;
      break;
  }
}

export function applyEffect(expression: string, state: ChronicaState): void {
  const t = expression.trim();
  if (!t) return;
  const incrMatch = t.match(incrementRegex);
  if (incrMatch) {
    applyIncrement(incrMatch[1], parseInt(incrMatch[2], 10), state);
    return;
  }
  const decrMatch = t.match(decrementRegex);
  if (decrMatch) {
    applyIncrement(decrMatch[1], -parseInt(decrMatch[2], 10), state);
    return;
  }
  const assignMatch = t.match(assignmentRegex);
  if (assignMatch) {
    applyAssignment(assignMatch[1], parseValue(assignMatch[2]), state);
  }
}

export function isValidCondition(expression: string): boolean {
  const t = expression.trim();
  return !t || conditionRegex.test(t);
}

/** Structured parts of a condition, or null if it doesn't match the grammar. */
export function getConditionParts(
  expression: string,
): { path: string; op: string; rhs: string } | null {
  const m = expression.trim().match(conditionRegex);
  return m ? { path: m[1], op: m[2], rhs: m[3] } : null;
}

/** The left-hand target (write path) of an effect expression, or null. */
export function getEffectTarget(expression: string): string | null {
  const t = expression.trim();
  const m = t.match(incrementRegex) ?? t.match(decrementRegex) ?? t.match(assignmentRegex);
  return m ? m[1] : null;
}

/** Parse a literal token the same way effects/conditions do (for analysis only). */
export function parseLiteralValue(raw: string): VariableValue {
  return parseValue(raw);
}

export function isValidEffect(expression: string): boolean {
  const t = expression.trim();
  return !t || incrementRegex.test(t) || decrementRegex.test(t) || assignmentRegex.test(t);
}
