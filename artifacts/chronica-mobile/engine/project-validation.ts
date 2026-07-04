import { findDuplicateAssetIds } from './model-assets';
import {
  collectCompileValidation,
  filterCompileBlockers,
  resolveValidationSeverity,
  severityToEditorSection,
  type CompileValidationOptions,
  type ValidationSeverity,
} from './validation-severity';
import type { Project, ValidationError } from './types';

export type EditorValidationSection =
  | 'must-fix-before-export'
  | 'should-review'
  | 'informational';

export interface ProjectValidationOptions extends CompileValidationOptions {
  /** Editor-only supplemental scans (orphan hotspot refs, unresolved hooks). Default true. */
  includeEditorSupplemental?: boolean;
}

export interface ProjectValidationFinding {
  error: ValidationError;
  severity: ValidationSeverity;
  section: EditorValidationSection;
}

export interface ProjectValidationAggregate {
  strictValidation: boolean;
  diagnostics: ValidationError[];
  blockers: ValidationError[];
  warnings: ValidationError[];
  informational: ValidationError[];
  findings: ProjectValidationFinding[];
}

function collectTextReferences(project: Project): string {
  const chunks: string[] = [];
  for (const fragment of project.fragments) {
    chunks.push(fragment.text ?? '');
    for (const choice of fragment.choices) chunks.push(choice.action);
    for (const hotspot of fragment.hotspots ?? []) {
      chunks.push(hotspot.action);
      chunks.push(...(hotspot.conditions ?? []));
    }
    for (const line of fragment.dialogue ?? []) chunks.push(line.text);
    for (const interactable of fragment.adventure?.interactables ?? []) {
      chunks.push(interactable.action);
      chunks.push(...(interactable.conditions ?? []));
    }
  }
  return chunks.join('\n');
}

/** Editor-only supplemental validation not part of compile/export gates. */
export function collectEditorSupplementalValidation(project: Project): ValidationError[] {
  const diagnostics: ValidationError[] = [];
  const hotspotUids = new Set<string>();
  for (const fragment of project.fragments) {
    for (const hotspot of fragment.hotspots ?? []) {
      if (hotspot.uid?.trim()) hotspotUids.add(hotspot.uid.trim());
    }
  }

  for (const fragment of project.fragments) {
    for (const object of fragment.stageAuthoring?.objects ?? []) {
      const ref = object.hotspotRef?.trim() || object.interactionRef?.trim();
      if (!ref) continue;
      if (!hotspotUids.has(ref)) {
        diagnostics.push({
          fragmentUid: fragment.uid,
          fragmentTitle: fragment.title || fragment.locationId,
          type: 'invalid-action',
          severity: 'warning',
          level: 'warning',
          message: `Stage object "${object.label || object.uid}" references missing hotspot uid "${ref}"`,
        });
      }
    }
  }

  const haystack = collectTextReferences(project);
  for (const item of project.inventory ?? []) {
    if (item.stateKey?.trim() && !haystack.includes(item.stateKey.trim())) {
      diagnostics.push({
        fragmentUid: '',
        fragmentTitle: 'Gameplay catalog',
        type: 'invalid-action',
        severity: 'warning',
        level: 'warning',
        message: `Inventory item "${item.label}" state key "${item.stateKey}" is not referenced by any scene action or condition`,
      });
    }
  }

  for (const profile of project.npcProfiles ?? []) {
    const met = profile.metFlag?.trim();
    if (met && !haystack.includes(met)) {
      diagnostics.push({
        fragmentUid: '',
        fragmentTitle: 'Gameplay catalog',
        type: 'invalid-action',
        severity: 'warning',
        level: 'warning',
        message: `NPC "${profile.label}" met flag "${met}" is not referenced by dialogue or scene logic yet`,
      });
    }
  }

  return diagnostics;
}

function collectDuplicateAssetIdValidation(project: Project): ValidationError[] {
  return findDuplicateAssetIds(project.assets).map(id => ({
    fragmentUid: '',
    fragmentTitle: 'Asset library',
    type: 'missing-asset' as const,
    severity: 'error' as const,
    level: 'blocking' as const,
    message: `Duplicate asset id "${id}" in the asset library`,
  }));
}

/**
 * Shared validation aggregation for compile, export, integrity panel, and diagnostics.
 * Uses the same compile pipeline as `compileProject` / package export.
 */
export function aggregateProjectValidation(
  project: Project,
  options: ProjectValidationOptions = {},
): ProjectValidationAggregate {
  const strictValidation = options.strictValidation ?? false;
  const compileOptions: CompileValidationOptions = { strictValidation };

  const diagnostics: ValidationError[] = [
    ...collectCompileValidation(project, compileOptions),
    ...collectDuplicateAssetIdValidation(project),
  ];

  if (options.includeEditorSupplemental !== false) {
    diagnostics.push(...collectEditorSupplementalValidation(project));
  }

  const blockers = filterCompileBlockers(diagnostics, compileOptions);
  const blockerKeys = new Set(blockers.map(item => `${item.type}:${item.fragmentUid}:${item.message}`));
  const warnings: ValidationError[] = [];
  const informational: ValidationError[] = [];
  const findings: ProjectValidationFinding[] = [];

  for (const error of diagnostics) {
    const severity = resolveValidationSeverity(error, compileOptions);
    const section = severityToEditorSection(severity);
    findings.push({ error, severity, section });

    const key = `${error.type}:${error.fragmentUid}:${error.message}`;
    if (blockerKeys.has(key)) continue;

    if (severity === 'warning') warnings.push(error);
    else if (severity === 'info') informational.push(error);
  }

  return {
    strictValidation,
    diagnostics,
    blockers,
    warnings,
    informational,
    findings,
  };
}

/** True when strict validation would block compile/export for this project. */
export function wouldStrictCompileBlock(project: Project): boolean {
  return filterCompileBlockers(
    collectCompileValidation(project, { strictValidation: true }),
    { strictValidation: true },
  ).length > 0;
}
