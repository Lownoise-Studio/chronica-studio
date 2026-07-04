import {
  CHRONICA_SCHEMA_VERSION_KNOWN_MAX,
  CHRONICA_SCHEMA_VERSION_MIN,
  CHRONICA_SCHEMA_VERSION_MOBILE_PLAYER_FULLY_ENABLED_MAX,
  classifyStorySchemaVersion,
  knownLimitedSchemaWarning,
} from './schema-versions';
import type { Fragment, Project } from './types';

/** Foundation feature capabilities tracked for package/runtime compatibility. */
export type FoundationFeature =
  | 'narrative_fragments'
  | 'assets'
  | 'stage_preview'
  | 'adventure_runtime'
  | 'asset_recipes'
  | 'playable_room_generation';

export const ALL_FOUNDATION_FEATURES: readonly FoundationFeature[] = Object.freeze([
  'narrative_fragments',
  'assets',
  'stage_preview',
  'adventure_runtime',
  'asset_recipes',
  'playable_room_generation',
]);

export interface DerivedPackageCapabilities {
  required: FoundationFeature[];
  optional: FoundationFeature[];
  /** Union of required + optional features the package exercises. */
  all: FoundationFeature[];
}

export interface PackageCapabilityMeta {
  schemaVersion: number;
  /** Story content — capabilities are inferred when present. */
  project?: Project;
  /** Explicit overrides; merged with inferred requirements when project is provided. */
  requiredFeatures?: FoundationFeature[];
  optionalFeatures?: FoundationFeature[];
}

export interface RuntimeCapabilities {
  schemaVersionMin: number;
  schemaVersionMax: number;
  supportedFeatures: readonly FoundationFeature[];
}

export interface PackageCompatibilityResult {
  compatible: boolean;
  warnings: string[];
  blockers: string[];
  unsupportedFeatures: FoundationFeature[];
  safeFallbacks: Partial<Record<FoundationFeature, string>>;
  requiredFeatures: FoundationFeature[];
  optionalFeatures: FoundationFeature[];
}

export const FOUNDATION_FEATURE_FALLBACKS: Readonly<Record<FoundationFeature, string>> = Object.freeze({
  narrative_fragments: 'No playable scenes — narrative content is required.',
  assets: 'Missing media is skipped; placeholders and icons are shown instead.',
  stage_preview: 'Stage preview metadata is ignored during play.',
  adventure_runtime: 'Top-down adventure scenes cannot run in narrative-only mode.',
  asset_recipes: 'Asset recipe metadata is editor-only and ignored at runtime.',
  playable_room_generation: 'Generated room metadata is editor-only and ignored at runtime.',
});

/** Capabilities the Chronica mobile player runtime supports today. */
export const MOBILE_PLAYER_RUNTIME_CAPABILITIES: RuntimeCapabilities = Object.freeze({
  schemaVersionMin: CHRONICA_SCHEMA_VERSION_MIN,
  schemaVersionMax: CHRONICA_SCHEMA_VERSION_KNOWN_MAX,
  supportedFeatures: ALL_FOUNDATION_FEATURES,
});

const GENERATED_ROOM_UID = /^int_[a-z0-9_]+_(npc|pickup|locked_gate|open_gate|door|trigger)$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function unique(features: FoundationFeature[]): FoundationFeature[] {
  return [...new Set(features)];
}

/** Infer capabilities from parsed package JSON before mobile normalization drops unknown fields. */
export function deriveParsedPackageCapabilities(
  input: {
    fragments: readonly unknown[];
    assets?: readonly unknown[];
    inventory?: readonly unknown[];
    npcProfiles?: readonly unknown[];
    objectives?: readonly unknown[];
  },
): DerivedPackageCapabilities {
  const required: FoundationFeature[] = [];
  const optional: FoundationFeature[] = [];

  if (input.fragments.length > 0) {
    required.push('narrative_fragments');
  }

  if (input.fragments.some(fragment => isRecord(fragment) && isRecord(fragment.adventure))) {
    required.push('adventure_runtime');
  }

  const referencesAssets = input.fragments.some(fragment => {
    if (!isRecord(fragment)) return false;
    if (typeof fragment.backgroundImage === 'string' && fragment.backgroundImage.trim()) return true;
    if (typeof fragment.backgroundAudio === 'string' && fragment.backgroundAudio.trim()) return true;
    if (Array.isArray(fragment.stageActors) && fragment.stageActors.length > 0) return true;
    if (isRecord(fragment.stageAuthoring) && Array.isArray(fragment.stageAuthoring.objects) && fragment.stageAuthoring.objects.length > 0) {
      return true;
    }
    const adventure = fragment.adventure;
    if (!isRecord(adventure)) return false;
    if (typeof adventure.playerSprite === 'string' && adventure.playerSprite.trim()) return true;
    if (Array.isArray(adventure.interactables)) {
      if (adventure.interactables.some(item => isRecord(item) && typeof item.sprite === 'string' && item.sprite.trim())) {
        return true;
      }
    }
    if (isRecord(adventure.sfx) && Object.values(adventure.sfx).some(value => typeof value === 'string' && value.trim())) {
      return true;
    }
    return false;
  });

  if ((input.assets?.length ?? 0) > 0 || referencesAssets) {
    optional.push('assets');
  }

  if (input.fragments.some(fragment => {
    if (!isRecord(fragment)) return false;
    if (isRecord(fragment.stageAuthoring) && Array.isArray(fragment.stageAuthoring.objects) && fragment.stageAuthoring.objects.length > 0) {
      return true;
    }
    return Array.isArray(fragment.stageActors) && fragment.stageActors.length > 0;
  })) {
    optional.push('stage_preview');
  }

  if (
    (input.inventory?.length ?? 0) > 0 ||
    (input.npcProfiles?.length ?? 0) > 0 ||
    (input.objectives?.length ?? 0) > 0 ||
    (input.assets ?? []).some(asset => isRecord(asset) && (asset.type === 'model' || asset.previewImageAssetId))
  ) {
    optional.push('asset_recipes');
  }

  if (input.fragments.some(fragment => {
    if (!isRecord(fragment) || !isRecord(fragment.adventure) || !Array.isArray(fragment.adventure.interactables)) {
      return false;
    }
    return fragment.adventure.interactables.some(
      (item: unknown) => isRecord(item) && typeof item.uid === 'string' && GENERATED_ROOM_UID.test(item.uid),
    );
  })) {
    optional.push('playable_room_generation');
  }

  const normalizedRequired = unique(required);
  const normalizedOptional = unique(optional.filter(feature => !normalizedRequired.includes(feature)));
  return {
    required: normalizedRequired,
    optional: normalizedOptional,
    all: unique([...normalizedRequired, ...normalizedOptional]),
  };
}

function fragmentUsesAssets(fragment: Fragment): boolean {
  if (fragment.backgroundImage?.trim() || fragment.backgroundAudio?.trim()) return true;
  if ((fragment.stageActors?.length ?? 0) > 0) return true;
  if ((fragment.stageAuthoring?.objects?.length ?? 0) > 0) return true;
  const adventure = fragment.adventure;
  if (!adventure) return false;
  if (adventure.playerSprite?.trim()) return true;
  if (Object.values(adventure.sfx ?? {}).some(value => value?.trim())) return true;
  return (adventure.interactables ?? []).some(item => item.sprite?.trim());
}

function fragmentUsesStagePreview(fragment: Fragment): boolean {
  return (
    (fragment.stageAuthoring?.objects?.length ?? 0) > 0 ||
    (fragment.stageActors?.length ?? 0) > 0
  );
}

function fragmentUsesAdventureRuntime(fragment: Fragment): boolean {
  return !!fragment.adventure;
}

function fragmentUsesPlayableRoomGeneration(fragment: Fragment): boolean {
  return (fragment.adventure?.interactables ?? []).some(item => GENERATED_ROOM_UID.test(item.uid));
}

function projectUsesAssetRecipes(project: Project): boolean {
  return (
    (project.inventory?.length ?? 0) > 0 ||
    (project.npcProfiles?.length ?? 0) > 0 ||
    (project.objectives?.length ?? 0) > 0 ||
    project.assets.some(asset => asset.type === 'model' || asset.previewImageAssetId?.trim())
  );
}

/** Infer required vs optional foundation features from authored project content. */
export function deriveProjectCapabilities(project: Project): DerivedPackageCapabilities {
  const required: FoundationFeature[] = [];
  const optional: FoundationFeature[] = [];

  if (project.fragments.length > 0) {
    required.push('narrative_fragments');
  }

  if (project.fragments.some(fragmentUsesAdventureRuntime)) {
    required.push('adventure_runtime');
  }

  if (
    project.assets.length > 0 ||
    project.fragments.some(fragmentUsesAssets)
  ) {
    optional.push('assets');
  }

  if (project.fragments.some(fragmentUsesStagePreview)) {
    optional.push('stage_preview');
  }

  if (projectUsesAssetRecipes(project)) {
    optional.push('asset_recipes');
  }

  if (project.fragments.some(fragmentUsesPlayableRoomGeneration)) {
    optional.push('playable_room_generation');
  }

  const normalizedRequired = unique(required);
  const normalizedOptional = unique(optional.filter(feature => !normalizedRequired.includes(feature)));

  return {
    required: normalizedRequired,
    optional: normalizedOptional,
    all: unique([...normalizedRequired, ...normalizedOptional]),
  };
}

/** Build capability metadata from a project and/or explicit manifest hints. */
export function derivePackageCapabilities(meta: PackageCapabilityMeta): DerivedPackageCapabilities {
  const inferred = meta.project ? deriveProjectCapabilities(meta.project) : { required: [], optional: [], all: [] };

  const required = unique([
    ...(meta.requiredFeatures ?? []),
    ...inferred.required,
  ]);
  const optional = unique([
    ...(meta.optionalFeatures ?? []),
    ...inferred.optional,
  ]).filter(feature => !required.includes(feature));

  return {
    required,
    optional,
    all: unique([...required, ...optional]),
  };
}

function resolveCapabilities(meta: PackageCapabilityMeta): DerivedPackageCapabilities {
  if (meta.project || meta.requiredFeatures?.length || meta.optionalFeatures?.length) {
    return derivePackageCapabilities(meta);
  }

  // Legacy narrative-only packages with no story attached still require scenes.
  return {
    required: ['narrative_fragments'],
    optional: [],
    all: ['narrative_fragments'],
  };
}

/**
 * Compare package metadata against a runtime capability profile.
 * Non-destructive: reports warnings/fallbacks for optional gaps; blockers for required gaps.
 */
export function checkPackageCompatibility(
  packageMeta: PackageCapabilityMeta,
  runtimeCapabilities: RuntimeCapabilities,
): PackageCompatibilityResult {
  const warnings: string[] = [];
  const blockers: string[] = [];
  const unsupportedFeatures: FoundationFeature[] = [];
  const safeFallbacks: Partial<Record<FoundationFeature, string>> = {};

  const { required, optional } = resolveCapabilities(packageMeta);
  const supported = new Set(runtimeCapabilities.supportedFeatures);

  if (
    !Number.isFinite(packageMeta.schemaVersion) ||
    packageMeta.schemaVersion < runtimeCapabilities.schemaVersionMin ||
    packageMeta.schemaVersion > runtimeCapabilities.schemaVersionMax
  ) {
    blockers.push(
      `schemaVersion ${packageMeta.schemaVersion} is outside runtime support (${runtimeCapabilities.schemaVersionMin}–${runtimeCapabilities.schemaVersionMax}).`,
    );
  } else {
    const schemaSupport = classifyStorySchemaVersion(packageMeta.schemaVersion);
    if (schemaSupport === 'known-limited') {
      warnings.push(knownLimitedSchemaWarning(packageMeta.schemaVersion));
    }
    if (packageMeta.schemaVersion > CHRONICA_SCHEMA_VERSION_MOBILE_PLAYER_FULLY_ENABLED_MAX) {
      warnings.push(
        `Package schemaVersion ${packageMeta.schemaVersion} is newer than the fully-enabled mobile runtime ceiling (${CHRONICA_SCHEMA_VERSION_MOBILE_PLAYER_FULLY_ENABLED_MAX}); verify behavior before shipping.`,
      );
    }
  }

  for (const feature of required) {
    if (supported.has(feature)) continue;
    unsupportedFeatures.push(feature);
    blockers.push(
      `Required feature "${feature}" is not supported by this runtime (${FOUNDATION_FEATURE_FALLBACKS[feature]})`,
    );
    safeFallbacks[feature] = FOUNDATION_FEATURE_FALLBACKS[feature];
  }

  for (const feature of optional) {
    if (supported.has(feature)) continue;
    if (unsupportedFeatures.includes(feature)) continue;
    unsupportedFeatures.push(feature);
    warnings.push(
      `Optional feature "${feature}" is unavailable — ${FOUNDATION_FEATURE_FALLBACKS[feature]}`,
    );
    safeFallbacks[feature] = FOUNDATION_FEATURE_FALLBACKS[feature];
  }

  return {
    compatible: blockers.length === 0,
    warnings,
    blockers,
    unsupportedFeatures: unique(unsupportedFeatures),
    safeFallbacks,
    requiredFeatures: required,
    optionalFeatures: optional,
  };
}

/** Convenience wrapper for local project play/export checks using the mobile runtime profile. */
export function checkProjectPlayCompatibility(
  project: Project,
  runtimeCapabilities: RuntimeCapabilities = MOBILE_PLAYER_RUNTIME_CAPABILITIES,
): PackageCompatibilityResult {
  return checkPackageCompatibility(
    { schemaVersion: project.schemaVersion, project },
    runtimeCapabilities,
  );
}

/** Narrative-only runtime profile used in tests and legacy host fallbacks. */
export const NARRATIVE_ONLY_RUNTIME_CAPABILITIES: RuntimeCapabilities = Object.freeze({
  schemaVersionMin: CHRONICA_SCHEMA_VERSION_MIN,
  schemaVersionMax: CHRONICA_SCHEMA_VERSION_KNOWN_MAX,
  supportedFeatures: [
    'narrative_fragments',
    'assets',
    'stage_preview',
    'asset_recipes',
    'playable_room_generation',
  ] satisfies FoundationFeature[],
});
