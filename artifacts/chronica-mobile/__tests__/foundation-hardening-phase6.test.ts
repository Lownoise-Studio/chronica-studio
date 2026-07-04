import { compileProject } from '../engine/compiler';
import {
  buildDiagnosticReport,
  buildEditorTransactionFailureReport,
  buildPackageCompatibilityReport,
  buildPackageImportReport,
  createEngineDiagnostic,
  diagnoseRuntimeActionFailure,
  EngineError,
  fromContractDiagnostic,
  fromLoadSaveReason,
  fromPackageCompatibility,
  fromResumeRejection,
  fromRuntimeFallbackWarning,
  fromValidationError,
  snapshotEditorTransaction,
  snapshotEngineState,
  snapshotRuntimeState,
} from '../engine/diagnostics';
import { deleteAssetMutation } from '../engine/editor-mutations';
import { runEditorTransaction } from '../engine/editor-transactions';
import {
  configureEngineLogging,
  createMemoryLogSink,
  engineLog,
  getEngineLogMinLevel,
} from '../engine/engine-logging';
import {
  checkPackageCompatibility,
  MOBILE_PLAYER_RUNTIME_CAPABILITIES,
  NARRATIVE_ONLY_RUNTIME_CAPABILITIES,
} from '../engine/package-compatibility';
import { RuntimeInvariantError } from '../runtime/chronica-runtime';
import { PlayerHost } from '../runtime/player-host';
import type { Project, ProjectAsset } from '../engine/types';

function sampleAsset(name: string): ProjectAsset {
  return {
    id: `asset-${name}`,
    name,
    type: 'image',
    uri: `file:///device/${name}`,
    mimeType: 'image/png',
    size: 1024,
    importedAt: '',
  };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    schemaVersion: 3,
    gameId: 'a0000001-0000-4000-8000-000000000099',
    id: 'p1',
    title: 'Diagnostics Tale',
    description: '',
    startLocation: 'room',
    initialVariables: {},
    initialMemory: {},
    createdAt: '',
    updatedAt: '',
    assets: [sampleAsset('Lantern.glb'), sampleAsset('forest_bg.jpg')],
    characters: [],
    fragments: [{
      uid: 'f1',
      title: 'Room',
      locationId: 'room',
      priority: 0,
      conditions: [],
      effects: [],
      text: 'A room.',
      choices: [],
      backgroundImage: 'forest_bg.jpg',
      stageAuthoring: {
        objects: [{
          uid: 'obj1',
          asset: 'Lantern.glb',
          x: 0.5,
          y: 0.5,
          layer: 'props',
        }],
      },
      adventure: {
        entry: { default: { x: 0.2, y: 0.8 } },
        interactables: [],
      },
    }],
    ...overrides,
  };
}

describe('foundation hardening phase 6 — diagnostics', () => {
  test('typed engine errors include recovery metadata', () => {
    const diagnostic = createEngineDiagnostic({
      code: 'ASSET_NOT_FOUND',
      subsystem: 'asset',
      message: 'Background "forest_bg.jpg" is not in the asset library.',
      relatedIds: { assetNames: ['forest_bg.jpg'] },
    });

    expect(diagnostic.code).toBe('ASSET_NOT_FOUND');
    expect(diagnostic.recoveryCategory).toBe('manual-fix');
    expect(diagnostic.recoveryHint).toMatch(/Re-import/);

    const error = new EngineError(diagnostic);
    expect(error.diagnostic).toBe(diagnostic);
    expect(error.message).toBe(diagnostic.message);
  });

  test('buildDiagnosticReport aggregates errors warnings and affected ids', () => {
    const report = buildDiagnosticReport([
      createEngineDiagnostic({
        code: 'ASSET_NOT_FOUND',
        subsystem: 'asset',
        message: 'Missing lantern sprite.',
        relatedIds: { assetNames: ['Lantern.glb'] },
      }),
      createEngineDiagnostic({
        code: 'SCENE_NOT_FOUND',
        subsystem: 'scene',
        severity: 'warning',
        message: 'Optional scene reference is stale.',
        recoveryCategory: 'auto-recovered',
        relatedIds: { fragmentUids: ['f1'] },
      }),
    ]);

    expect(report.ok).toBe(false);
    expect(report.errors).toHaveLength(1);
    expect(report.warnings).toHaveLength(1);
    expect(report.affectedAssets).toContain('Lantern.glb');
    expect(report.affectedScenes).toContain('f1');
    expect(report.recoverySuggestions.length).toBeGreaterThan(0);
  });

  test('runtime action failures are classified without throwing', () => {
    const diagnostic = diagnoseRuntimeActionFailure(
      new RuntimeInvariantError('Choice "c1" has no compiled action in this game.'),
      { choiceUid: 'c1', fragmentUids: ['f1'] },
    );

    expect(diagnostic.code).toBe('INTERACTION_FAILED');
    expect(diagnostic.recoveryCategory).toBe('auto-recovered');
  });

  test('player host converts runtime invariant failures into structured warnings', () => {
    const project = makeProject();
    const compiled = compileProject(project);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    const host = PlayerHost.create(compiled.game);
    host.startNew();
    const state = host.snapshot().state;
    expect(state).not.toBeNull();
    host.setRuntimeState({ ...state!, dialogueLineIndex: -1 });

    const result = host.advanceDialogue();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(host.snapshot().runtimeWarnings.length).toBeGreaterThan(0);
  });

  test('failed editor transactions produce diagnostic reports after rollback', () => {
    const project = makeProject();
    const asset = project.assets.find(entry => entry.name === 'Lantern.glb')!;
    const result = runEditorTransaction(project, deleteAssetMutation(asset.id));

    expect(result.ok).toBe(false);
    expect(result.status).toBe('failed');
    expect(result.diagnosticReport).not.toBeNull();
    expect(result.diagnosticReport!.ok).toBe(false);
    expect(result.diagnosticReport!.errors.some(item => item.code === 'FAILED_TRANSACTION')).toBe(true);
    expect(result.diagnosticReport!.recoverySuggestions.some(item => /Validation blocked|rolled back/i.test(item))).toBe(true);

    const report = buildEditorTransactionFailureReport(result);
    expect(report.summary).toMatch(/Cannot delete|referenced/i);
  });

  test('package compatibility diagnostics describe unsupported adventure runtime', () => {
    const project = makeProject();
    const compatibility = checkPackageCompatibility(
      { schemaVersion: project.schemaVersion, project },
      NARRATIVE_ONLY_RUNTIME_CAPABILITIES,
    );

    const report = buildPackageCompatibilityReport(compatibility, 'Harbor Lantern');
    expect(compatibility.compatible).toBe(false);
    expect(report.ok).toBe(false);
    expect(report.errors.some(item =>
      item.code === 'PACKAGE_INCOMPATIBLE' &&
      item.message.includes('Adventure Runtime') &&
      item.message.includes('Harbor Lantern'),
    )).toBe(true);
    expect(report.recoverySuggestions.some(item => /Chronica Player/i.test(item))).toBe(true);
  });

  test('package import failures produce structured diagnostics', () => {
    const report = buildPackageImportReport({
      ok: false,
      reason: 'missing-manifest',
      error: 'Package missing manifest.json.',
    }, 'Harbor Lantern');

    expect(report.ok).toBe(false);
    expect(report.errors[0]?.code).toBe('IMPORT_FAILED');
    expect(report.errors[0]?.message).toContain('Harbor Lantern');
    expect(report.errors[0]?.recoveryCategory).toBe('cannot-continue');
  });

  test('crash snapshot helpers capture engine editor and runtime state', () => {
    const project = makeProject();
    const compiled = compileProject(project);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    const host = PlayerHost.create(compiled.game);
    host.startNew();
    const view = host.snapshot();

    const engineSnapshot = snapshotEngineState({
      project,
      compileOk: true,
      validationErrorCount: 0,
    });
    expect(engineSnapshot.projectId).toBe('p1');
    expect(engineSnapshot.fragmentCount).toBe(1);

    const tx = runEditorTransaction(
      makeProject({
        fragments: [{
          ...makeProject().fragments[0]!,
          backgroundImage: undefined,
          stageAuthoring: { objects: [] },
        }],
      }),
      deleteAssetMutation(sampleAsset('Lantern.glb').id),
    );
    const txSnapshot = snapshotEditorTransaction(tx);
    expect(txSnapshot.transactionId).toBe(tx.transactionId);
    expect(txSnapshot.ok).toBe(true);

    const runtimeSnapshot = snapshotRuntimeState({
      game: compiled.game,
      started: view.started,
      fragment: view.fragment,
      choiceCount: view.visibleChoices.length,
      interactableCount: view.visibleInteractables.length,
      assetWarnings: view.assetWarnings,
      mediaFallbacks: view.mediaFallbacks,
      runtimeWarnings: view.runtimeWarnings,
    });
    expect(runtimeSnapshot.started).toBe(true);
    expect(runtimeSnapshot.fragmentUid).toBe('f1');
  });

  test('logging respects configured minimum level and optional sink', () => {
    const sink = createMemoryLogSink();
    configureEngineLogging({ sink, minLevel: 'info' });
    try {
      engineLog('debug', 'hidden debug');
      engineLog('info', 'visible info', { feature: 'diagnostics' });
      engineLog('error', 'visible error');

      expect(sink.entries.some(entry => entry.level === 'debug')).toBe(false);
      expect(sink.entries.some(entry => entry.level === 'info')).toBe(true);
      expect(sink.entries.some(entry => entry.level === 'error')).toBe(true);
      expect(getEngineLogMinLevel()).toBe('info');
    } finally {
      configureEngineLogging({ sink: null, minLevel: 'warning' });
      sink.clear();
    }
  });

  test('recovery classification covers save and fallback paths', () => {
    expect(fromResumeRejection('stale-content').recoveryCategory).toBe('safe-retry');
    expect(fromResumeRejection('corrupt-state').recoveryCategory).toBe('cannot-continue');
    expect(fromLoadSaveReason('corrupt-save')?.recoveryCategory).toBe('cannot-continue');
    expect(fromRuntimeFallbackWarning({
      code: 'missing-background',
      reference: 'forest_bg.jpg',
      message: 'Background unavailable.',
    }).recoveryCategory).toBe('auto-recovered');
  });

  test('contract and validation converters map to typed engine codes', () => {
    const contract = fromContractDiagnostic({
      domain: 'asset',
      code: 'referenced-asset',
      severity: 'error',
      message: 'Asset is referenced.',
    });
    expect(contract.code).toBe('ASSET_NOT_FOUND');

    const validation = fromValidationError({
      fragmentUid: 'f1',
      fragmentTitle: 'Room',
      type: 'broken-link',
      message: 'Unknown goto target.',
    });
    expect(validation.code).toBe('TRANSITION_TARGET_INVALID');
  });

  test('narrative-only project remains compatible with full mobile runtime profile', () => {
    const project = makeProject({ fragments: [{ ...makeProject().fragments[0]!, adventure: undefined }] });
    const compatibility = checkPackageCompatibility(
      { schemaVersion: project.schemaVersion, project },
      MOBILE_PLAYER_RUNTIME_CAPABILITIES,
    );
    const diagnostics = fromPackageCompatibility(compatibility);
    expect(compatibility.compatible).toBe(true);
    expect(diagnostics.filter(item => item.severity === 'error')).toHaveLength(0);
  });
});
