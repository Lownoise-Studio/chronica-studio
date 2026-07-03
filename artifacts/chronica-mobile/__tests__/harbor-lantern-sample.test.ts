import { ChronicaSession } from '../engine/compat/chronica-session';
import {
  HARBOR_LANTERN_ENDING_FRAGMENT_UID,
  HARBOR_LANTERN_ENDING_LOCATION_ID,
  HARBOR_LANTERN_SAMPLE_DESCRIPTION,
  HARBOR_LANTERN_SAMPLE_GAME_ID,
  HARBOR_LANTERN_SAMPLE_INSTALL_ID,
  HARBOR_LANTERN_SAMPLE_TITLE,
  HARBOR_LANTERN_SAMPLE_COVER_ASSET,
  HARBOR_CHOICE_TO_ENDING,
  HARBOR_CHOICE_TO_PIER,
  HARBOR_CHOICE_TO_WAREHOUSE,
  HARBOR_HOTSPOT_SUPPLY_CRATE,
  exhaustDialogue,
  harborLanternSamplePackage,
  playHarborLanternMainPath,
} from '../demo/harbor-lantern-sample';
import {
  createMobileSessionFromChronicaPackage,
  ingestChronicaPackageForMobilePlayer,
} from '../engine/compat/ingest';
import { moduleSaveDataFromCompat } from '../engine/compat/module-save';
import {
  ECHO_MODULE_ID,
  INSTABILITY_MODULE_ID,
  createEchoModule,
  createInstabilityModule,
  type InstabilitySavePayload,
} from '../engine/compat/modules';
import {
  MOBILE_PLAYER_COMPATIBILITY_OPTIONS,
  MOBILE_PLAYER_TARGET_ID,
  validateChronicaPackageCompatibility,
} from '../engine/compat/package';
import { isCanonicalSaveV2Shape } from '../engine/compat/save-load';

describe('Harbor Lantern spec-compliance sample package', () => {
  test('declares catalog metadata and cover placeholder', () => {
    expect(harborLanternSamplePackage.manifest.title).toBe(HARBOR_LANTERN_SAMPLE_TITLE);
    expect(harborLanternSamplePackage.metadata?.description).toBe(HARBOR_LANTERN_SAMPLE_DESCRIPTION);
    expect(harborLanternSamplePackage.metadata?.coverImage).toBe(HARBOR_LANTERN_SAMPLE_COVER_ASSET);
    expect(harborLanternSamplePackage.metadata?.kind).toBe('spec-compliance-sample');
    expect(
      harborLanternSamplePackage.assets?.some(
        a => typeof a === 'object' && a !== null && 'name' in a && a.name === HARBOR_LANTERN_SAMPLE_COVER_ASSET,
      ),
    ).toBe(true);
  });

  test('validates as known-limited schema v3 with mobile-player target', () => {
    const result = validateChronicaPackageCompatibility(
      harborLanternSamplePackage.manifest,
      MOBILE_PLAYER_COMPATIBILITY_OPTIONS,
    );
    expect(result.ok).toBe(true);
    expect(result.compatibilityLevel).toBe('limited');
    expect(result.schemaVersionSupport).toBe('known-limited');
    expect(result.selectedRuntimeTarget?.id).toBe(MOBILE_PLAYER_TARGET_ID);
    expect(result.errors).toHaveLength(0);
  });

  test('ingests five fragments with v3 story features', () => {
    const result = ingestChronicaPackageForMobilePlayer(harborLanternSamplePackage, {
      description: HARBOR_LANTERN_SAMPLE_DESCRIPTION,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.game.gameId).toBe(HARBOR_LANTERN_SAMPLE_GAME_ID);
    expect(result.project.fragments).toHaveLength(5);
    expect(result.project.description).toBe(HARBOR_LANTERN_SAMPLE_DESCRIPTION);
    expect(result.project.fragments.find(f => f.uid === HARBOR_LANTERN_ENDING_FRAGMENT_UID)).toBeDefined();

    const dock = result.project.fragments.find(f => f.uid === 'f-dock');
    expect(dock?.hotspots).toHaveLength(1);
    expect(dock?.choices.some(c => c.conditions.length > 0)).toBe(true);
  });

  test('plays main path, saves canonical v2, resumes, and reaches ending', async () => {
    const created = await createMobileSessionFromChronicaPackage(harborLanternSamplePackage, {
      installId: HARBOR_LANTERN_SAMPLE_INSTALL_ID,
      description: HARBOR_LANTERN_SAMPLE_DESCRIPTION,
      modules: { instability: true, echo: true },
      autoStart: true,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const { session } = created;
    expect(session.visibleChoices.some(c => c.uid === 'c-to-warehouse')).toBe(false);

    await playHarborLanternMainPath(session);

    expect(session.fragment?.uid).toBe(HARBOR_LANTERN_ENDING_FRAGMENT_UID);
    expect(session.fragment?.locationId).toBe(HARBOR_LANTERN_ENDING_LOCATION_ID);
    expect(session.state.getVariable('supplies_found')).toBe(true);
    expect(session.state.getVariable('trust')).toBe(3);
    expect(session.state.hasFlag('lantern_lit')).toBe(true);
    expect(session.state.instability).toBeGreaterThan(0);

    const echoState = session.context.getModuleData<{ id: string; state: string }[]>(ECHO_MODULE_ID);
    expect(echoState?.find(e => e.id === 'echo-harbor')).toBeDefined();

    const save = session.toSave(HARBOR_LANTERN_SAMPLE_INSTALL_ID, { format: 'canonical-v2' });
    expect(save).not.toBeNull();
    expect(isCanonicalSaveV2Shape(save)).toBe(true);

    const instabilityPayload = moduleSaveDataFromCompat(
      save!.modules,
      INSTABILITY_MODULE_ID,
    ) as InstabilitySavePayload;
    expect(instabilityPayload.instability).toBeGreaterThan(0);

    const target = new ChronicaSession(created.game);
    target.register(createInstabilityModule({ turnIncrement: 3 }));
    target.register(
      createEchoModule(
        harborLanternSamplePackage.modules?.[ECHO_MODULE_ID] as {
          echoes: { id: string; activationThreshold: number; manifestationThreshold: number }[];
        },
      ),
    );
    const resume = await target.tryResume({ save: save! });
    expect(resume.ok).toBe(true);
    expect(target.fragment?.uid).toBe(HARBOR_LANTERN_ENDING_FRAGMENT_UID);
    expect(target.state.getVariable('trust')).toBe(3);
    expect(target.state.instability).toBe(instabilityPayload.instability);
  });

  test('save/resume smoke holds mid-path state before ending', async () => {
    const created = await createMobileSessionFromChronicaPackage(harborLanternSamplePackage, {
      installId: HARBOR_LANTERN_SAMPLE_INSTALL_ID,
      modules: { instability: true, echo: true },
      autoStart: true,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const { session } = created;
    await exhaustDialogue(session);
    await session.choose(session.visibleChoices[0]);
    const hotspot = session.visibleHotspots.find(h => h.uid === HARBOR_HOTSPOT_SUPPLY_CRATE);
    expect(hotspot).toBeDefined();
    await session.activateHotspot(hotspot!);

    const save = session.toSave(HARBOR_LANTERN_SAMPLE_INSTALL_ID, { format: 'canonical-v2' });
    expect(isCanonicalSaveV2Shape(save)).toBe(true);

    const resumed = await createMobileSessionFromChronicaPackage(harborLanternSamplePackage, {
      installId: HARBOR_LANTERN_SAMPLE_INSTALL_ID,
      modules: { instability: true, echo: true },
      autoStart: false,
    });
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) return;

    const target = resumed.session;
    target.register(createInstabilityModule({ turnIncrement: 3 }));
    target.register(
      createEchoModule(
        harborLanternSamplePackage.modules?.[ECHO_MODULE_ID] as {
          echoes: { id: string; activationThreshold: number; manifestationThreshold: number }[];
        },
      ),
    );
    const resumeResult = await target.tryResume({ save: save! });
    expect(resumeResult.ok).toBe(true);
    expect(target.fragment?.locationId).toBe('dock');
    expect(target.state.getVariable('supplies_found')).toBe(true);
    expect(target.visibleChoices.some(c => c.uid === HARBOR_CHOICE_TO_WAREHOUSE)).toBe(true);

    await target.choose(target.visibleChoices.find(c => c.uid === HARBOR_CHOICE_TO_WAREHOUSE)!);
    await exhaustDialogue(target);
    await target.choose(target.visibleChoices.find(c => c.uid === HARBOR_CHOICE_TO_PIER)!);
    await target.choose(target.visibleChoices.find(c => c.uid === HARBOR_CHOICE_TO_ENDING)!);
    await exhaustDialogue(target);
    expect(target.fragment?.uid).toBe(HARBOR_LANTERN_ENDING_FRAGMENT_UID);
  });
});
