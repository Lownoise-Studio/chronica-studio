import { Project, Fragment, ValidationError } from './types';
import { isValidCondition, isValidEffect } from './expression-evaluator';

function extractGotoTarget(action: string): string[] {
  return action.split(';').map(s => s.trim()).filter(s => s.startsWith('goto:')).map(s => s.slice(5).trim());
}

/**
 * Validate a single fragment's conditions, effects, and choice expressions.
 * Does NOT check cross-fragment links (use validateProject for that).
 */
export function validateFragment(fragment: Fragment): ValidationError[] {
  const errors: ValidationError[] = [];
  const meta = { fragmentUid: fragment.uid, fragmentTitle: fragment.title || fragment.locationId };

  for (const cond of fragment.conditions) {
    if (!isValidCondition(cond)) {
      errors.push({ ...meta, type: 'invalid-condition', message: `Invalid condition: "${cond}"` });
    }
  }
  for (const eff of fragment.effects) {
    if (!isValidEffect(eff)) {
      errors.push({ ...meta, type: 'invalid-effect', message: `Invalid effect: "${eff}"` });
    }
  }
  for (const choice of fragment.choices) {
    for (const cond of (choice.conditions ?? [])) {
      if (!isValidCondition(cond)) {
        errors.push({ ...meta, type: 'invalid-condition', message: `Choice "${choice.label}" — invalid condition: "${cond}"` });
      }
    }
  }
  return errors;
}

/**
 * Find all choices whose goto target doesn't match any fragment's locationId.
 */
export function findBrokenLinks(project: Project): ValidationError[] {
  const known = new Set(project.fragments.map(f => f.locationId));
  const errors: ValidationError[] = [];
  for (const frag of project.fragments) {
    const meta = { fragmentUid: frag.uid, fragmentTitle: frag.title || frag.locationId };
    for (const choice of frag.choices) {
      for (const target of extractGotoTarget(choice.action)) {
        if (target && !known.has(target)) {
          errors.push({ ...meta, type: 'broken-link', message: `Choice "${choice.label}" → "${target}" has no matching fragment` });
        }
      }
    }
  }
  return errors;
}

/**
 * Full project validation: start location, expression syntax, broken links.
 */
export function validateProject(project: Project): ValidationError[] {
  const errors: ValidationError[] = [];
  const known = new Set(project.fragments.map(f => f.locationId));

  // Check start location exists
  if (project.startLocation && !known.has(project.startLocation)) {
    errors.push({
      fragmentUid: '',
      fragmentTitle: 'Project',
      type: 'missing-start',
      message: `Start location "${project.startLocation}" has no matching fragment`,
    });
  }

  for (const frag of project.fragments) {
    errors.push(...validateFragment(frag));
  }

  errors.push(...findBrokenLinks(project));
  return errors;
}
