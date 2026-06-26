import { Project, ValidationError } from '../types';
import { getGotoTargetsFromAction, parseActionString } from './parse-action';

/**
 * Validate all choice actions: parse syntax and verify goto targets.
 * Complements validateProject; run before buildCompiledGame.
 */
export function validateProjectActions(project: Project): ValidationError[] {
  const known = new Set(project.fragments.map(f => f.locationId));
  const errors: ValidationError[] = [];

  for (const frag of project.fragments) {
    const meta = { fragmentUid: frag.uid, fragmentTitle: frag.title || frag.locationId };

    for (const choice of frag.choices) {
      const label = choice.label?.trim();
      const action = choice.action?.trim() ?? '';

      if (label && !action) {
        errors.push({
          ...meta,
          type: 'invalid-action',
          message: `Choice "${label}" has no action`,
        });
        continue;
      }

      if (!action) continue;

      const parsed = parseActionString(action);
      if (!parsed.ok) {
        errors.push({
          ...meta,
          type: 'invalid-action',
          message: `Choice "${label || '(unnamed)'}" — ${parsed.error}`,
        });
        continue;
      }

      for (const target of getGotoTargetsFromAction(action)) {
        if (target && !known.has(target)) {
          errors.push({
            ...meta,
            type: 'broken-link',
            message: `Choice "${label || '(unnamed)'}" → "${target}" has no matching fragment`,
          });
        }
      }
    }
  }

  return errors;
}
