import { colliderOverlapsBounds } from './adventure';
import { getGotoTargetsFromAction } from './actions/parse-action';
import { findAssetRecord } from './asset-reference-safety';
import { isValidCondition } from './expression-evaluator';
import type {
  AdventureInteractableKind,
  Fragment,
  Project,
  ValidationError,
} from './types';

const VALID_INTERACTABLE_KINDS = new Set<AdventureInteractableKind>([
  'npc',
  'pickup',
  'door',
  'trigger',
]);

function meta(fragment: Fragment) {
  return {
    fragmentUid: fragment.uid,
    fragmentTitle: fragment.title || fragment.locationId,
  };
}

function isNormalizedCoord(value: number | undefined): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function inventoryIds(project: Project): Set<string> {
  return new Set((project.inventory ?? []).map(item => item.id.trim()).filter(Boolean));
}

/** Non-destructive adventure invariant checks for a single fragment. */
export function validateFragmentAdventure(
  fragment: Fragment,
  project: Project,
): ValidationError[] {
  const adventure = fragment.adventure;
  if (!adventure) return [];

  const issues: ValidationError[] = [];
  const m = meta(fragment);
  const knownLocations = new Set(project.fragments.map(f => f.locationId));
  const itemIds = inventoryIds(project);
  const seenInteractableUids = new Set<string>();

  const defaultEntry = adventure.entry?.default;
  if (!defaultEntry || !isNormalizedCoord(defaultEntry.x) || !isNormalizedCoord(defaultEntry.y)) {
    issues.push({
      ...m,
      type: 'invalid-action',
      severity: 'error',
      level: 'error',
      message: 'Adventure scene is missing a valid player spawn (entry.default with 0–1 coordinates)',
    });
  }

  for (const collider of adventure.colliders ?? []) {
    if (!collider.uid?.trim()) {
      issues.push({
        ...m,
        type: 'invalid-action',
        severity: 'error',
        message: 'Adventure collider is missing a uid',
      });
      continue;
    }
    if (!colliderOverlapsBounds(collider)) {
      issues.push({
        ...m,
        type: 'invalid-action',
        severity: 'error',
        message: `Collider "${collider.uid}" has invalid bounds (must fit inside 0–1 room space)`,
      });
    }
  }

  for (const interactable of adventure.interactables ?? []) {
    const label = interactable.label || interactable.uid || '(unnamed)';

    if (!interactable.uid?.trim()) {
      issues.push({
        ...m,
        type: 'invalid-action',
        severity: 'error',
        message: `Adventure interactable "${label}" is missing a uid`,
      });
      continue;
    }

    if (seenInteractableUids.has(interactable.uid)) {
      issues.push({
        ...m,
        type: 'invalid-action',
        severity: 'error',
        message: `Duplicate adventure interactable uid "${interactable.uid}" in this scene`,
      });
    }
    seenInteractableUids.add(interactable.uid);

    if (!VALID_INTERACTABLE_KINDS.has(interactable.kind)) {
      issues.push({
        ...m,
        type: 'invalid-action',
        severity: 'error',
        message: `Interactable "${label}" has invalid kind "${String(interactable.kind)}"`,
      });
    }

    if (!isNormalizedCoord(interactable.x) || !isNormalizedCoord(interactable.y)) {
      issues.push({
        ...m,
        type: 'invalid-action',
        severity: 'error',
        message: `Interactable "${label}" has invalid position (use 0–1 coordinates)`,
      });
    }

    for (const target of getGotoTargetsFromAction(interactable.action)) {
      if (target && !knownLocations.has(target)) {
        issues.push({
          ...m,
          type: 'broken-link',
          severity: 'error',
          level: 'error',
          message: `Interactable "${label}" transitions to unknown scene "${target}"`,
        });
      }
    }

    for (const condition of interactable.conditions ?? []) {
      if (!isValidCondition(condition)) {
        issues.push({
          ...m,
          type: 'invalid-condition',
          severity: 'warning',
          message: `Interactable "${label}" has invalid condition: "${condition}"`,
        });
      }
    }

    const sprite = interactable.sprite?.trim();
    if (sprite && !findAssetRecord(project.assets, sprite)) {
      issues.push({
        ...m,
        type: 'missing-asset',
        severity: 'warning',
        message: `Interactable "${label}" sprite "${sprite}" is not in the asset library`,
      });
    }

    if (interactable.kind === 'pickup' || interactable.kind === 'door') {
      const referencesItem = (interactable.conditions ?? []).some(
        condition => /variables\.has_|memory\./.test(condition),
      );
      if (!referencesItem && interactable.kind === 'door' && (interactable.conditions?.length ?? 0) > 0) {
        issues.push({
          ...m,
          type: 'unknown-path',
          severity: 'warning',
          message: `Door/gate "${label}" uses gating conditions — verify pickup/item variables are initialized`,
        });
      }
    }
  }

  const playerSprite = adventure.playerSprite?.trim();
  if (playerSprite && !findAssetRecord(project.assets, playerSprite)) {
    issues.push({
      ...m,
      type: 'missing-asset',
      severity: 'warning',
      message: `Adventure player sprite "${playerSprite}" is not in the asset library`,
    });
  }

  for (const [slot, value] of Object.entries(adventure.sfx ?? {})) {
    const ref = value?.trim();
    if (!ref) continue;
    if (!findAssetRecord(project.assets, ref)) {
      issues.push({
        ...m,
        type: 'missing-asset',
        severity: 'warning',
        message: `Adventure sfx.${slot} references missing asset "${ref}"`,
      });
    }
  }

  for (const hotspot of fragment.hotspots ?? []) {
    const itemId = hotspot.itemId?.trim();
    if (itemId && !itemIds.has(itemId)) {
      issues.push({
        ...m,
        type: 'missing-asset',
        severity: 'warning',
        message: `Hotspot "${hotspot.label || hotspot.uid}" references unknown inventory item id "${itemId}"`,
      });
    }
    const requiredItemId = hotspot.requiredItemId?.trim();
    if (requiredItemId && !itemIds.has(requiredItemId)) {
      issues.push({
        ...m,
        type: 'missing-asset',
        severity: 'warning',
        message: `Hotspot "${hotspot.label || hotspot.uid}" requires unknown inventory item id "${requiredItemId}"`,
      });
    }
  }

  return issues;
}

export function validateProjectAdventures(project: Project): ValidationError[] {
  const issues: ValidationError[] = [];
  for (const fragment of project.fragments) {
    issues.push(...validateFragmentAdventure(fragment, project));
  }
  return issues;
}
