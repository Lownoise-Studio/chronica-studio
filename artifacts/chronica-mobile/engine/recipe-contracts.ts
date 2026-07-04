import { slugifyAuthoringLabel } from './authoring-ids';
import type { AssetIntakeRecipe } from './asset-intake';
import {
  buildContractResult,
  contractWarning,
  type ContractValidationResult,
} from './contract-types';
import type { Fragment, Project, ProjectAsset } from './types';

export interface ExistingRecipeObjectReport {
  messages: string[];
  inventoryItemIds: string[];
  hotspotUids: string[];
  interactableUids: string[];
  stageObjectUids: string[];
}

function slugFromLabel(label: string): string {
  return slugifyAuthoringLabel(label);
}

/** Detect gameplay objects that a recipe would recreate if applied again. */
export function findExistingRecipeObjects(
  project: Project,
  fragment: Fragment,
  recipe: AssetIntakeRecipe,
  asset: ProjectAsset,
  label: string,
): ExistingRecipeObjectReport {
  const messages: string[] = [];
  const inventoryItemIds: string[] = [];
  const hotspotUids: string[] = [];
  const interactableUids: string[] = [];
  const stageObjectUids: string[] = [];
  const slug = slugFromLabel(label);

  if (recipe === 'make_pickup') {
    for (const item of project.inventory ?? []) {
      if (item.assetName === asset.name) {
        inventoryItemIds.push(item.id);
        messages.push(`Inventory item "${item.label}" already references asset "${asset.name}".`);
      }
    }

    for (const hotspot of fragment.hotspots ?? []) {
      const linked = (project.inventory ?? []).find(item => item.id === hotspot.itemId);
      if (linked?.assetName === asset.name || hotspot.label === label) {
        hotspotUids.push(hotspot.uid);
        messages.push(`Hotspot "${hotspot.label}" already implements this pickup.`);
      }
    }

    for (const interactable of fragment.adventure?.interactables ?? []) {
      if (interactable.kind === 'pickup' && (interactable.sprite === asset.name || interactable.label === label)) {
        interactableUids.push(interactable.uid);
        messages.push(`Adventure pickup "${interactable.label}" already exists for this asset.`);
      }
    }
  }

  if (recipe === 'make_npc') {
    for (const profile of project.npcProfiles ?? []) {
      if (profile.label === label || profile.id === slug) {
        messages.push(`NPC profile "${profile.label}" already exists.`);
      }
    }
    for (const actor of fragment.stageActors ?? []) {
      if (actor.asset === asset.name || actor.label === label) {
        messages.push(`Stage actor "${actor.label}" already references this NPC asset.`);
      }
    }
    for (const interactable of fragment.adventure?.interactables ?? []) {
      if (interactable.kind === 'npc' && (interactable.sprite === asset.name || interactable.label === label)) {
        interactableUids.push(interactable.uid);
        messages.push(`Adventure NPC "${interactable.label}" already exists.`);
      }
    }
  }

  if (recipe === 'make_door') {
    for (const hotspot of fragment.hotspots ?? []) {
      if (hotspot.label === label) {
        hotspotUids.push(hotspot.uid);
        messages.push(`Door hotspot "${hotspot.label}" already exists.`);
      }
    }
    for (const interactable of fragment.adventure?.interactables ?? []) {
      if (interactable.kind === 'door' && interactable.label === label) {
        interactableUids.push(interactable.uid);
        messages.push(`Adventure door "${interactable.label}" already exists.`);
      }
    }
  }

  for (const object of fragment.stageAuthoring?.objects ?? []) {
    if (object.asset === asset.name || object.label === label) {
      stageObjectUids.push(object.uid);
      messages.push(`Stage object "${object.label}" already references "${asset.name}".`);
    }
  }

  return {
    messages: [...new Set(messages)],
    inventoryItemIds,
    hotspotUids,
    interactableUids,
    stageObjectUids,
  };
}

/** Validation-only recipe idempotency contract. */
export function validateRecipeIdempotency(
  project: Project,
  fragment: Fragment,
  recipe: AssetIntakeRecipe,
  asset: ProjectAsset,
  label: string,
): ContractValidationResult {
  const existing = findExistingRecipeObjects(project, fragment, recipe, asset, label);
  return buildContractResult(
    existing.messages.map(message => contractWarning('recipe', 'duplicate-object', message)),
  );
}
