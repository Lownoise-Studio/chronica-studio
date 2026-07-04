import { Project, Fragment, ValidationError, ProjectAsset } from './types';
import { isValidCondition, isValidEffect } from './expression-evaluator';
import { findAssetByName } from './chronica-package';
import { getGotoTargetsFromAction } from './actions/parse-action';
import { validateProjectActions } from './actions/validate-actions';
import { isValidHotspotBounds } from './hotspots';
import { validateCharacters, validateCharacterAssetRefs } from './characters';
import { validateFragmentDialogue } from './validate-dialogue';
import { validateFragmentStageActors } from './stage-actors';
import { findMissingAssetReferences } from './asset-reference-safety';
import { validateProjectAssets } from './model-assets';

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
  for (const hotspot of fragment.hotspots ?? []) {
    if (!isValidHotspotBounds(hotspot)) {
      errors.push({
        ...meta,
        type: 'invalid-hotspot',
        message: `Hotspot "${hotspot.label || '(unnamed)'}" has invalid bounds (use 0–1 coordinates)`,
      });
    }
    for (const cond of (hotspot.conditions ?? [])) {
      if (!isValidCondition(cond)) {
        errors.push({
          ...meta,
          type: 'invalid-condition',
          message: `Hotspot "${hotspot.label}" — invalid condition: "${cond}"`,
        });
      }
    }
  }
  for (const actor of fragment.stageActors ?? []) {
    for (const cond of (actor.visibleWhen ?? [])) {
      if (!isValidCondition(cond)) {
        errors.push({
          ...meta,
          type: 'invalid-condition',
          message: `Stage actor "${actor.label || actor.uid}" — invalid condition: "${cond}"`,
        });
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

/** Flag duplicate locationId values when multiple unconditional variants share the same id. */
export function findDuplicateLocations(project: Project): ValidationError[] {
  const byLocation = new Map<string, Fragment[]>();
  for (const frag of project.fragments) {
    const bucket = byLocation.get(frag.locationId) ?? [];
    bucket.push(frag);
    byLocation.set(frag.locationId, bucket);
  }

  const errors: ValidationError[] = [];
  for (const [locationId, frags] of byLocation) {
    if (frags.length <= 1) continue;
    const unconditional = frags.filter(f => !f.conditions?.length);
    if (unconditional.length <= 1) continue;

    const primary = unconditional[0];
    for (let i = 1; i < unconditional.length; i++) {
      const frag = unconditional[i];
      errors.push({
        fragmentUid: frag.uid,
        fragmentTitle: frag.title || locationId,
        type: 'duplicate-location',
        message: `Duplicate scene ID "${locationId}" with no unlock conditions (also used by "${primary.title || primary.locationId}")`,
      });
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
    errors.push(...validateFragmentStageActors(frag, project.assets));
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
    for (const hotspot of frag.hotspots ?? []) {
      for (const target of getGotoTargetsFromAction(hotspot.action)) {
        if (target) targets.add(target);
      }
    }
    for (const interactable of frag.adventure?.interactables ?? []) {
      for (const target of getGotoTargetsFromAction(interactable.action)) {
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
    errors.push(...validateFragmentDialogue(frag, project.characters ?? []));
    errors.push(...validateFragmentStageActors(frag, project.assets));
  }

  errors.push(...validateCharacters(project.characters ?? []));
  errors.push(...validateCharacterAssetRefs(project.characters ?? [], project.assets));

  errors.push(...validateProjectActions(project));
  errors.push(...findDuplicateLocations(project));
  errors.push(...findMissingAssetReferences(project));
  errors.push(...validateProjectAssets(project));
  errors.push(...findOrphanScenes(project));
  return errors;
}
