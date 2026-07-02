/**
 * Compat-side package manifest — describes a `.chronica` package's runtime
 * targets, required/optional modules, and capabilities so a host can decide
 * whether it can play, edit, or must reject a package before loading it.
 *
 * This is a **separate model** from the format-level `ChronicaPackageManifest`
 * in `engine/chronica-package.ts` (which handles ZIP/story integrity for the
 * existing mobile importer). The two coexist deliberately:
 *
 * - The format manifest answers "is this a valid Chronica package archive?"
 * - The compat manifest answers "can this runtime play this package?"
 *
 * Mobile importers keep speaking the format manifest. The compat manifest is
 * consulted by hosts that want to run cross-engine packages (e.g. a Godot
 * export that ships both a `godot-3d` target and a `mobile-player` target).
 */
export interface ChronicaPackageManifest {
  /** Story/project schema version this package's content targets. */
  schemaVersion: number;
  /** Engine that authored the package (e.g. "chronica-mobile 0.5.0"). Advisory. */
  engineVersion?: string;
  /** Stable package identity (typically equal to the story's gameId). */
  packageId: string;
  title: string;
  createdAt?: string;
  updatedAt?: string;
  /** Fragment.uid to enter when no runtime target overrides it. */
  entryFragmentId: string;
  /** Module ids that must be attached — missing modules make the package unsupported. */
  requiredModules?: string[];
  /** Module ids that enhance play if attached but are not fatal when missing. */
  optionalModules?: string[];
  /** High-level capabilities the package expects the runtime to provide. */
  capabilities?: string[];
  /** Alternate runtime targets — first fully-compatible target wins. */
  runtimeTargets?: ChronicaRuntimeTarget[];
  /** Optional content fingerprint for integrity comparisons. */
  contentHash?: string;
}

export type ChronicaAssetProfile = 'mobile' | 'desktop' | 'web' | 'godot' | 'generic';

export type ChronicaPresentation = 'narrative' | 'stage2d' | 'stage3d' | 'hybrid';

/**
 * A runtime target advertises "here is one way this package can be played."
 * A single package can carry many targets (e.g. a `godot-3d` full-experience
 * target and a `mobile-player` narrative target). The runtime selects the
 * first target it can fully satisfy.
 */
export interface ChronicaRuntimeTarget {
  id: string;
  label?: string;
  /** If true, incompatibility with this target makes the whole package unsupported. */
  required?: boolean;
  capabilities?: string[];
  /** Override entry fragment for this target — falls back to the manifest's. */
  entryFragmentId?: string;
  assetProfile?: ChronicaAssetProfile;
  presentation?: ChronicaPresentation;
}

export type CompatibilityLevel =
  | 'playable'      // A fully compatible target is available.
  | 'limited'       // A target matches but not every capability is supported.
  | 'editor_only'   // No playable target; core narrative data still loadable for editing.
  | 'unsupported';  // Nothing usable.

export interface CompatibilityOptions {
  /** Ids of modules the host can attach. */
  availableModules?: readonly string[];
  /** Capability strings the host supports. */
  supportedCapabilities?: readonly string[];
  /** Runtime target ids the host can select. */
  supportedRuntimeTargetIds?: readonly string[];
  /** Lowest story schemaVersion the host understands. Defaults to 1. */
  minSchemaVersion?: number;
  /** Highest story schemaVersion the host understands. Defaults to 2. */
  maxSchemaVersion?: number;
}

export interface CompatibilityResult {
  /** True when the package has no structural errors and is not unsupported. */
  ok: boolean;
  compatibilityLevel: CompatibilityLevel;
  /** Selected runtime target — set for playable / limited results. */
  selectedRuntimeTarget?: ChronicaRuntimeTarget;
  /** Blocking issues — a non-empty errors list always implies `ok = false`. */
  errors: string[];
  /** Non-fatal issues — the package can still be used but with caveats. */
  warnings: string[];
  missingRequiredModules: string[];
  missingOptionalModules: string[];
  /** Root-manifest capabilities that the host does not support. */
  unsupportedCapabilities: string[];
  /** Runtime target ids the host has no matching entry for. */
  unsupportedRuntimeTargets: string[];
}

// ------------------------------------------------------------------
// Mobile-player target profile
// ------------------------------------------------------------------

export const MOBILE_PLAYER_TARGET_ID = 'mobile-player';

/**
 * Capabilities the mobile player advertises to package validators. Keep this
 * in sync with what `PlayerHost` / `ChronicaSession` actually provide.
 */
export const MOBILE_PLAYER_CAPABILITIES: readonly string[] = Object.freeze([
  'narrative',
  'dialogue',
  'variables',
  'choices',
  'hotspots',
  'stage2d',
  'touch',
  'modules',
  'save-load',
]);

export const MOBILE_PLAYER_TARGET: ChronicaRuntimeTarget = Object.freeze({
  id: MOBILE_PLAYER_TARGET_ID,
  label: 'Chronica Mobile Player',
  capabilities: [...MOBILE_PLAYER_CAPABILITIES],
  assetProfile: 'mobile',
  presentation: 'stage2d',
}) as ChronicaRuntimeTarget;

/** Convenience: the default compatibility options a mobile host would use. */
export const MOBILE_PLAYER_COMPATIBILITY_OPTIONS: Readonly<CompatibilityOptions> = Object.freeze({
  supportedCapabilities: [...MOBILE_PLAYER_CAPABILITIES],
  supportedRuntimeTargetIds: [MOBILE_PLAYER_TARGET_ID],
});
