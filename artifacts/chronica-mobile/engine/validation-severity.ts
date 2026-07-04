import { validateProjectAdventures } from './adventure-validation';
import { validateProject } from './validator';
import type { Project, ValidationError } from './types';

/** Shared severity ladder for editor, compile, export, and runtime reporting. */
export type ValidationSeverity = 'info' | 'warning' | 'error' | 'blocking';

export type ValidationLayer = 'editor' | 'compile' | 'export' | 'runtime';

export interface CompileValidationOptions {
  /** When true, adventure invariants and cross-scene duplicate ids block compile/export. */
  strictValidation?: boolean;
}

const BLOCKING_TYPES = new Set<ValidationError['type']>([
  'missing-start',
  'broken-link',
  'invalid-condition',
  'invalid-effect',
  'invalid-action',
  'invalid-hotspot',
  'invalid-stage-actor',
  'invalid-dialogue',
  'missing-character',
  'duplicate-location',
  'type-mismatch',
]);

const INFO_TYPES = new Set<ValidationError['type']>(['unreachable-target']);

/** True when a missing-asset finding is decorative and should not block strict validation. */
export function isOptionalAssetIssue(error: ValidationError): boolean {
  if (error.type !== 'missing-asset') return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('background image') ||
    msg.includes('sprite') ||
    msg.includes('sfx.') ||
    msg.includes('player sprite') ||
    msg.includes('background audio') ||
    msg.includes('preview') ||
    msg.includes('stage actor') ||
    msg.includes('stage object') ||
    msg.includes('model asset') ||
    msg.includes('inventory item') ||
    msg.includes('portrait') ||
    msg.includes('expression')
  );
}

/** Apply canonical missing-asset severity for validation, integrity, and diagnostics. */
export function applyMissingAssetSeverity(error: ValidationError): ValidationError {
  if (error.type !== 'missing-asset') return error;
  if (error.severity === 'warning' || error.level === 'warning' || error.level === 'info') {
    return {
      ...error,
      severity: 'warning',
      level: error.level === 'info' ? 'info' : 'warning',
    };
  }
  if (isOptionalAssetIssue(error)) {
    return { ...error, severity: 'warning', level: 'warning' };
  }
  return { ...error, severity: 'error', level: error.level ?? 'blocking' };
}

export function buildMissingAssetIssue(
  meta: { fragmentUid: string; fragmentTitle: string },
  message: string,
): ValidationError {
  return applyMissingAssetSeverity({
    ...meta,
    type: 'missing-asset',
    message,
  });
}

/** Resolve the canonical severity for a validation finding. */
export function resolveValidationSeverity(
  error: ValidationError,
  options: CompileValidationOptions = {},
): ValidationSeverity {
  if (error.level) return error.level;

  if (error.severity === 'warning') {
    return INFO_TYPES.has(error.type) ? 'info' : 'warning';
  }

  if (error.type === 'missing-asset') {
    return options.strictValidation && isOptionalAssetIssue(error) ? 'warning' : 'blocking';
  }

  if (error.type === 'orphan-scene' || error.type === 'unknown-path') {
    return 'warning';
  }

  if (BLOCKING_TYPES.has(error.type)) {
    return 'blocking';
  }

  // Adventure invariant errors (invalid-action on colliders/spawn/etc.) are strict-only blockers.
  if (
    error.message.includes('Adventure') ||
    error.message.includes('Interactable') ||
    error.message.includes('Collider') ||
    error.message.includes('player spawn')
  ) {
    return 'error';
  }

  return 'error';
}

/** Whether a finding blocks compile for the given options (default preserves legacy behavior). */
export function isCompileBlocker(
  error: ValidationError,
  options: CompileValidationOptions = {},
): boolean {
  if (!options.strictValidation) {
    return error.severity !== 'warning';
  }

  const level = resolveValidationSeverity(error, options);
  return level === 'blocking' || level === 'error';
}

export function filterCompileBlockers(
  diagnostics: readonly ValidationError[],
  options: CompileValidationOptions = {},
): ValidationError[] {
  return diagnostics.filter(error => isCompileBlocker(error, options));
}

/** Cross-scene duplicate adventure interactable uids as compile diagnostics. */
export function findDuplicateInteractableIdErrors(project: Project): ValidationError[] {
  const seen = new Map<string, { fragmentUid: string; fragmentTitle: string }>();
  const errors: ValidationError[] = [];

  for (const fragment of project.fragments) {
    for (const interactable of fragment.adventure?.interactables ?? []) {
      const uid = interactable.uid?.trim();
      if (!uid) continue;
      const prior = seen.get(uid);
      if (prior) {
        errors.push({
          fragmentUid: fragment.uid,
          fragmentTitle: fragment.title || fragment.locationId,
          type: 'invalid-action',
          severity: 'error',
          level: 'error',
          message: `Duplicate adventure interactable uid "${uid}" (also used in "${prior.fragmentTitle}")`,
        });
      } else {
        seen.set(uid, {
          fragmentUid: fragment.uid,
          fragmentTitle: fragment.title || fragment.locationId,
        });
      }
    }
  }

  return errors;
}

/** Collect all diagnostics considered during compile/export validation. */
export function collectCompileValidation(
  project: Project,
  options: CompileValidationOptions = {},
): ValidationError[] {
  const diagnostics: ValidationError[] = [...validateProject(project)];

  if (options.strictValidation) {
    diagnostics.push(...validateProjectAdventures(project));
    diagnostics.push(...findDuplicateInteractableIdErrors(project));
  }

  return diagnostics;
}

/** Map severity to editor integrity section labels. */
export function severityToEditorSection(
  severity: ValidationSeverity,
): 'must-fix-before-export' | 'should-review' | 'informational' {
  switch (severity) {
    case 'blocking':
    case 'error':
      return 'must-fix-before-export';
    case 'warning':
      return 'should-review';
    case 'info':
    default:
      return 'informational';
  }
}
