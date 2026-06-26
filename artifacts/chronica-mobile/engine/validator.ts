import { Project, Fragment, ValidationError, ProjectAsset } from './types';
import { isValidCondition, isValidEffect } from './expression-evaluator';
import { findAssetByName } from './chronica-package';
import { getGotoTargetsFromAction } from './actions/parse-action';
import { validateProjectActions } from './actions/validate-actions';

function assetExists(assets: ProjectAsset[], name: string): boolean {
  const asset = findAssetByName(assets, name);
  return !!asset?.uri?.trim();
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
 * @deprecated Prefer validateProjectActions — kept for direct unit tests.
 */
export function findBrokenLinks(project: Project): ValidationError[] {
  const known = new Set(project.fragments.map(f => f.locationId));
  const errors: ValidationError[] = [];
  for (const frag of project.fragments) {
    const meta = { fragmentUid: frag.uid, fragmentTitle: frag.title || frag.locationId };
    for (const choice of frag.choices) {
      for (const target of getGotoTargetsFromAction(choice.action)) {
        if (target && !known.has(target)) {
          errors.push({ ...meta, type: 'broken-link', message: `Choice "${choice.label}" → "${target}" has no matching fragment` });
        }
      }
    }
  }
  return errors;
}

/** Flag duplicate locationId values across fragments. */
export function findDuplicateLocations(project: Project): ValidationError[] {
  const seen = new Map<string, Fragment>();
  const errors: ValidationError[] = [];
  for (const frag of project.fragments) {
    const prev = seen.get(frag.locationId);
    if (prev) {
      const meta = { fragmentUid: frag.uid, fragmentTitle: frag.title || frag.locationId };
      errors.push({
        ...meta,
        type: 'duplicate-location',
        message: `Duplicate scene ID "${frag.locationId}" (also used by "${prev.title || prev.locationId}")`,
      });
    } else {
      seen.set(frag.locationId, frag);
    }
  }
  return errors;
}

/** Flag backgroundImage / backgroundAudio refs missing from the asset library. */
export function findMissingAssetRefs(project: Project): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const frag of project.fragments) {
    const meta = { fragmentUid: frag.uid, fragmentTitle: frag.title || frag.locationId };
    if (frag.backgroundImage?.trim() && !assetExists(project.assets, frag.backgroundImage.trim())) {
      errors.push({
        ...meta,
        type: 'missing-asset',
        message: `Background image "${frag.backgroundImage}" is not in the asset library`,
      });
    }
    if (frag.backgroundAudio?.trim() && !assetExists(project.assets, frag.backgroundAudio.trim())) {
      errors.push({
        ...meta,
        type: 'missing-asset',
        message: `Background audio "${frag.backgroundAudio}" is not in the asset library`,
      });
    }
  }
  return errors;
}

/** Scenes with no incoming goto links that are not the start location. */
export function findOrphanScenes(project: Project): ValidationError[] {
  const targets = new Set<string>();
  for (const frag of project.fragments) {
    for (const choice of frag.choices) {
      for (const target of getGotoTargetsFromAction(choice.action)) {
        if (target) targets.add(target);
      }
    }
  }

  const start = project.startLocation?.trim();
  const errors: ValidationError[] = [];
  for (const frag of project.fragments) {
    if (frag.locationId === start) continue;
    if (targets.has(frag.locationId)) continue;
    errors.push({
      fragmentUid: frag.uid,
      fragmentTitle: frag.title || frag.locationId,
      type: 'orphan-scene',
      message: `Scene "${frag.title || frag.locationId}" has no incoming links and is not the start scene`,
    });
  }
  return errors;
}

/**
 * Full project validation: start location, expression syntax, actions, links.
 */
export function validateProject(project: Project): ValidationError[] {
  const errors: ValidationError[] = [];
  const known = new Set(project.fragments.map(f => f.locationId));

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

  errors.push(...validateProjectActions(project));
  errors.push(...findDuplicateLocations(project));
  errors.push(...findMissingAssetRefs(project));
  errors.push(...findOrphanScenes(project));
  return errors;
}
