import { findAssetById, isModelAsset } from './model-assets';
import { buildMissingAssetIssue } from './validation-severity';
import type { Fragment, Project, ProjectAsset, ValidationError } from './types';

/** Shared asset lookup used by resolver and integrity scans. */
export function findAssetRecord(
  assets: readonly ProjectAsset[],
  reference: string,
): ProjectAsset | undefined {
  const ref = reference.trim();
  if (!ref) return undefined;

  const byName = assets.find(asset => asset.name === ref);
  if (byName) return byName;

  const lower = ref.toLowerCase();
  const byNameInsensitive = assets.find(asset => asset.name.toLowerCase() === lower);
  if (byNameInsensitive) return byNameInsensitive;

  const byId = assets.find(asset => asset.id === ref);
  if (byId) return byId;

  const byExactUri = assets.find(asset => asset.uri === ref);
  if (byExactUri) return byExactUri;

  const base = ref.split('/').pop() ?? ref;
  return assets.find(
    asset => asset.name === base || asset.uri.endsWith(`/${base}`),
  );
}

function assetExists(assets: readonly ProjectAsset[], reference: string): boolean {
  const record = findAssetRecord(assets, reference);
  return !!record?.uri?.trim();
}

function meta(fragment: Fragment) {
  return {
    fragmentUid: fragment.uid,
    fragmentTitle: fragment.title || fragment.locationId,
  };
}

function missingAssetIssue(
  fragment: Fragment,
  message: string,
): ValidationError {
  return buildMissingAssetIssue(meta(fragment), message);
}

/** Report missing asset references across scenes — never mutates the project. */
export function findMissingAssetReferences(project: Project): ValidationError[] {
  const issues: ValidationError[] = [];

  for (const fragment of project.fragments) {
    const background = fragment.backgroundImage?.trim();
    if (background && !assetExists(project.assets, background)) {
      issues.push(missingAssetIssue(
        fragment,
        `Background image "${background}" is not in the asset library`,
      ));
    }

    const audio = fragment.backgroundAudio?.trim();
    if (audio && !assetExists(project.assets, audio)) {
      issues.push(missingAssetIssue(
        fragment,
        `Background audio "${audio}" is not in the asset library`,
      ));
    }

    for (const actor of fragment.stageActors ?? []) {
      const asset = actor.asset?.trim();
      if (asset && !assetExists(project.assets, asset)) {
        issues.push(missingAssetIssue(
          fragment,
          `Stage actor "${actor.label || actor.uid}" references missing asset "${asset}"`,
        ));
      }
      for (const expression of actor.expressions ?? []) {
        const exprAsset = expression.asset?.trim();
        if (exprAsset && !assetExists(project.assets, exprAsset)) {
          issues.push(missingAssetIssue(
            fragment,
            `Stage actor "${actor.label || actor.uid}" expression references missing asset "${exprAsset}"`,
          ));
        }
      }
    }

    for (const object of fragment.stageAuthoring?.objects ?? []) {
      const asset = object.asset?.trim();
      if (asset && !assetExists(project.assets, asset)) {
        issues.push(missingAssetIssue(
          fragment,
          `Stage object "${object.label || object.uid}" references missing asset "${asset}"`,
        ));
      }
    }

    const adventure = fragment.adventure;
    if (!adventure) continue;

    const playerSprite = adventure.playerSprite?.trim();
    if (playerSprite && !assetExists(project.assets, playerSprite)) {
      issues.push(missingAssetIssue(
        fragment,
        `Adventure player sprite "${playerSprite}" is not in the asset library`,
      ));
    }

    for (const interactable of adventure.interactables ?? []) {
      const sprite = interactable.sprite?.trim();
      if (sprite && !assetExists(project.assets, sprite)) {
        issues.push(missingAssetIssue(
          fragment,
          `Adventure interactable "${interactable.label || interactable.uid}" sprite "${sprite}" is missing`,
        ));
      }
      const sfx = interactable.sfx?.trim();
      if (sfx && !assetExists(project.assets, sfx)) {
        issues.push(missingAssetIssue(
          fragment,
          `Adventure interactable "${interactable.label || interactable.uid}" sfx "${sfx}" is missing`,
        ));
      }
    }

    for (const [slot, value] of Object.entries(adventure.sfx ?? {})) {
      const ref = value?.trim();
      if (ref && !assetExists(project.assets, ref)) {
        issues.push(missingAssetIssue(
          fragment,
          `Adventure sfx.${slot} references missing asset "${ref}"`,
        ));
      }
    }
  }

  for (const asset of project.assets) {
    if (!isModelAsset(asset)) continue;
    const previewId = asset.previewImageAssetId?.trim();
    if (!previewId) continue;
    if (!findAssetById(project.assets, previewId)) {
      issues.push(buildMissingAssetIssue(
        { fragmentUid: '', fragmentTitle: 'Asset library' },
        `Model "${asset.name}" previewImageAssetId "${previewId}" was not found`,
      ));
    }
  }

  for (const item of project.inventory ?? []) {
    const assetName = item.assetName?.trim();
    if (assetName && !assetExists(project.assets, assetName)) {
      issues.push(buildMissingAssetIssue(
        { fragmentUid: '', fragmentTitle: 'Gameplay catalog' },
        `Inventory item "${item.label}" references missing asset "${assetName}"`,
      ));
    }
  }

  return issues;
}
