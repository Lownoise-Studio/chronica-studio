import {
  NO_RUNTIME_TARGET,
  importChronicaPackageForDeveloper,
  summarizeSession,
} from '../dev/chronica-compat-import';
import { godotHybridFixturePackage } from '../dev/fixtures/godot-hybrid-package';
import { ECHO_MODULE_ID, INSTABILITY_MODULE_ID } from '../engine/compat/modules';
import {
  MOBILE_PLAYER_COMPATIBILITY_OPTIONS,
  MOBILE_PLAYER_TARGET_ID,
  validateChronicaPackageCompatibility,
} from '../engine/compat/package';

describe('godot-hybrid fixture', () => {
  test('validates as playable against the mobile-player options', () => {
    const result = validateChronicaPackageCompatibility(
      godotHybridFixturePackage.manifest,
      MOBILE_PLAYER_COMPATIBILITY_OPTIONS,
    );
    expect(result.ok).toBe(true);
    expect(result.compatibilityLevel).toBe('playable');
    expect(result.selectedRuntimeTarget?.id).toBe(MOBILE_PLAYER_TARGET_ID);
  });

  test('validates as playable even when the caller ignores the godot-3d target', () => {
    const result = validateChronicaPackageCompatibility(
      godotHybridFixturePackage.manifest,
      MOBILE_PLAYER_COMPATIBILITY_OPTIONS,
    );
    // godot-3d id is not in the mobile host's supported ids — expect a warning.
    expect(result.unsupportedRuntimeTargets).toEqual(['godot-3d']);
    expect(result.warnings.some(w => w.includes('godot-3d'))).toBe(true);
  });
});

describe('importChronicaPackageForDeveloper', () => {
  test('creates a session that starts at the fixture entry fragment', async () => {
    const result = await importChronicaPackageForDeveloper(godotHybridFixturePackage);
    expect(result.ok).toBe(true);
    expect(result.started).toBe(true);
    expect(result.session?.fragment?.uid).toBe('f-intro');
    expect(result.session?.fragment?.locationId).toBe('intro');
  });

  test('summary reports title, playable level, and mobile-player target', async () => {
    const result = await importChronicaPackageForDeveloper(godotHybridFixturePackage);
    expect(result.summary.title).toBe('Godot Hybrid Fixture');
    expect(result.summary.compatibilityLevel).toBe('playable');
    expect(result.summary.selectedRuntimeTarget).toBe(MOBILE_PLAYER_TARGET_ID);
    expect(result.summary.availableChoices).toEqual([
      { uid: 'c-forest', label: 'Walk into the forest' },
    ]);
    expect(result.summary.currentFragmentText).toMatch(/campfire/);
  });

  test('choice advances to the second fragment', async () => {
    const result = await importChronicaPackageForDeveloper(godotHybridFixturePackage);
    if (!result.session) throw new Error('session should exist');
    const choice = result.session.visibleChoices[0];
    const chose = await result.session.choose(choice);
    expect(chose.ok).toBe(true);
    expect(result.session.fragment?.uid).toBe('f-forest');
    const nextSummary = summarizeSession(
      result.session,
      result.compatibility,
      result.summary.title,
      result.summary.warningsCount,
    );
    expect(nextSummary.currentFragmentText).toMatch(/mist/);
    expect(nextSummary.availableChoices).toEqual([]);
  });

  test('surfaces 3D-only fragment fields as unsupported content', async () => {
    const result = await importChronicaPackageForDeveloper(godotHybridFixturePackage);
    const paths = result.unsupportedContent.map(r => r.path).sort();
    expect(paths).toEqual(expect.arrayContaining([
      'fragments[0].terrain',
      'fragments[1].camera',
    ]));
    expect(result.summary.warningsCount).toBeGreaterThan(0);
  });

  test('attaches first-party modules by default', async () => {
    const result = await importChronicaPackageForDeveloper(godotHybridFixturePackage);
    expect(result.session?.modules.has(INSTABILITY_MODULE_ID)).toBe(true);
    expect(result.session?.modules.has(ECHO_MODULE_ID)).toBe(true);
  });

  test('module hints from the fixture reach the echo module', async () => {
    const result = await importChronicaPackageForDeveloper(godotHybridFixturePackage);
    const echoes = result.session?.context.getModuleData<{ id: string }[]>(ECHO_MODULE_ID);
    expect(echoes?.map(e => e.id)).toEqual(['echo-forest']);
  });

  test('returns failure summary when the package is unsupported', async () => {
    const broken = {
      ...godotHybridFixturePackage,
      manifest: { ...godotHybridFixturePackage.manifest, schemaVersion: 99 },
    };
    const result = await importChronicaPackageForDeveloper(broken);
    expect(result.ok).toBe(false);
    expect(result.session).toBeUndefined();
    expect(result.summary.selectedRuntimeTarget).toBe(NO_RUNTIME_TARGET);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('honors autoStart: false so callers can inspect before starting', async () => {
    const result = await importChronicaPackageForDeveloper(godotHybridFixturePackage, {
      autoStart: false,
    });
    expect(result.ok).toBe(true);
    expect(result.started).toBe(false);
    expect(result.session?.isStarted).toBe(false);
  });
});
