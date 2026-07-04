import { compileProject } from '../../compiler';
import type { Character, Fragment, Project, ProjectAsset } from '../../types';
import {
  checkPackageCompatibility,
  checkProjectPlayCompatibility,
  deriveParsedPackageCapabilities,
  MOBILE_PLAYER_RUNTIME_CAPABILITIES,
  type PackageCompatibilityResult,
} from '../../package-compatibility';
import {
  MOBILE_PLAYER_COMPATIBILITY_OPTIONS,
  MOBILE_PLAYER_TARGET_ID,
  validateChronicaPackageCompatibility,
  type ChronicaRuntimeTarget,
} from '../package';
import { normalizeAsset, normalizeCharacter, normalizeFragment } from './normalize';
import type {
  IngestionFailure,
  IngestionOptions,
  IngestionResult,
  IngestionSuccess,
  ParsedChronicaPackage,
  UnsupportedContentReport,
} from './types';

/**
 * Determine the fragment id the mobile player should enter with:
 * 1. the selected runtime target's `entryFragmentId` if present, else
 * 2. the manifest's `entryFragmentId`.
 */
function resolveEntryFragmentId(
  manifest: ParsedChronicaPackage['manifest'],
  target: ChronicaRuntimeTarget | undefined,
): string {
  const targetEntry = target?.entryFragmentId?.trim();
  if (targetEntry) return targetEntry;
  return manifest.entryFragmentId?.trim() ?? '';
}

function findEntryLocation(fragments: readonly Fragment[], entryFragmentId: string): string | undefined {
  const hit = fragments.find(f => f.uid === entryFragmentId);
  return hit?.locationId;
}

/**
 * Ingest a parsed `.chronica` package targeting the mobile player:
 *
 * 1. Validate compat against `MOBILE_PLAYER_COMPATIBILITY_OPTIONS` (or the
 *    caller's override).
 * 2. Reject anything the mobile player cannot handle.
 * 3. Select the compatible runtime target and resolve its entry fragment.
 * 4. Normalize fragments / characters / assets into the mobile shapes,
 *    collecting drop reports for anything unusable.
 * 5. Build a `Project`, compile to `CompiledGame`, and return the result.
 *
 * Ingestion is pure — no filesystem, no network, no side effects. UI and the
 * actual `.chronica` archive reader are separate concerns and remain
 * untouched.
 */
export function ingestChronicaPackageForMobilePlayer(
  pkg: ParsedChronicaPackage,
  options: IngestionOptions = {},
): IngestionResult {
  const warnings: string[] = [];
  const unsupportedContent: UnsupportedContentReport[] = [];

  const compatibility = validateChronicaPackageCompatibility(
    pkg.manifest,
    options.compatibility ?? MOBILE_PLAYER_COMPATIBILITY_OPTIONS,
  );
  warnings.push(...compatibility.warnings);

  if (!compatibility.ok || compatibility.compatibilityLevel === 'unsupported') {
    return failure('incompatible', compatibility.errors.length ? compatibility.errors : ['Package is not compatible with the mobile player.'], {
      warnings,
      unsupportedContent,
      compatibility,
    });
  }

  const runtimeCapabilities = options.runtimeCapabilities ?? MOBILE_PLAYER_RUNTIME_CAPABILITIES;
  const rawCapabilities = deriveParsedPackageCapabilities(pkg);
  const rawFeatureCompatibility = checkPackageCompatibility(
    {
      schemaVersion: pkg.manifest.schemaVersion,
      requiredFeatures: rawCapabilities.required,
      optionalFeatures: rawCapabilities.optional,
    },
    runtimeCapabilities,
  );
  warnings.push(...rawFeatureCompatibility.warnings);
  if (!rawFeatureCompatibility.compatible) {
    return failure(
      'feature-incompatible',
      rawFeatureCompatibility.blockers.length
        ? rawFeatureCompatibility.blockers
        : ['Package requires runtime features this host does not support.'],
      { warnings, unsupportedContent, compatibility, featureCompatibility: rawFeatureCompatibility },
    );
  }

  const selectedRuntimeTarget = compatibility.selectedRuntimeTarget;
  const entryFragmentId = resolveEntryFragmentId(pkg.manifest, selectedRuntimeTarget);
  if (!entryFragmentId) {
    return failure('missing-entry-fragment', ['Package has no entry fragment id.'], {
      warnings,
      unsupportedContent,
      compatibility,
    });
  }

  // Normalize fragments — the compiler needs strict Fragment shapes.
  const fragments: Fragment[] = [];
  for (let i = 0; i < pkg.fragments.length; i++) {
    const normalized = normalizeFragment(pkg.fragments[i], i, unsupportedContent);
    if (normalized) fragments.push(normalized);
  }

  if (!fragments.length) {
    return failure('no-fragments', ['Package has no fragments the mobile runtime can use.'], {
      warnings,
      unsupportedContent,
      compatibility,
    });
  }

  const entryFragment = fragments.find(f => f.uid === entryFragmentId);
  if (!entryFragment) {
    return failure('missing-entry-fragment', [`Entry fragment "${entryFragmentId}" not found in package.`], {
      warnings,
      unsupportedContent,
      compatibility,
    });
  }

  const characters: Character[] = pkg.characters
    ? pkg.characters
      .map((raw, i) => normalizeCharacter(raw, i, unsupportedContent))
      .filter((c): c is Character => c !== null)
    : [];

  const assets: ProjectAsset[] = pkg.assets
    ? pkg.assets
      .map((raw, i) => normalizeAsset(raw, i, unsupportedContent))
      .filter((a): a is ProjectAsset => a !== null)
    : [];

  const project = buildProjectFromPackage(pkg, fragments, characters, assets, entryFragment.locationId, options);

  const featureCompatibility = checkProjectPlayCompatibility(
    project,
    runtimeCapabilities,
  );
  warnings.push(...featureCompatibility.warnings);
  if (!featureCompatibility.compatible) {
    return failure(
      'feature-incompatible',
      featureCompatibility.blockers.length
        ? featureCompatibility.blockers
        : ['Package requires runtime features this host does not support.'],
      { warnings, unsupportedContent, compatibility, featureCompatibility },
    );
  }

  const compileResult = compileProject(project);
  if (!compileResult.ok) {
    return failure(
      'compile-failed',
      compileResult.diagnostics.map(d => `${d.fragmentTitle || d.fragmentUid}: ${d.message}`),
      { warnings, unsupportedContent, compatibility, featureCompatibility },
    );
  }
  for (const warning of compileResult.warnings) {
    warnings.push(`${warning.fragmentTitle || warning.fragmentUid}: ${warning.message}`);
  }

  const success: IngestionSuccess = {
    ok: true,
    manifest: pkg.manifest,
    compatibility,
    selectedRuntimeTarget,
    entryFragmentId,
    game: compileResult.game,
    project,
    warnings,
    unsupportedContent,
    featureCompatibility,
  };
  return success;
}

function buildProjectFromPackage(
  pkg: ParsedChronicaPackage,
  fragments: Fragment[],
  characters: Character[],
  assets: ProjectAsset[],
  startLocation: string,
  options: IngestionOptions,
): Project {
  const now = new Date().toISOString();
  return {
    schemaVersion: pkg.manifest.schemaVersion,
    gameId: pkg.manifest.packageId,
    id: options.installId ?? pkg.manifest.packageId,
    title: pkg.manifest.title,
    description: options.description ?? '',
    startLocation,
    initialVariables: pkg.variables ?? {},
    initialMemory: pkg.memory ?? {},
    createdAt: pkg.manifest.createdAt ?? now,
    updatedAt: pkg.manifest.updatedAt ?? now,
    fragments,
    assets,
    characters,
  };
}

function failure(
  reason: IngestionFailure['reason'],
  errors: string[],
  extras: Pick<IngestionFailure, 'warnings' | 'unsupportedContent' | 'compatibility' | 'featureCompatibility'>,
): IngestionFailure {
  return {
    ok: false,
    reason,
    errors,
    warnings: extras.warnings,
    unsupportedContent: extras.unsupportedContent,
    compatibility: extras.compatibility,
    featureCompatibility: extras.featureCompatibility,
  };
}

export { MOBILE_PLAYER_TARGET_ID };
