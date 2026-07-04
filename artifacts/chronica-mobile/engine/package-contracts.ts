import { compileProject } from './compiler';
import { computeProjectContentHash } from './compiler/build-compiled-game';
import { buildPackageStory, planChronicaPackage } from './chronica-package';
import {
  buildContractResult,
  contractError,
  contractWarning,
  type ContractValidationResult,
} from './contract-types';
import type { Project } from './types';

/** Remove timestamps and install-local ids that must not affect package equivalence. */
export function stripProjectTimestamps(project: Project): Project {
  return {
    ...project,
    createdAt: '',
    updatedAt: '',
    assets: project.assets.map(asset => ({
      ...asset,
      importedAt: '',
    })),
  };
}

/** Normalize project content for stable package comparisons. */
export function normalizePackageProject(project: Project): Project {
  return stripProjectTimestamps({
    ...project,
    id: project.gameId,
  });
}

export function packageStoryContentHash(project: Project): string {
  const normalized = normalizePackageProject(project);
  return computeProjectContentHash({
    ...normalized,
    assets: normalized.assets.map(asset => ({
      ...asset,
      uri: asset.name,
    })),
  });
}

/** Verify compile output is stable across repeated runs. */
export function validateRepeatedCompileStability(project: Project): ContractValidationResult {
  const first = compileProject(project);
  const second = compileProject(project);

  if (!first.ok || !second.ok) {
    return buildContractResult([
      contractError('package', 'compile-unstable', 'Project must compile before repeated compile stability can be verified.'),
    ]);
  }

  const equal =
    first.game.contentHash === second.game.contentHash &&
    JSON.stringify(first.game.choiceActions) === JSON.stringify(second.game.choiceActions) &&
    JSON.stringify(first.game.hotspotActions) === JSON.stringify(second.game.hotspotActions) &&
    JSON.stringify(first.game.interactableActions) === JSON.stringify(second.game.interactableActions);

  return buildContractResult(
    equal
      ? []
      : [contractError('package', 'compile-diverged', 'Repeated compileProject calls produced different CompiledGame output.')],
  );
}

/** Verify export planning produces stable story hashes (ignoring timestamps). */
export function validateRepeatedExportStability(
  project: Project,
  exportedAt = '1970-01-01T00:00:00.000Z',
): ContractValidationResult {
  const planA = planChronicaPackage(project, () => true, exportedAt);
  const planB = planChronicaPackage(project, () => true, exportedAt);

  const hashA = packageStoryContentHash(planA.story);
  const hashB = packageStoryContentHash(planB.story);

  if (hashA !== hashB) {
    return buildContractResult([
      contractError('package', 'export-diverged', 'Repeated export planning produced different normalized story content.'),
    ]);
  }

  if (planA.manifest.storyContentHash !== planB.manifest.storyContentHash) {
    return buildContractResult([
      contractWarning('package', 'manifest-hash-drift', 'Manifest storyContentHash differed even though normalized story content matched.'),
    ]);
  }

  return buildContractResult([]);
}

/** Verify project → package story → normalized project remains content-equivalent. */
export function validatePackageRoundTripContent(
  project: Project,
  exportedAt = '1970-01-01T00:00:00.000Z',
): ContractValidationResult {
  const plan = planChronicaPackage(project, () => true, exportedAt);
  const story = buildPackageStory(project, plan.assetFiles);
  const before = packageStoryContentHash({
    ...project,
    assets: plan.assetFiles.map(entry => entry.asset),
  });
  const after = packageStoryContentHash(story);

  return buildContractResult(
    before === after
      ? []
      : [contractError('package', 'round-trip-drift', 'Package story content hash diverged from source project.')],
  );
}
