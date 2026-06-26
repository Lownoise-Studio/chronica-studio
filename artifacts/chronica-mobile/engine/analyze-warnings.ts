import { Project, Fragment, ValidationError } from './types';
import { getConditionParts, getEffectTarget, parseLiteralValue } from './expression-evaluator';
import { parseActionString } from './actions/parse-action';

/**
 * Non-blocking semantic analysis — surfaces likely authoring mistakes that pass
 * syntactic validation but silently misbehave at runtime:
 *
 *  - unknown-path:       a condition reads a variable nothing ever writes/declares
 *                        (typo, or a missing `variables.`/`memory.` prefix that
 *                        makes a write a silent no-op).
 *  - type-mismatch:      an ordering comparison (>,<,>=,<=) against a non-numeric
 *                        literal, which always coerces to 0.
 *  - unreachable-target: a goto target whose every fragment is condition-gated,
 *                        so it can resolve to a dead-end when none match.
 *
 * All findings are severity:'warning' — they never block compile.
 */

const BUILTIN_PATHS = new Set(['instability', 'reality_layer', 'location']);
const ORDERING_OPS = new Set(['>', '<', '>=', '<=']);

function isStoragePath(path: string): boolean {
  return path.startsWith('variables.') || path.startsWith('memory.');
}

/** A path the runtime can actually read/write: a built-in or a prefixed slot. */
function isResolvablePath(path: string): boolean {
  return BUILTIN_PATHS.has(path) || isStoragePath(path);
}

/** Collect every path the project ever writes to or declares as an initial value. */
function collectWrittenPaths(project: Project): Set<string> {
  const written = new Set<string>(BUILTIN_PATHS);

  for (const key of Object.keys(project.initialVariables ?? {})) written.add(`variables.${key}`);
  for (const key of Object.keys(project.initialMemory ?? {})) written.add(`memory.${key}`);

  const addAction = (action: string | undefined) => {
    const parsed = parseActionString(action ?? '');
    if (!parsed.ok) return;
    for (const step of parsed.steps) {
      if (step.kind === 'set' || step.kind === 'clear') written.add(`memory.${step.flag}`);
      else if (step.kind === 'assign' || step.kind === 'increment' || step.kind === 'decrement') {
        written.add(step.path);
      }
    }
  };

  for (const frag of project.fragments) {
    for (const eff of frag.effects ?? []) {
      const target = getEffectTarget(eff);
      if (target) written.add(target);
    }
    for (const choice of frag.choices ?? []) addAction(choice.action);
    for (const hotspot of frag.hotspots ?? []) addAction(hotspot.action);
  }

  return written;
}

function analyzeConditions(
  conditions: readonly string[] | undefined,
  written: Set<string>,
  meta: { fragmentUid: string; fragmentTitle: string },
  label: string,
): ValidationError[] {
  const out: ValidationError[] = [];
  for (const cond of conditions ?? []) {
    const parts = getConditionParts(cond);
    if (!parts) continue; // malformed syntax is already an error from the validator

    if (!isResolvablePath(parts.path)) {
      out.push({
        ...meta,
        type: 'unknown-path',
        severity: 'warning',
        message: `${label} reads "${parts.path}", which has no variables./memory. prefix and isn't a built-in — it will always be a default value.`,
      });
    } else if (isStoragePath(parts.path) && !written.has(parts.path)) {
      out.push({
        ...meta,
        type: 'unknown-path',
        severity: 'warning',
        message: `${label} reads "${parts.path}", which nothing ever writes or declares — likely a typo (condition will never change).`,
      });
    }

    if (ORDERING_OPS.has(parts.op)) {
      const rhs = parseLiteralValue(parts.rhs);
      if (typeof rhs !== 'number' || parts.path === 'location') {
        out.push({
          ...meta,
          type: 'type-mismatch',
          severity: 'warning',
          message: `${label} compares "${parts.path}" ${parts.op} ${parts.rhs} — ordering comparisons are numeric, so a non-numeric side coerces to 0.`,
        });
      }
    }
  }
  return out;
}

function analyzeWrites(
  project: Project,
): ValidationError[] {
  const out: ValidationError[] = [];

  const checkAction = (
    action: string | undefined,
    meta: { fragmentUid: string; fragmentTitle: string },
    label: string,
  ) => {
    const parsed = parseActionString(action ?? '');
    if (!parsed.ok) return;
    for (const step of parsed.steps) {
      const target =
        step.kind === 'assign' || step.kind === 'increment' || step.kind === 'decrement'
          ? step.path
          : null;
      if (target && !isResolvablePath(target)) {
        out.push({
          ...meta,
          type: 'unknown-path',
          severity: 'warning',
          message: `${label} writes "${target}" with no variables./memory. prefix — this write is silently discarded at runtime.`,
        });
      }
    }
  };

  for (const frag of project.fragments) {
    const meta = { fragmentUid: frag.uid, fragmentTitle: frag.title || frag.locationId };
    for (const eff of frag.effects ?? []) {
      const target = getEffectTarget(eff);
      if (target && !isResolvablePath(target)) {
        out.push({
          ...meta,
          type: 'unknown-path',
          severity: 'warning',
          message: `Effect writes "${target}" with no variables./memory. prefix — this write is silently discarded at runtime.`,
        });
      }
    }
    for (const choice of frag.choices ?? []) checkAction(choice.action, meta, `Choice "${choice.label || '(unnamed)'}"`);
    for (const hotspot of frag.hotspots ?? []) checkAction(hotspot.action, meta, `Hotspot "${hotspot.label || '(unnamed)'}"`);
  }

  return out;
}

/** goto targets that resolve only to condition-gated fragments (possible dead-end). */
function analyzeUnreachableTargets(project: Project): ValidationError[] {
  const byLocation = new Map<string, Fragment[]>();
  for (const frag of project.fragments) {
    const bucket = byLocation.get(frag.locationId) ?? [];
    bucket.push(frag);
    byLocation.set(frag.locationId, bucket);
  }

  const out: ValidationError[] = [];
  const seen = new Set<string>();

  const checkTarget = (
    action: string | undefined,
    meta: { fragmentUid: string; fragmentTitle: string },
    label: string,
  ) => {
    const parsed = parseActionString(action ?? '');
    if (!parsed.ok) return;
    for (const step of parsed.steps) {
      if (step.kind !== 'goto') continue;
      const bucket = byLocation.get(step.locationId);
      if (!bucket?.length) continue; // broken link is already an error elsewhere
      const hasUnconditional = bucket.some(f => !(f.conditions?.length));
      if (hasUnconditional) continue;
      const key = `${meta.fragmentUid}:${label}:${step.locationId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        ...meta,
        type: 'unreachable-target',
        severity: 'warning',
        message: `${label} → "${step.locationId}": every scene there is condition-gated with no unconditional fallback, so it can dead-end when none match.`,
      });
    }
  };

  for (const frag of project.fragments) {
    const meta = { fragmentUid: frag.uid, fragmentTitle: frag.title || frag.locationId };
    for (const choice of frag.choices ?? []) checkTarget(choice.action, meta, `Choice "${choice.label || '(unnamed)'}"`);
    for (const hotspot of frag.hotspots ?? []) checkTarget(hotspot.action, meta, `Hotspot "${hotspot.label || '(unnamed)'}"`);
  }

  return out;
}

/**
 * Run all non-blocking semantic checks. Returns only severity:'warning' findings.
 * compileProject attaches these to a successful compile; they never gate the runtime.
 */
export function analyzeProjectWarnings(project: Project): ValidationError[] {
  const written = collectWrittenPaths(project);
  const warnings: ValidationError[] = [];

  for (const frag of project.fragments) {
    const meta = { fragmentUid: frag.uid, fragmentTitle: frag.title || frag.locationId };
    warnings.push(...analyzeConditions(frag.conditions, written, meta, `Scene "${meta.fragmentTitle}"`));
    for (const choice of frag.choices ?? []) {
      warnings.push(...analyzeConditions(choice.conditions, written, meta, `Choice "${choice.label || '(unnamed)'}"`));
    }
    for (const hotspot of frag.hotspots ?? []) {
      warnings.push(...analyzeConditions(hotspot.conditions, written, meta, `Hotspot "${hotspot.label || '(unnamed)'}"`));
    }
  }

  warnings.push(...analyzeWrites(project));
  warnings.push(...analyzeUnreachableTargets(project));

  return warnings;
}
