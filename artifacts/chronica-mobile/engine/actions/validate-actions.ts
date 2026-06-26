import { Project, ValidationError } from '../types';
import { getGotoTargetsFromAction, parseActionString } from './parse-action';

type ActionOwner = {
  uid: string;
  label?: string;
  action?: string;
};

function validateActionsForOwners(
  owners: ActionOwner[],
  meta: { fragmentUid: string; fragmentTitle: string },
  ownerKind: 'Choice' | 'Hotspot',
  known: Set<string>,
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const owner of owners) {
    const label = owner.label?.trim();
    const action = owner.action?.trim() ?? '';

    if (label && !action) {
      errors.push({
        ...meta,
        type: 'invalid-action',
        message: `${ownerKind} "${label}" has no action`,
      });
      continue;
    }

    if (!action) continue;

    const parsed = parseActionString(action);
    if (!parsed.ok) {
      errors.push({
        ...meta,
        type: 'invalid-action',
        message: `${ownerKind} "${label || '(unnamed)'}" — ${parsed.error}`,
      });
      continue;
    }

    for (const target of getGotoTargetsFromAction(action)) {
      if (target && !known.has(target)) {
        errors.push({
          ...meta,
          type: 'broken-link',
          message: `${ownerKind} "${label || '(unnamed)'}" → "${target}" has no matching fragment`,
        });
      }
    }
  }

  return errors;
}

/**
 * Validate all choice and hotspot actions: parse syntax and verify goto targets.
 * Complements validateProject; run before buildCompiledGame.
 */
export function validateProjectActions(project: Project): ValidationError[] {
  const known = new Set(project.fragments.map(f => f.locationId));
  const errors: ValidationError[] = [];

  for (const frag of project.fragments) {
    const meta = { fragmentUid: frag.uid, fragmentTitle: frag.title || frag.locationId };
    errors.push(...validateActionsForOwners(frag.choices, meta, 'Choice', known));
    errors.push(...validateActionsForOwners(frag.hotspots ?? [], meta, 'Hotspot', known));
  }

  return errors;
}
