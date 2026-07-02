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

export { validateChronicaPackageCompatibility } from './validate';

export {
  createCompatManifestFromMobileProject,
  findEntryFragmentId,
  inferMobilePlayerRuntimeTarget,
  inferProjectCapabilities,
} from './bridge';
export type { CreateCompatManifestOptions } from './bridge';
