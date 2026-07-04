import {
  aggregateProjectValidation,
  type ProjectValidationOptions,
} from './project-validation';
import {
  resolveValidationSeverity,
  type ValidationSeverity,
} from './validation-severity';
import type { Project, ValidationError } from './types';

export type IntegrityCategory =
  | 'broken-link'
  | 'missing-asset'
  | 'duplicate-id'
  | 'invalid-start'
  | 'orphan-scene'
  | 'adventure-invariant'
  | 'orphan-adventure-ref'
  | 'unresolved-hook'
  | 'validation';

export type IntegritySeverity = 'error' | 'warning';

export interface IntegrityIssue {
  severity: IntegritySeverity;
  category: IntegrityCategory;
  fragmentUid: string;
  fragmentTitle: string;
  message: string;
  field?: string;
}

export interface ProjectIntegrityReport {
  ok: boolean;
  errors: IntegrityIssue[];
  warnings: IntegrityIssue[];
  summary: string;
}

export type ProjectIntegrityOptions = ProjectValidationOptions;

/** Map a validation finding to an integrity panel category. */
export function categorizeIntegrityIssue(error: ValidationError): IntegrityCategory {
  switch (error.type) {
    case 'broken-link':
      return 'broken-link';
    case 'missing-asset':
      return 'missing-asset';
    case 'missing-start':
      return 'invalid-start';
    case 'orphan-scene':
      return 'orphan-scene';
    case 'duplicate-location':
      return 'duplicate-id';
    default:
      if (error.message.includes('Adventure') || error.message.includes('Interactable') || error.message.includes('Collider')) {
        return 'adventure-invariant';
      }
      if (error.message.includes('hotspot uid')) {
        return 'orphan-adventure-ref';
      }
      if (error.message.includes('state key') || error.message.includes('met flag')) {
        return 'unresolved-hook';
      }
      if (error.message.includes('Duplicate adventure interactable')) {
        return 'duplicate-id';
      }
      return 'validation';
  }
}

function toIntegritySeverity(
  error: ValidationError,
  options: ProjectIntegrityOptions,
): IntegritySeverity {
  const resolved = resolveValidationSeverity(error, options);
  return resolved === 'info' || resolved === 'warning' ? 'warning' : 'error';
}

function summarize(errors: IntegrityIssue[], warnings: IntegrityIssue[]): string {
  const parts: string[] = [];
  if (errors.length > 0) parts.push(`${errors.length} error${errors.length === 1 ? '' : 's'}`);
  if (warnings.length > 0) parts.push(`${warnings.length} warning${warnings.length === 1 ? '' : 's'}`);
  return parts.length > 0 ? parts.join(' · ') : 'No integrity issues found';
}

/** Scan a project and return structured integrity results for editor display. */
export function buildProjectIntegrityReport(
  project: Project,
  options: ProjectIntegrityOptions = {},
): ProjectIntegrityReport {
  const aggregate = aggregateProjectValidation(project, options);
  const errors: IntegrityIssue[] = aggregate.blockers.map(error => ({
    severity: toIntegritySeverity(error, options),
    category: categorizeIntegrityIssue(error),
    fragmentUid: error.fragmentUid,
    fragmentTitle: error.fragmentTitle,
    message: error.message,
  }));

  const warnings: IntegrityIssue[] = [
    ...aggregate.warnings,
    ...aggregate.informational,
  ].map(error => ({
    severity: 'warning' as const,
    category: categorizeIntegrityIssue(error),
    fragmentUid: error.fragmentUid,
    fragmentTitle: error.fragmentTitle,
    message: error.message,
  }));

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    summary: summarize(errors, warnings),
  };
}

export type { ValidationSeverity };
