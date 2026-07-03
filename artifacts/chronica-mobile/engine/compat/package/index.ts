export {
  MOBILE_PLAYER_CAPABILITIES,
  MOBILE_PLAYER_COMPATIBILITY_OPTIONS,
  MOBILE_PLAYER_TARGET,
  MOBILE_PLAYER_TARGET_ID,
} from './types';
export type {
  ChronicaAssetProfile,
  ChronicaPackageManifest,
  ChronicaPresentation,
  ChronicaRuntimeTarget,
  CompatibilityLevel,
  CompatibilityOptions,
  CompatibilityResult,
} from './types';

export {
  CHRONICA_SCHEMA_VERSION_CURRENT,
  CHRONICA_SCHEMA_VERSION_KNOWN_MAX,
  CHRONICA_SCHEMA_VERSION_MIN,
  CHRONICA_SCHEMA_VERSION_MOBILE_PLAYER_FULLY_ENABLED_MAX,
  classifyStorySchemaVersion,
  knownLimitedSchemaWarning,
} from './schema-versions';
export type { StorySchemaVersionSupport } from './schema-versions';

export { validateChronicaPackageCompatibility } from './validate';

export {
  createCompatManifestFromMobileProject,
  findEntryFragmentId,
  inferMobilePlayerRuntimeTarget,
  inferProjectCapabilities,
} from './bridge';
export type { CreateCompatManifestOptions } from './bridge';
