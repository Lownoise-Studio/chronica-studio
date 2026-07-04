import { applyAssetRecipe, planAssetRecipeApplication, type AssetRecipeApplyOptions } from './asset-recipes';
import {
  getAssetNameReferenceMap,
  validateAssetContracts,
  validateDuplicateAssetImport,
} from './asset-contracts';
import {
  contractError,
  type ContractDiagnostic,
} from './contract-types';
import {
  cloneProject,
  computeEditorChangeSet,
  runEditorTransaction,
  type EditorChangeSet,
  type EditorMutationDefinition,
  type EditorTransactionResult,
} from './editor-transactions';
import { generatePlayableRoomFromAssets, planPlayableRoomFromAssets, type PlayableRoomGeneratorOptions } from './playable-room-generator';
import { moveStageObject } from './stage-authoring';
import type {
  AdventureInteractable,
  Fragment,
  Project,
  ProjectAsset,
  StageObject,
} from './types';

/** Documented contract metadata for each editor mutation kind. */
export interface EditorMutationContract {
  kind: string;
  preconditions: string[];
  postconditions: string[];
  rollbackBehavior: string;
  failureConditions: string[];
}

export const EDITOR_MUTATION_CONTRACTS: Record<string, EditorMutationContract> = {
  'update-project': {
    kind: 'update-project',
    preconditions: ['Project exists', 'Updates are partial — unspecified fields are preserved'],
    postconditions: ['Listed project fields reflect the patch', 'Other fields unchanged'],
    rollbackBehavior: 'Restore full project snapshot from transaction before-state',
    failureConditions: ['Verify detects structural regression'],
  },
  'update-fragment': {
    kind: 'update-fragment',
    preconditions: ['Target fragment uid exists in project'],
    postconditions: ['Fragment fields reflect the patch', 'Sibling fragments unchanged'],
    rollbackBehavior: 'Restore full project snapshot from transaction before-state',
    failureConditions: ['Missing fragment uid', 'Verify detects fragment regression'],
  },
  'rename-asset': {
    kind: 'rename-asset',
    preconditions: ['Asset id exists', 'New display name is non-empty and unique among other assets'],
    postconditions: [
      'Asset id unchanged',
      'Asset display name updated',
      'All name-based references rewritten atomically',
      'Recipes and package integrity preserved',
    ],
    rollbackBehavior: 'Restore full project snapshot from transaction before-state',
    failureConditions: ['Missing asset', 'Empty name', 'Duplicate name collision'],
  },
  'delete-asset': {
    kind: 'delete-asset',
    preconditions: ['Asset id exists', 'No scene or catalog references to the asset'],
    postconditions: ['Asset removed from library', 'No dangling references introduced'],
    rollbackBehavior: 'Restore full project snapshot from transaction before-state',
    failureConditions: ['Missing asset', 'References still point at asset name or preview id'],
  },
  'apply-recipe': {
    kind: 'apply-recipe',
    preconditions: ['Asset exists', 'Recipe plan is applicable', 'Required confirmations provided'],
    postconditions: ['Target fragment and gameplay catalog updated atomically'],
    rollbackBehavior: 'Restore full project snapshot from transaction before-state',
    failureConditions: ['Planning failure', 'Blocking conflicts', 'Low-confidence without confirmation'],
  },
  'generate-room': {
    kind: 'generate-room',
    preconditions: ['Room plan is applicable', 'Required confirmations provided'],
    postconditions: ['Fragment and catalog updated atomically', 'Optional new fragment appended'],
    rollbackBehavior: 'Restore full project snapshot from transaction before-state',
    failureConditions: ['Planning failure', 'Overwrite without confirmation'],
  },
  'move-stage-object': {
    kind: 'move-stage-object',
    preconditions: ['Fragment exists', 'Stage object uid exists', 'Object is not locked'],
    postconditions: ['Object coordinates updated within 0–1 bounds'],
    rollbackBehavior: 'Restore full project snapshot from transaction before-state',
    failureConditions: ['Missing fragment or object'],
  },
  'create-interactable': {
    kind: 'create-interactable',
    preconditions: ['Fragment exists', 'Fragment has or receives adventure block', 'Interactable uid is unique'],
    postconditions: ['Interactable appended to fragment.adventure.interactables'],
    rollbackBehavior: 'Restore full project snapshot from transaction before-state',
    failureConditions: ['Missing fragment', 'Duplicate interactable uid'],
  },
  'add-assets-batch': {
    kind: 'add-assets-batch',
    preconditions: ['Each incoming asset has unique id within batch', 'No silent duplicate imports'],
    postconditions: ['All assets appended atomically or none'],
    rollbackBehavior: 'Restore full project snapshot from transaction before-state',
    failureConditions: ['Duplicate id in batch', 'Duplicate import conflicts'],
  },
};

export interface AssetDeleteImpact {
  assetId: string;
  assetName: string;
  referencePaths: string[];
  previewDependents: string[];
  blocked: boolean;
}

function defaultVerify(before: Project, after: Project): ContractDiagnostic[] {
  const assetCheck = validateAssetContracts(after);
  return assetCheck.errors;
}

function defaultDescribe(before: Project, after: Project): EditorChangeSet {
  return computeEditorChangeSet(before, after);
}

function rewriteAssetNameReferences(project: Project, oldName: string, newName: string): Project {
  const next = cloneProject(project);
  for (const fragment of next.fragments) {
    if (fragment.backgroundImage?.trim() === oldName) fragment.backgroundImage = newName;
    if (fragment.backgroundAudio?.trim() === oldName) fragment.backgroundAudio = newName;

    if (fragment.stageActors) {
      fragment.stageActors = fragment.stageActors.map(actor =>
        actor.asset?.trim() === oldName ? { ...actor, asset: newName } : actor,
      );
    }

    if (fragment.stageAuthoring?.objects) {
      fragment.stageAuthoring = {
        ...fragment.stageAuthoring,
        objects: fragment.stageAuthoring.objects.map(object =>
          object.asset?.trim() === oldName ? { ...object, asset: newName } : object,
        ),
      };
    }

    if (fragment.adventure) {
      if (fragment.adventure.playerSprite?.trim() === oldName) {
        fragment.adventure.playerSprite = newName;
      }
      if (fragment.adventure.interactables) {
        fragment.adventure.interactables = fragment.adventure.interactables.map(interactable =>
          interactable.sprite?.trim() === oldName ? { ...interactable, sprite: newName } : interactable,
        );
      }
      if (fragment.adventure.sfx) {
        const sfx = { ...fragment.adventure.sfx };
        for (const [slot, value] of Object.entries(sfx)) {
          if (value?.trim() === oldName) {
            (sfx as Record<string, string | undefined>)[slot] = newName;
          }
        }
        fragment.adventure.sfx = sfx;
      }
    }
  }

  if (next.inventory) {
    next.inventory = next.inventory.map(item =>
      item.assetName?.trim() === oldName ? { ...item, assetName: newName } : item,
    );
  }

  return next;
}

/** Reference scan + impact report before asset deletion. */
export function getAssetDeleteImpact(project: Project, assetId: string): AssetDeleteImpact {
  const asset = project.assets.find(entry => entry.id === assetId);
  if (!asset) {
    return {
      assetId,
      assetName: '',
      referencePaths: [],
      previewDependents: [],
      blocked: true,
    };
  }

  const refs = getAssetNameReferenceMap(project);
  const referencePaths = refs.get(asset.name) ?? [];
  const previewDependents = project.assets
    .filter(entry => entry.previewImageAssetId === assetId)
    .map(entry => `assets.${entry.id}.previewImageAssetId`);

  return {
    assetId,
    assetName: asset.name,
    referencePaths,
    previewDependents,
    blocked: referencePaths.length > 0 || previewDependents.length > 0,
  };
}

export function updateProjectMutation(
  updates: Partial<Pick<Project,
    | 'title'
    | 'description'
    | 'startLocation'
    | 'initialVariables'
    | 'initialMemory'
    | 'characters'
    | 'inventory'
    | 'objectives'
    | 'worldState'
    | 'gameplayVariables'
    | 'npcProfiles'
  >>,
): EditorMutationDefinition {
  return {
    kind: 'update-project',
    label: 'Update project',
    validate: () => [],
    apply: project => ({ ...project, ...updates }),
    verify: defaultVerify,
    describeChangeSet: defaultDescribe,
  };
}

export function updateFragmentMutation(
  fragmentUid: string,
  updates: Partial<Fragment>,
): EditorMutationDefinition {
  return {
    kind: 'update-fragment',
    label: `Update fragment ${fragmentUid}`,
    validate: project => {
      if (!project.fragments.some(fragment => fragment.uid === fragmentUid)) {
        return [contractError('editor', 'missing-fragment', `Fragment "${fragmentUid}" was not found`, fragmentUid)];
      }
      return [];
    },
    apply: project => ({
      ...project,
      fragments: project.fragments.map(fragment =>
        fragment.uid === fragmentUid ? { ...fragment, ...updates } : fragment,
      ),
    }),
    verify: (before, after) => {
      const diagnostics = defaultVerify(before, after);
      if (!after.fragments.some(fragment => fragment.uid === fragmentUid)) {
        diagnostics.push(contractError('editor', 'missing-fragment', `Fragment "${fragmentUid}" missing after apply`, fragmentUid));
      }
      return diagnostics;
    },
    describeChangeSet: defaultDescribe,
  };
}

export function renameAssetMutation(assetId: string, newName: string): EditorMutationDefinition {
  const trimmed = newName.trim();
  return {
    kind: 'rename-asset',
    label: `Rename asset ${assetId}`,
    validate: project => {
      const asset = project.assets.find(entry => entry.id === assetId);
      if (!asset) {
        return [contractError('asset', 'missing-asset', `Asset id "${assetId}" was not found`)];
      }
      if (!trimmed) {
        return [contractError('asset', 'empty-name', 'Asset name cannot be empty')];
      }
      const collision = project.assets.find(entry => entry.id !== assetId && entry.name === trimmed);
      if (collision) {
        return [contractError('asset', 'duplicate-name', `Name "${trimmed}" is already used by asset "${collision.id}"`)];
      }
      return [];
    },
    apply: project => {
      const asset = project.assets.find(entry => entry.id === assetId);
      if (!asset) return project;
      const oldName = asset.name;
      if (oldName === trimmed) return project;

      let next = {
        ...project,
        assets: project.assets.map(entry =>
          entry.id === assetId ? { ...entry, name: trimmed } : entry,
        ),
      };
      next = rewriteAssetNameReferences(next, oldName, trimmed);
      return next;
    },
    verify: (before, after) => {
      const diagnostics = defaultVerify(before, after);
      const asset = after.assets.find(entry => entry.id === assetId);
      if (!asset || asset.name !== trimmed) {
        diagnostics.push(contractError('asset', 'rename-failed', `Asset "${assetId}" was not renamed to "${trimmed}"`));
      }
      const beforeAsset = before.assets.find(entry => entry.id === assetId);
      if (beforeAsset && asset && beforeAsset.id !== asset.id) {
        diagnostics.push(contractError('asset', 'id-changed', 'Asset id must remain immutable during rename'));
      }
      return diagnostics;
    },
    describeChangeSet: defaultDescribe,
  };
}

export function deleteAssetMutation(assetId: string): EditorMutationDefinition {
  return {
    kind: 'delete-asset',
    label: `Delete asset ${assetId}`,
    validate: project => {
      const impact = getAssetDeleteImpact(project, assetId);
      if (!impact.assetName) {
        return [contractError('asset', 'missing-asset', `Asset id "${assetId}" was not found`)];
      }
      const diagnostics: ContractDiagnostic[] = [];
      if (impact.referencePaths.length > 0) {
        diagnostics.push(contractError(
          'asset',
          'referenced-asset',
          `Cannot delete "${impact.assetName}" — referenced by ${impact.referencePaths.length} path(s): ${impact.referencePaths.join(', ')}`,
          impact.referencePaths[0],
        ));
      }
      for (const path of impact.previewDependents) {
        diagnostics.push(contractError(
          'asset',
          'preview-dependent',
          `Cannot delete "${impact.assetName}" — another asset uses it as preview (${path})`,
          path,
        ));
      }
      return diagnostics;
    },
    apply: project => ({
      ...project,
      assets: project.assets.filter(asset => asset.id !== assetId),
    }),
    verify: (before, after) => {
      const diagnostics = defaultVerify(before, after);
      if (after.assets.some(asset => asset.id === assetId)) {
        diagnostics.push(contractError('asset', 'delete-failed', `Asset "${assetId}" still present after delete`));
      }
      return diagnostics;
    },
    describeChangeSet: defaultDescribe,
  };
}

export function applyRecipeMutation(
  assetId: string,
  recipe: Parameters<typeof applyAssetRecipe>[2],
  options: AssetRecipeApplyOptions = {},
): EditorMutationDefinition {
  return {
    kind: 'apply-recipe',
    label: `Apply recipe ${recipe} to ${assetId}`,
    validate: project => {
      try {
        applyAssetRecipe(project, assetId, recipe, options);
        return [];
      } catch (error) {
        return [contractError(
          'recipe',
          'apply-blocked',
          error instanceof Error ? error.message : 'Recipe cannot be applied',
        )];
      }
    },
    apply: project => applyAssetRecipe(project, assetId, recipe, options).project,
    verify: defaultVerify,
    describeChangeSet: defaultDescribe,
  };
}

export function generateRoomMutation(options: PlayableRoomGeneratorOptions = {}): EditorMutationDefinition {
  return {
    kind: 'generate-room',
    label: 'Generate playable room',
    validate: project => {
      try {
        generatePlayableRoomFromAssets(project, options);
        return [];
      } catch (error) {
        return [contractError(
          'room-generator',
          'generate-blocked',
          error instanceof Error ? error.message : 'Room cannot be generated',
        )];
      }
    },
    apply: project => generatePlayableRoomFromAssets(project, options).project,
    verify: defaultVerify,
    describeChangeSet: defaultDescribe,
  };
}

export function moveStageObjectMutation(
  fragmentUid: string,
  objectUid: string,
  dx: number,
  dy: number,
  options: { snap?: boolean; grid?: number } = {},
): EditorMutationDefinition {
  return {
    kind: 'move-stage-object',
    label: `Move stage object ${objectUid}`,
    validate: project => {
      const fragment = project.fragments.find(entry => entry.uid === fragmentUid);
      if (!fragment) {
        return [contractError('editor', 'missing-fragment', `Fragment "${fragmentUid}" was not found`, fragmentUid)];
      }
      const object = fragment.stageAuthoring?.objects?.find(entry => entry.uid === objectUid);
      if (!object) {
        return [contractError('editor', 'missing-stage-object', `Stage object "${objectUid}" was not found`, objectUid)];
      }
      if (object.locked) {
        return [contractError('editor', 'locked-object', `Stage object "${objectUid}" is locked`, objectUid)];
      }
      return [];
    },
    apply: project => ({
      ...project,
      fragments: project.fragments.map(fragment => {
        if (fragment.uid !== fragmentUid || !fragment.stageAuthoring?.objects) return fragment;
        return {
          ...fragment,
          stageAuthoring: {
            ...fragment.stageAuthoring,
            objects: fragment.stageAuthoring.objects.map(object =>
              object.uid === objectUid
                ? moveStageObject(object as StageObject, dx, dy, options)
                : object,
            ),
          },
        };
      }),
    }),
    verify: defaultVerify,
    describeChangeSet: defaultDescribe,
  };
}

export function createInteractableMutation(
  fragmentUid: string,
  interactable: AdventureInteractable,
): EditorMutationDefinition {
  return {
    kind: 'create-interactable',
    label: `Create interactable ${interactable.uid}`,
    validate: project => {
      const fragment = project.fragments.find(entry => entry.uid === fragmentUid);
      if (!fragment) {
        return [contractError('editor', 'missing-fragment', `Fragment "${fragmentUid}" was not found`, fragmentUid)];
      }
      const existing = fragment.adventure?.interactables?.some(entry => entry.uid === interactable.uid) ?? false;
      if (existing) {
        return [contractError('editor', 'duplicate-interactable', `Interactable uid "${interactable.uid}" already exists`, interactable.uid)];
      }
      return [];
    },
    apply: project => ({
      ...project,
      fragments: project.fragments.map(fragment => {
        if (fragment.uid !== fragmentUid) return fragment;
        const adventure = fragment.adventure ?? { entry: { default: { x: 0.5, y: 0.8 } } };
        return {
          ...fragment,
          adventure: {
            ...adventure,
            interactables: [...(adventure.interactables ?? []), interactable],
          },
        };
      }),
    }),
    verify: (before, after) => {
      const diagnostics = defaultVerify(before, after);
      const fragment = after.fragments.find(entry => entry.uid === fragmentUid);
      if (!fragment?.adventure?.interactables?.some(entry => entry.uid === interactable.uid)) {
        diagnostics.push(contractError('editor', 'create-interactable-failed', `Interactable "${interactable.uid}" was not created`, interactable.uid));
      }
      return diagnostics;
    },
    describeChangeSet: defaultDescribe,
  };
}

export function addAssetsBatchMutation(assets: ProjectAsset[]): EditorMutationDefinition {
  return {
    kind: 'add-assets-batch',
    label: `Import ${assets.length} asset(s)`,
    validate: project => {
      const diagnostics: ContractDiagnostic[] = [];
      const batchIds = new Set<string>();
      for (const asset of assets) {
        if (batchIds.has(asset.id)) {
          diagnostics.push(contractError('asset', 'duplicate-batch-id', `Duplicate asset id "${asset.id}" in import batch`));
        }
        batchIds.add(asset.id);
        diagnostics.push(...validateDuplicateAssetImport(project, asset).diagnostics.filter(item => item.severity === 'error'));
      }
      return diagnostics;
    },
    apply: project => ({
      ...project,
      assets: [...project.assets, ...assets],
    }),
    verify: (before, after) => {
      const diagnostics = defaultVerify(before, after);
      for (const asset of assets) {
        if (!after.assets.some(entry => entry.id === asset.id)) {
          diagnostics.push(contractError('asset', 'batch-import-failed', `Asset "${asset.id}" missing after batch import`));
        }
      }
      return diagnostics;
    },
    describeChangeSet: defaultDescribe,
  };
}

/** Plan + run a safe asset delete; returns blocked result when references exist. */
export function executeSafeAssetDelete(project: Project, assetId: string) {
  return {
    impact: getAssetDeleteImpact(project, assetId),
    transaction: runEditorTransaction(project, deleteAssetMutation(assetId)),
  };
}

/** Apply a recipe atomically via the editor transaction layer. */
export function executeApplyRecipeTransaction(
  project: Project,
  assetId: string,
  recipe: Parameters<typeof applyAssetRecipe>[2],
  options: AssetRecipeApplyOptions = {},
): {
  plan: ReturnType<typeof planAssetRecipeApplication>;
  transaction: EditorTransactionResult;
} {
  const plan = planAssetRecipeApplication(project, assetId, recipe, options);
  const transaction = runEditorTransaction(project, applyRecipeMutation(assetId, recipe, options));
  return { plan, transaction };
}

/** Generate a playable room atomically via the editor transaction layer. */
export function executeGenerateRoomTransaction(
  project: Project,
  options: PlayableRoomGeneratorOptions = {},
): {
  plan: ReturnType<typeof planPlayableRoomFromAssets>;
  transaction: EditorTransactionResult;
} {
  const plan = planPlayableRoomFromAssets(project, options);
  const transaction = runEditorTransaction(project, generateRoomMutation(options));
  return { plan, transaction };
}

/** Import multiple assets atomically via the editor transaction layer. */
export function executeBatchAssetImportTransaction(
  project: Project,
  assets: ProjectAsset[],
): EditorTransactionResult {
  return runEditorTransaction(project, addAssetsBatchMutation(assets));
}
