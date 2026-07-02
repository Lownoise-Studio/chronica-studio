import type {
  ChronicaPackageManifest,
  ChronicaRuntimeTarget,
  CompatibilityLevel,
  CompatibilityOptions,
  CompatibilityResult,
} from './types';

const DEFAULT_MIN_SCHEMA = 1;
const DEFAULT_MAX_SCHEMA = 2;

interface TargetEvaluation {
  target: ChronicaRuntimeTarget;
  /**
   * - `full`  — target id supported, every capability supported.
   * - `partial` — target id supported, some capabilities missing.
   * - `incompatible` — target id not in the host's supported ids at all.
   */
  kind: 'full' | 'partial' | 'incompatible';
  missingCapabilities: string[];
}

function toSet(values: readonly string[] | undefined): Set<string> {
  return new Set(values ?? []);
}

function evaluateTarget(
  target: ChronicaRuntimeTarget,
  supportedIds: Set<string>,
  supportedCaps: Set<string>,
): TargetEvaluation {
  const capabilities = target.capabilities ?? [];
  const missing = capabilities.filter(cap => !supportedCaps.has(cap));

  if (!supportedIds.has(target.id)) {
    return { target, kind: 'incompatible', missingCapabilities: capabilities };
  }
  if (missing.length === 0) {
    return { target, kind: 'full', missingCapabilities: [] };
  }
  return { target, kind: 'partial', missingCapabilities: missing };
}

function hasCoreNarrativeData(manifest: ChronicaPackageManifest): boolean {
  if (!manifest.entryFragmentId.trim()) return false;
  const caps = manifest.capabilities;
  // No caps declared → treat as narrative by default (legacy manifests).
  if (!caps || caps.length === 0) return true;
  return caps.includes('narrative');
}

function unsupportedResult(
  errors: string[],
  warnings: string[],
  extras: Partial<CompatibilityResult> = {},
): CompatibilityResult {
  return {
    ok: false,
    compatibilityLevel: 'unsupported',
    errors,
    warnings,
    missingRequiredModules: extras.missingRequiredModules ?? [],
    missingOptionalModules: extras.missingOptionalModules ?? [],
    unsupportedCapabilities: extras.unsupportedCapabilities ?? [],
    unsupportedRuntimeTargets: extras.unsupportedRuntimeTargets ?? [],
    selectedRuntimeTarget: extras.selectedRuntimeTarget,
  };
}

/**
 * Validate a compat manifest against the host's capabilities.
 *
 * Structural problems (missing packageId, unsupported schema, missing entry
 * fragment) are reported as errors and always force `compatibilityLevel:
 * 'unsupported'`. Otherwise the validator selects a runtime target and grades
 * the result playable / limited / editor_only per the spec.
 *
 * Manifests without a `runtimeTargets` array fall back to root-level
 * capabilities and entryFragmentId — this is how existing mobile packages
 * (which predate the target model) stay compatible.
 */
export function validateChronicaPackageCompatibility(
  manifest: ChronicaPackageManifest,
  options: CompatibilityOptions = {},
): CompatibilityResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const supportedIds = toSet(options.supportedRuntimeTargetIds);
  const supportedCaps = toSet(options.supportedCapabilities);
  const availableModules = toSet(options.availableModules);
  const minSchema = options.minSchemaVersion ?? DEFAULT_MIN_SCHEMA;
  const maxSchema = options.maxSchemaVersion ?? DEFAULT_MAX_SCHEMA;

  // -------- structural checks --------

  if (typeof manifest.packageId !== 'string' || !manifest.packageId.trim()) {
    errors.push('Manifest is missing packageId.');
  }
  if (typeof manifest.title !== 'string' || !manifest.title.trim()) {
    errors.push('Manifest is missing title.');
  }
  if (typeof manifest.schemaVersion !== 'number' || !Number.isFinite(manifest.schemaVersion)) {
    errors.push('Manifest is missing schemaVersion.');
  } else if (manifest.schemaVersion < minSchema || manifest.schemaVersion > maxSchema) {
    errors.push(
      `Unsupported schemaVersion ${manifest.schemaVersion} (host supports ${minSchema}–${maxSchema}).`,
    );
  }

  const targets = manifest.runtimeTargets ?? [];
  const hasTargets = targets.length > 0;
  const effectiveEntryFragmentIds = new Set<string>();
  if (manifest.entryFragmentId?.trim()) {
    effectiveEntryFragmentIds.add(manifest.entryFragmentId);
  }
  for (const target of targets) {
    if (target.entryFragmentId?.trim()) effectiveEntryFragmentIds.add(target.entryFragmentId);
  }
  if (effectiveEntryFragmentIds.size === 0) {
    errors.push('Manifest is missing entryFragmentId.');
  }

  // -------- module checks --------

  const missingRequiredModules: string[] = [];
  for (const id of manifest.requiredModules ?? []) {
    if (!availableModules.has(id)) {
      missingRequiredModules.push(id);
      errors.push(`Required module not available: ${id}.`);
    }
  }

  const missingOptionalModules: string[] = [];
  for (const id of manifest.optionalModules ?? []) {
    if (!availableModules.has(id)) {
      missingOptionalModules.push(id);
      warnings.push(`Optional module not available: ${id}.`);
    }
  }

  // -------- capability + target evaluation --------

  const unsupportedCapabilities = (manifest.capabilities ?? []).filter(
    cap => !supportedCaps.has(cap),
  );
  const evaluations = targets.map(target => evaluateTarget(target, supportedIds, supportedCaps));
  const unsupportedRuntimeTargets = evaluations
    .filter(e => e.kind === 'incompatible')
    .map(e => e.target.id);

  // If any required target is entirely incompatible → unsupported.
  const requiredIncompatible = evaluations.find(
    e => e.target.required === true && e.kind === 'incompatible',
  );
  if (requiredIncompatible) {
    errors.push(
      `Required runtime target is unsupported: ${requiredIncompatible.target.id}.`,
    );
  }

  // Bail early if any structural / required-issue error fired.
  if (errors.length) {
    return unsupportedResult(errors, warnings, {
      missingRequiredModules,
      missingOptionalModules,
      unsupportedCapabilities,
      unsupportedRuntimeTargets,
    });
  }

  // -------- select compatibility level --------

  let compatibilityLevel: CompatibilityLevel;
  let selectedRuntimeTarget: ChronicaRuntimeTarget | undefined;

  if (hasTargets) {
    // Prefer required targets first, then optional; among each group, prefer full over partial.
    const required = evaluations.filter(e => e.target.required === true);
    const optional = evaluations.filter(e => e.target.required !== true);
    const ordered = [...required, ...optional];

    const fullMatch = ordered.find(e => e.kind === 'full');
    if (fullMatch) {
      selectedRuntimeTarget = fullMatch.target;
      compatibilityLevel = 'playable';
    } else {
      const partialMatch = ordered.find(e => e.kind === 'partial');
      if (partialMatch) {
        selectedRuntimeTarget = partialMatch.target;
        compatibilityLevel = 'limited';
        for (const cap of partialMatch.missingCapabilities) {
          warnings.push(
            `Runtime target "${partialMatch.target.id}" requests unsupported capability: ${cap}.`,
          );
        }
      } else if (hasCoreNarrativeData(manifest)) {
        // No runnable target, but the story data itself is readable.
        compatibilityLevel = 'editor_only';
      } else {
        compatibilityLevel = 'unsupported';
        errors.push('No runtime target is compatible with this host.');
      }
    }

    // Additional warnings for optional targets that the host can't reach.
    for (const incompatible of evaluations.filter(
      e => e.kind === 'incompatible' && e.target.required !== true,
    )) {
      warnings.push(`Optional runtime target is unsupported: ${incompatible.target.id}.`);
    }
  } else {
    // Legacy path — no runtimeTargets, evaluate root capabilities directly.
    const rootCaps = manifest.capabilities ?? [];
    if (rootCaps.length === 0) {
      // Nothing declared → treat as playable narrative-only.
      compatibilityLevel = 'playable';
    } else if (unsupportedCapabilities.length === 0) {
      compatibilityLevel = 'playable';
    } else if (unsupportedCapabilities.length < rootCaps.length) {
      compatibilityLevel = 'limited';
      for (const cap of unsupportedCapabilities) {
        warnings.push(`Manifest requests unsupported capability: ${cap}.`);
      }
    } else if (hasCoreNarrativeData(manifest)) {
      compatibilityLevel = 'editor_only';
    } else {
      compatibilityLevel = 'unsupported';
      errors.push('None of the manifest capabilities are supported by this host.');
    }
  }

  const ok = errors.length === 0 && compatibilityLevel !== 'unsupported';

  return {
    ok,
    compatibilityLevel,
    selectedRuntimeTarget,
    errors,
    warnings,
    missingRequiredModules,
    missingOptionalModules,
    unsupportedCapabilities,
    unsupportedRuntimeTargets,
  };
}
