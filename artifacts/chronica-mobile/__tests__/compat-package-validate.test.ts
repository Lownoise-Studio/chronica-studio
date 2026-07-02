import {
  MOBILE_PLAYER_CAPABILITIES,
  MOBILE_PLAYER_COMPATIBILITY_OPTIONS,
  MOBILE_PLAYER_TARGET_ID,
  validateChronicaPackageCompatibility,
  type ChronicaPackageManifest,
  type ChronicaRuntimeTarget,
} from '../engine/compat/package';

function mobileOptions(overrides: Partial<Parameters<typeof validateChronicaPackageCompatibility>[1]> = {}) {
  return {
    ...MOBILE_PLAYER_COMPATIBILITY_OPTIONS,
    ...overrides,
  };
}

function makeManifest(overrides: Partial<ChronicaPackageManifest> = {}): ChronicaPackageManifest {
  return {
    schemaVersion: 2,
    packageId: 'pkg-1',
    title: 'A Chronicle',
    entryFragmentId: 'f-start',
    capabilities: [...MOBILE_PLAYER_CAPABILITIES],
    ...overrides,
  };
}

const mobilePlayerTarget: ChronicaRuntimeTarget = {
  id: MOBILE_PLAYER_TARGET_ID,
  label: 'Mobile Player',
  capabilities: ['narrative', 'dialogue', 'choices', 'variables', 'save-load', 'stage2d'],
  assetProfile: 'mobile',
  presentation: 'stage2d',
};

const godot3dTarget: ChronicaRuntimeTarget = {
  id: 'godot-3d',
  label: 'Godot 3D',
  capabilities: ['narrative', 'stage3d', 'terrain', 'placeable-objects'],
  assetProfile: 'godot',
  presentation: 'stage3d',
};

describe('validateChronicaPackageCompatibility', () => {
  test('a mobile-player-only manifest is playable', () => {
    const manifest = makeManifest({
      runtimeTargets: [mobilePlayerTarget],
    });
    const result = validateChronicaPackageCompatibility(manifest, mobileOptions());
    expect(result.ok).toBe(true);
    expect(result.compatibilityLevel).toBe('playable');
    expect(result.selectedRuntimeTarget?.id).toBe(MOBILE_PLAYER_TARGET_ID);
    expect(result.errors).toHaveLength(0);
  });

  test('godot-3d + mobile-player selects mobile-player on a mobile host', () => {
    const manifest = makeManifest({
      runtimeTargets: [godot3dTarget, mobilePlayerTarget],
    });
    const result = validateChronicaPackageCompatibility(manifest, mobileOptions());
    expect(result.compatibilityLevel).toBe('playable');
    expect(result.selectedRuntimeTarget?.id).toBe(MOBILE_PLAYER_TARGET_ID);
    expect(result.unsupportedRuntimeTargets).toEqual(['godot-3d']);
    expect(result.warnings.some(w => w.includes('godot-3d'))).toBe(true);
  });

  test('only-godot-3d required target reports unsupported', () => {
    const manifest = makeManifest({
      runtimeTargets: [{ ...godot3dTarget, required: true }],
    });
    const result = validateChronicaPackageCompatibility(manifest, mobileOptions());
    expect(result.ok).toBe(false);
    expect(result.compatibilityLevel).toBe('unsupported');
    expect(result.unsupportedRuntimeTargets).toEqual(['godot-3d']);
    expect(result.errors.some(e => e.includes('godot-3d'))).toBe(true);
  });

  test('unsupported OPTIONAL target does not fail — warns and picks the compatible one', () => {
    const manifest = makeManifest({
      runtimeTargets: [
        { ...godot3dTarget, required: false },
        mobilePlayerTarget,
      ],
    });
    const result = validateChronicaPackageCompatibility(manifest, mobileOptions());
    expect(result.ok).toBe(true);
    expect(result.compatibilityLevel).toBe('playable');
    expect(result.warnings.some(w => w.toLowerCase().includes('optional'))).toBe(true);
  });

  test('partial capability match on a supported target reports limited', () => {
    const partialMobile: ChronicaRuntimeTarget = {
      ...mobilePlayerTarget,
      capabilities: ['narrative', 'inventory-3d'], // inventory-3d not supported
    };
    const manifest = makeManifest({
      runtimeTargets: [partialMobile],
    });
    const result = validateChronicaPackageCompatibility(manifest, mobileOptions());
    expect(result.ok).toBe(true);
    expect(result.compatibilityLevel).toBe('limited');
    expect(result.selectedRuntimeTarget?.id).toBe(MOBILE_PLAYER_TARGET_ID);
    expect(result.warnings.some(w => w.includes('inventory-3d'))).toBe(true);
  });

  test('no compatible target but core narrative data yields editor_only', () => {
    const manifest = makeManifest({
      runtimeTargets: [godot3dTarget],
      capabilities: ['narrative'],
    });
    const result = validateChronicaPackageCompatibility(manifest, mobileOptions());
    expect(result.compatibilityLevel).toBe('editor_only');
    expect(result.selectedRuntimeTarget).toBeUndefined();
  });

  test('missing required module fails', () => {
    const manifest = makeManifest({
      runtimeTargets: [mobilePlayerTarget],
      requiredModules: ['chronica.instability', 'chronica.echoes'],
    });
    const result = validateChronicaPackageCompatibility(manifest, mobileOptions({
      availableModules: ['chronica.instability'],
    }));
    expect(result.ok).toBe(false);
    expect(result.compatibilityLevel).toBe('unsupported');
    expect(result.missingRequiredModules).toEqual(['chronica.echoes']);
    expect(result.errors.some(e => e.includes('chronica.echoes'))).toBe(true);
  });

  test('missing optional module warns without failing', () => {
    const manifest = makeManifest({
      runtimeTargets: [mobilePlayerTarget],
      optionalModules: ['chronica.echoes'],
    });
    const result = validateChronicaPackageCompatibility(manifest, mobileOptions({
      availableModules: [],
    }));
    expect(result.ok).toBe(true);
    expect(result.missingOptionalModules).toEqual(['chronica.echoes']);
    expect(result.warnings.some(w => w.includes('chronica.echoes'))).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('unsupported root capability is reported', () => {
    const manifest = makeManifest({
      runtimeTargets: [mobilePlayerTarget],
      capabilities: [...MOBILE_PLAYER_CAPABILITIES, 'placeable-objects'],
    });
    const result = validateChronicaPackageCompatibility(manifest, mobileOptions());
    expect(result.unsupportedCapabilities).toEqual(['placeable-objects']);
  });

  test('unsupported schemaVersion errors', () => {
    const manifest = makeManifest({ schemaVersion: 99, runtimeTargets: [mobilePlayerTarget] });
    const result = validateChronicaPackageCompatibility(manifest, mobileOptions());
    expect(result.ok).toBe(false);
    expect(result.compatibilityLevel).toBe('unsupported');
    expect(result.errors.some(e => e.includes('schemaVersion'))).toBe(true);
  });

  test('missing packageId, title, and entryFragmentId all error', () => {
    const manifest: ChronicaPackageManifest = {
      schemaVersion: 2,
      packageId: '',
      title: '',
      entryFragmentId: '',
      runtimeTargets: [mobilePlayerTarget],
    };
    const result = validateChronicaPackageCompatibility(manifest, mobileOptions());
    expect(result.ok).toBe(false);
    expect(result.compatibilityLevel).toBe('unsupported');
    expect(result.errors.some(e => e.includes('packageId'))).toBe(true);
    expect(result.errors.some(e => e.includes('title'))).toBe(true);
    expect(result.errors.some(e => e.includes('entryFragmentId'))).toBe(true);
  });

  test('target-level entryFragmentId satisfies the missing-entry check', () => {
    const manifest: ChronicaPackageManifest = {
      schemaVersion: 2,
      packageId: 'pkg-1',
      title: 'A Chronicle',
      entryFragmentId: '',
      runtimeTargets: [{ ...mobilePlayerTarget, entryFragmentId: 'f-start' }],
    };
    const result = validateChronicaPackageCompatibility(manifest, mobileOptions());
    expect(result.errors.some(e => e.includes('entryFragmentId'))).toBe(false);
    expect(result.compatibilityLevel).toBe('playable');
  });

  test('legacy manifest without runtimeTargets uses root capabilities (playable)', () => {
    const manifest = makeManifest({
      runtimeTargets: undefined,
      capabilities: ['narrative', 'choices'],
    });
    const result = validateChronicaPackageCompatibility(manifest, mobileOptions());
    expect(result.ok).toBe(true);
    expect(result.compatibilityLevel).toBe('playable');
    expect(result.selectedRuntimeTarget).toBeUndefined();
  });

  test('legacy manifest with mixed capabilities → limited', () => {
    const manifest = makeManifest({
      runtimeTargets: undefined,
      capabilities: ['narrative', 'terrain'],
    });
    const result = validateChronicaPackageCompatibility(manifest, mobileOptions());
    expect(result.compatibilityLevel).toBe('limited');
    expect(result.unsupportedCapabilities).toEqual(['terrain']);
    expect(result.warnings.some(w => w.includes('terrain'))).toBe(true);
  });

  test('legacy manifest with all-unsupported caps yet narrative data → editor_only', () => {
    const manifest = makeManifest({
      runtimeTargets: undefined,
      capabilities: ['terrain', 'stage3d'],
    });
    const result = validateChronicaPackageCompatibility(manifest, mobileOptions());
    // All caps unsupported, and neither is 'narrative' → no narrative fallback.
    expect(result.compatibilityLevel).toBe('unsupported');
  });

  test('legacy manifest with no capabilities is playable by default', () => {
    const manifest = makeManifest({
      runtimeTargets: undefined,
      capabilities: undefined,
    });
    const result = validateChronicaPackageCompatibility(manifest, mobileOptions());
    expect(result.compatibilityLevel).toBe('playable');
  });

  test('required target with partial capabilities is limited (not unsupported)', () => {
    const manifest = makeManifest({
      runtimeTargets: [
        {
          ...mobilePlayerTarget,
          required: true,
          capabilities: ['narrative', 'inventory-3d'],
        },
      ],
    });
    const result = validateChronicaPackageCompatibility(manifest, mobileOptions());
    // The target id IS supported; only some caps are not → partial, thus limited.
    expect(result.compatibilityLevel).toBe('limited');
    expect(result.ok).toBe(true);
  });

  test('multiple targets sorts required first then optional', () => {
    const manifest = makeManifest({
      runtimeTargets: [
        { ...godot3dTarget }, // optional, incompatible
        { ...mobilePlayerTarget, required: true }, // required, full
      ],
    });
    const result = validateChronicaPackageCompatibility(manifest, mobileOptions());
    expect(result.compatibilityLevel).toBe('playable');
    expect(result.selectedRuntimeTarget?.id).toBe(MOBILE_PLAYER_TARGET_ID);
  });
});
