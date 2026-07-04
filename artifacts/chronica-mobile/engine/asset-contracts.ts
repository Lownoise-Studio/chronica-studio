import { findMissingAssetReferences } from './asset-reference-safety';
import {
  buildContractResult,
  contractError,
  contractWarning,
  type ContractDiagnostic,
  type ContractValidationResult,
} from './contract-types';
import { findDuplicateAssetIds } from './model-assets';
import type { Project, ProjectAsset } from './types';

export function getAssetNameReferenceMap(project: Project): Map<string, string[]> {
  const refs = new Map<string, string[]>();
  const add = (assetName: string, path: string) => {
    const key = assetName.trim();
    if (!key) return;
    const bucket = refs.get(key) ?? [];
    bucket.push(path);
    refs.set(key, bucket);
  };

  for (const fragment of project.fragments) {
    const meta = fragment.title || fragment.locationId;
    if (fragment.backgroundImage?.trim()) add(fragment.backgroundImage, `${meta}.backgroundImage`);
    if (fragment.backgroundAudio?.trim()) add(fragment.backgroundAudio, `${meta}.backgroundAudio`);
    for (const actor of fragment.stageActors ?? []) {
      if (actor.asset?.trim()) add(actor.asset, `${meta}.stageActors.${actor.uid}`);
    }
    for (const object of fragment.stageAuthoring?.objects ?? []) {
      if (object.asset?.trim()) add(object.asset, `${meta}.stageAuthoring.${object.uid}`);
    }
    for (const interactable of fragment.adventure?.interactables ?? []) {
      if (interactable.sprite?.trim()) add(interactable.sprite, `${meta}.adventure.${interactable.uid}.sprite`);
    }
    if (fragment.adventure?.playerSprite?.trim()) add(fragment.adventure.playerSprite, `${meta}.adventure.playerSprite`);
    for (const [slot, value] of Object.entries(fragment.adventure?.sfx ?? {})) {
      if (value?.trim()) add(value, `${meta}.adventure.sfx.${slot}`);
    }
  }

  for (const asset of project.assets) {
    if (asset.previewImageAssetId?.trim()) {
      const preview = project.assets.find(entry => entry.id === asset.previewImageAssetId);
      if (preview?.name) add(preview.name, `assets.${asset.id}.previewImageAssetId`);
    }
  }

  for (const item of project.inventory ?? []) {
    if (item.assetName?.trim()) add(item.assetName, `inventory.${item.id}.assetName`);
  }

  return refs;
}

/** Validation-only asset integrity checks — no automatic repair. */
export function validateAssetContracts(project: Project): ContractValidationResult {
  const diagnostics: ContractDiagnostic[] = [];

  const duplicateIds = findDuplicateAssetIds(project.assets);
  for (const id of duplicateIds) {
    diagnostics.push(contractError(
      'asset',
      'duplicate-id',
      `Duplicate asset id "${id}" — asset IDs must remain immutable and unique.`,
      `assets.${id}`,
    ));
  }

  const names = new Map<string, ProjectAsset[]>();
  for (const asset of project.assets) {
    const bucket = names.get(asset.name) ?? [];
    bucket.push(asset);
    names.set(asset.name, bucket);
  }
  for (const [name, entries] of names) {
    if (entries.length > 1) {
      diagnostics.push(contractWarning(
        'asset',
        'duplicate-name',
        `Duplicate asset name "${name}" across ${entries.length} library entries — references resolve unpredictably.`,
        `assets.${entries[0]!.id}`,
      ));
    }
  }

  for (const issue of findMissingAssetReferences(project)) {
    diagnostics.push(
      issue.severity === 'warning'
        ? contractWarning('asset', 'missing-reference', issue.message, issue.fragmentUid)
        : contractError('asset', 'missing-reference', issue.message, issue.fragmentUid),
    );
  }

  const refs = getAssetNameReferenceMap(project);
  for (const [reference, paths] of refs) {
    const exists = project.assets.some(asset => asset.name === reference || asset.id === reference);
    if (!exists) {
      diagnostics.push(contractWarning(
        'asset',
        'dangling-reference',
        `Reference "${reference}" is not in the asset library (${paths.join(', ')}).`,
        paths[0],
      ));
    }
  }

  return buildContractResult(diagnostics);
}

/** Report whether renaming an asset would orphan references (validation only). */
export function validateAssetRenameImpact(
  project: Project,
  assetId: string,
  nextName: string,
): ContractValidationResult {
  const asset = project.assets.find(entry => entry.id === assetId);
  if (!asset) {
    return buildContractResult([
      contractError('asset', 'missing-asset', `Asset id "${assetId}" was not found.`),
    ]);
  }

  const diagnostics: ContractDiagnostic[] = [];
  const refs = getAssetNameReferenceMap(project);
  const paths = refs.get(asset.name) ?? [];
  if (paths.length > 0 && nextName.trim() !== asset.name) {
    diagnostics.push(contractWarning(
      'asset',
      'rename-impact',
      `Renaming "${asset.name}" to "${nextName}" would require updating ${paths.length} reference(s); identity is preserved by id, references use names.`,
      paths[0],
    ));
  }

  return buildContractResult(diagnostics);
}

/** Predictable duplicate-import behavior: same name + different id is reported, never silently merged. */
export function validateDuplicateAssetImport(
  project: Project,
  incoming: Pick<ProjectAsset, 'id' | 'name'>,
): ContractValidationResult {
  const diagnostics: ContractDiagnostic[] = [];
  const sameId = project.assets.find(asset => asset.id === incoming.id);
  const sameName = project.assets.find(asset => asset.name === incoming.name);

  if (sameId && sameName && sameId.id === incoming.id && sameName.name === incoming.name) {
    diagnostics.push(contractWarning(
      'asset',
      'duplicate-import',
      `Asset "${incoming.name}" (${incoming.id}) already exists — imports must not silently rewrite existing records.`,
    ));
  } else if (sameName && sameName.id !== incoming.id) {
    diagnostics.push(contractWarning(
      'asset',
      'duplicate-name-import',
      `Import name "${incoming.name}" collides with existing asset id "${sameName.id}".`,
    ));
  }

  return buildContractResult(diagnostics);
}
