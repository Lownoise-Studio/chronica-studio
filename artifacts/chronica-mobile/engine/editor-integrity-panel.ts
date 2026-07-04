import { aggregateProjectValidation, type ProjectValidationOptions } from './project-validation';
import {
  resolveValidationSeverity,
  severityToEditorSection,
  type ValidationSeverity,
} from './validation-severity';
import { categorizeIntegrityIssue, type IntegrityCategory } from './project-integrity';
import type { Project, ValidationError } from './types';

export type EditorIntegritySection =
  | 'must-fix-before-export'
  | 'should-review'
  | 'informational';

export interface EditorIntegrityItem {
  severity: ValidationSeverity;
  section: EditorIntegritySection;
  fragmentUid: string;
  fragmentTitle: string;
  message: string;
  field?: string;
  category?: IntegrityCategory;
}

export interface EditorIntegrityGroup {
  section: EditorIntegritySection;
  title: string;
  items: EditorIntegrityItem[];
}

export interface EditorIntegrityOptions extends ProjectValidationOptions {}

const SECTION_TITLES: Record<EditorIntegritySection, string> = {
  'must-fix-before-export': 'Must fix before export',
  'should-review': 'Warnings',
  informational: 'Information',
};

function validationToIntegrityItem(
  error: ValidationError,
  options: EditorIntegrityOptions,
): EditorIntegrityItem {
  const severity = resolveValidationSeverity(error, options);
  return {
    severity,
    section: severityToEditorSection(severity),
    fragmentUid: error.fragmentUid,
    fragmentTitle: error.fragmentTitle,
    message: error.message,
    category: categorizeIntegrityIssue(error),
  };
}

/** Group shared project validation into editor-facing sections. */
export function buildEditorIntegrityGroups(
  project: Project,
  options: EditorIntegrityOptions = {},
): EditorIntegrityGroup[] {
  const aggregate = aggregateProjectValidation(project, options);
  const items = aggregate.findings.map(finding =>
    validationToIntegrityItem(finding.error, options),
  );

  const grouped = new Map<EditorIntegritySection, EditorIntegrityItem[]>();
  for (const section of Object.keys(SECTION_TITLES) as EditorIntegritySection[]) {
    grouped.set(section, []);
  }

  for (const item of items) {
    grouped.get(item.section)!.push(item);
  }

  return (Object.keys(SECTION_TITLES) as EditorIntegritySection[])
    .map(section => ({
      section,
      title: SECTION_TITLES[section],
      items: grouped.get(section) ?? [],
    }))
    .filter(group => group.items.length > 0);
}
