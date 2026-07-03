import { ChronicaSession } from '../engine/compat/chronica-session';
import {
  V3_COMPAT_FIXTURE_CONTENT_HASH,
  V3_COMPAT_FIXTURE_GAME_ID,
  V3_COMPAT_FIXTURE_INSTALL_ID,
  v3CompatibilityFixturePackage,
} from '../engine/compat/fixtures';
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
  type EchoSavePayload,
  type InstabilitySavePayload,
} from '../engine/compat/modules';
import {
  MOBILE_PLAYER_COMPATIBILITY_OPTIONS,
  MOBILE_PLAYER_TARGET_ID,
  validateChronicaPackageCompatibility,
} from '../engine/compat/package';
import { isCanonicalSaveV2Shape } from '../engine/compat/save-load';

async function exhaustDialogue(session: ChronicaSession): Promise<void> {
  while (!session.isDialogueExhausted()) {
    const result = await session.advanceDialogue();
    if (!result.ok || !result.advanced) break;
  }
}

describe('v3 compatibility fixture package', () => {
  test('validates as known-limited (schema v3) with mobile-player target', () => {
    const result = validateChronicaPackageCompatibility(
      v3CompatibilityFixturePackage.manifest,
      MOBILE_PLAYER_COMPATIBILITY_OPTIONS,
    );
    expect(result.ok).toBe(true);
    expect(result.compatibilityLevel).toBe('limited');
    expect(result.schemaVersionSupport).toBe('known-limited');
    expect(result.selectedRuntimeTarget?.id).toBe(MOBILE_PLAYER_TARGET_ID);
    expect(result.warnings.some(w => w.includes('schemaVersion 3'))).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('ingests successfully with v3 story features preserved', () => {
    const result = ingestChronicaPackageForMobilePlayer(v3CompatibilityFixturePackage);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.game.gameId).toBe(V3_COMPAT_FIXTURE_GAME_ID);
    expect(result.project.schemaVersion).toBe(3);
    expect(result.compatibility.schemaVersionSupport).toBe('known-limited');
    expect(result.selectedRuntimeTarget?.id).toBe(MOBILE_PLAYER_TARGET_ID);

    const lighthouse = result.project.fragments.find(f => f.uid === 'f-lighthouse');
    expect(lighthouse?.dialogue).toHaveLength(2);
    expect(lighthouse?.stageActors).toHaveLength(1);
    expect(lighthouse?.backgroundImage).toBe('lighthouse-interior.jpg');

    const dock = result.project.fragments.find(f => f.uid === 'f-dock');
    expect(dock?.hotspots).toHaveLength(1);
    expect(dock?.stageActors).toHaveLength(1);

    expect(result.project.assets).toHaveLength(5);
    expect(result.project.characters).toHaveLength(1);
    expect(result.project.initialVariables?.trust).toBe(0);
  });

  test('plays two turns, saves canonical v2, resumes with module payloads', async () => {
    const created = await createMobileSessionFromChronicaPackage(v3CompatibilityFixturePackage, {
      installId: V3_COMPAT_FIXTURE_INSTALL_ID,
      modules: { instability: true, echo: true },
      autoStart: true,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const { session } = created;
    expect(session.fragment?.locationId).toBe('lighthouse');
    expect(session.state.getVariable('trust')).toBe(1);
    expect(session.state.hasFlag('met_keeper')).toBe(true);

    await exhaustDialogue(session);
    expect(session.visibleChoices).toHaveLength(1);

    const choiceTurn = await session.choose(session.visibleChoices[0]);
    expect(choiceTurn.ok).toBe(true);
    expect(session.fragment?.locationId).toBe('dock');
    expect(session.visibleHotspots).toHaveLength(1);

    const hotspotTurn = await session.activateHotspot(session.visibleHotspots[0]);
    expect(hotspotTurn.ok).toBe(true);
    expect(session.state.getVariable('supplies_found')).toBe(true);
    expect(session.state.getVariable('trust')).toBe(2);
    expect(session.state.instability).toBeGreaterThan(0);

    const save = session.toSave(V3_COMPAT_FIXTURE_INSTALL_ID, { format: 'canonical-v2' });
    expect(save).not.toBeNull();
    expect(isCanonicalSaveV2Shape(save)).toBe(true);
    expect(save).toEqual(
      expect.objectContaining({
        formatVersion: 2,
        gameId: V3_COMPAT_FIXTURE_GAME_ID,
        contentHash: created.game.contentHash,
        savedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      }),
    );
    expect(Array.isArray(save!.modules)).toBe(true);

    const instabilityPayload = moduleSaveDataFromCompat(
      save!.modules,
      INSTABILITY_MODULE_ID,
    ) as InstabilitySavePayload;
    expect(instabilityPayload.version).toBe(1);
    expect(instabilityPayload.instability).toBeGreaterThan(0);

    const echoPayload = moduleSaveDataFromCompat(save!.modules, ECHO_MODULE_ID) as EchoSavePayload;
    expect(echoPayload.version).toBe(1);
    expect(echoPayload.echoes.some(e => e.id === 'echo-harbor')).toBe(true);

    const target = new ChronicaSession(created.game);
    target.register(createInstabilityModule({ turnIncrement: 5 }));
    target.register(
      createEchoModule(
        v3CompatibilityFixturePackage.modules?.[ECHO_MODULE_ID] as {
          echoes: { id: string; activationThreshold: number; manifestationThreshold: number }[];
        },
      ),
    );
    const resume = await target.tryResume({ save: save! });
    expect(resume.ok).toBe(true);
    expect(target.fragment?.locationId).toBe('dock');
    expect(target.state.getVariable('supplies_found')).toBe(true);
    expect(target.state.getVariable('trust')).toBe(2);
    expect(target.state.instability).toBe(instabilityPayload.instability);

    const restoredEcho = target.context.getModuleData<{ id: string; state: string }[]>(
      ECHO_MODULE_ID,
    );
    expect(restoredEcho?.find(e => e.id === 'echo-harbor')).toBeDefined();
  });

  test('manifest declares gameId and contentHash hints', () => {
    expect(v3CompatibilityFixturePackage.manifest.packageId).toBe(V3_COMPAT_FIXTURE_GAME_ID);
    expect(v3CompatibilityFixturePackage.manifest.contentHash).toBe(V3_COMPAT_FIXTURE_CONTENT_HASH);
    expect(v3CompatibilityFixturePackage.manifest.runtimeTargets).toHaveLength(2);
    expect(v3CompatibilityFixturePackage.modules?.[INSTABILITY_MODULE_ID]).toBeDefined();
    expect(v3CompatibilityFixturePackage.modules?.[ECHO_MODULE_ID]).toBeDefined();
  });
});
