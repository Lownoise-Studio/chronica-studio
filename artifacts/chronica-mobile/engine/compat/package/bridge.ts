import type { Project } from '../../types';
import type { ChronicaPackageManifest as FormatPackageManifest } from '../../chronica-package';
import { ECHO_MODULE_ID, INSTABILITY_MODULE_ID } from '../modules';
import {
  MOBILE_PLAYER_CAPABILITIES,
  MOBILE_PLAYER_TARGET_ID,
  type ChronicaPackageManifest,
  type ChronicaRuntimeTarget,
} from './types';

/**
 * Infer the capabilities a mobile project actually exercises. This is what
 * the mobile player advertises to a compat manifest — a Godot host reading it
 * knows exactly which subsystems the story touches, no more no less.
 *
 * The mobile player itself supports the full {@link MOBILE_PLAYER_CAPABILITIES}
 * set; per-project inference only prunes the list so an unused feature does
 * not show up as a "supported" capability on a package that never uses it.
 */
export function inferProjectCapabilities(project: Project): string[] {
  const caps = new Set<string>(['narrative', 'choices', 'variables', 'save-load', 'modules']);

  if (project.fragments.some(f => f.dialogue?.length)) caps.add('dialogue');
  if (project.fragments.some(f => (f.hotspots?.length ?? 0) > 0)) caps.add('hotspots');
  if (project.fragments.some(f => (f.stageActors?.length ?? 0) > 0)) caps.add('stage2d');
  if (project.characters?.length) caps.add('dialogue');

  caps.add('touch');
  return [...caps];
}

/** First fragment authored at the project's startLocation, or the first fragment. */
export function findEntryFragmentId(project: Project): string {
  const atStart = project.fragments.find(f => f.locationId === project.startLocation);
  return atStart?.uid ?? project.fragments[0]?.uid ?? '';
}

/**
 * Build a mobile-player runtime target from a mobile project — advertises
 * only capabilities the project actually uses so the host does not overpromise.
 */
export function inferMobilePlayerRuntimeTarget(project: Project): ChronicaRuntimeTarget {
  return {
    id: MOBILE_PLAYER_TARGET_ID,
    label: 'Chronica Mobile Player',
    capabilities: inferProjectCapabilities(project),
    entryFragmentId: findEntryFragmentId(project),
    assetProfile: 'mobile',
    presentation: 'stage2d',
  };
}

export interface CreateCompatManifestOptions {
  /**
   * Optional format-level package manifest (from `engine/chronica-package.ts`)
   * — donates `storyContentHash` and `exportedAt` when present.
   */
  formatManifest?: FormatPackageManifest;
  /** Modules the shipping package requires (typically none by default). */
  requiredModules?: readonly string[];
  /** Modules the shipping package can benefit from if available. */
  optionalModules?: readonly string[];
  /** Engine version string (advisory). */
  engineVersion?: string;
}

/**
 * Bridge helper — turn an authored mobile {@link Project} into a compat
 * manifest suitable for cross-engine compatibility checks. Emits a single
 * mobile-player runtime target, populated with the capabilities the project
 * actually uses.
 *
 * Existing mobile packages remain compatible: this helper is additive. The
 * legacy importer keeps using `engine/chronica-package.ts` untouched.
 */
export function createCompatManifestFromMobileProject(
  project: Project,
  options: CreateCompatManifestOptions = {},
): ChronicaPackageManifest {
  const target = inferMobilePlayerRuntimeTarget(project);
  const optional = [...(options.optionalModules ?? [INSTABILITY_MODULE_ID, ECHO_MODULE_ID])];

  const manifest: ChronicaPackageManifest = {
    schemaVersion: project.schemaVersion,
    packageId: project.gameId,
    title: project.title || 'Untitled Story',
    entryFragmentId: target.entryFragmentId ?? '',
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    engineVersion: options.engineVersion,
    capabilities: [...MOBILE_PLAYER_CAPABILITIES],
    runtimeTargets: [target],
    contentHash: options.formatManifest?.storyContentHash,
  };
  if (options.requiredModules?.length) manifest.requiredModules = [...options.requiredModules];
  if (optional.length) manifest.optionalModules = optional;
  return manifest;
}
