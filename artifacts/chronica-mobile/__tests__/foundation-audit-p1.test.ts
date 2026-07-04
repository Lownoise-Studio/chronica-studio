import { compileProject } from '../engine/compiler';
import {
  executeBatchAssetImportTransaction,
} from '../engine/editor-mutations';
import {
  buildBatchImportFailureReport,
  buildIntegrityScanReport,
  buildStrictCompilePreviewReport,
} from '../engine/diagnostics';
import { buildEditorIntegrityGroups } from '../engine/editor-integrity-panel';
import {
  aggregateProjectValidation,
  wouldStrictCompileBlock,
} from '../engine/project-validation';
import { buildRuntimeContractAuditReport } from '../engine/runtime-contracts';
import {
  collectCompileValidation,
  filterCompileBlockers,
} from '../engine/validation-severity';
import { PlayerHost } from '../runtime/player-host';
import type { Fragment, Project, ProjectAsset } from '../engine/types';

function sampleAsset(name: string, id?: string): ProjectAsset {
  return {
    id: id ?? `asset-${name}`,
    name,
    type: 'image',
    uri: `file:///device/${name}`,
    mimeType: 'image/png',
    size: 1024,
    importedAt: '',
  };
}

function frag(partial: Partial<Fragment> & Pick<Fragment, 'uid' | 'locationId'>): Fragment {
  return {
    title: partial.locationId,
    priority: 0,
    conditions: [],
    effects: [],
    text: 'Scene',
    choices: [],
    ...partial,
  };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    schemaVersion: 3,
    gameId: 'a0000001-0000-4000-8000-000000000099',
    id: 'p1',
    title: 'P1 Tale',
    description: '',
    startLocation: 'room',
    initialVariables: {},
    initialMemory: {},
    createdAt: '',
    updatedAt: '',
    assets: [],
    characters: [],
    fragments: [frag({ uid: 'f1', locationId: 'room' })],
    ...overrides,
  };
}

describe('foundation audit P1 follow-up', () => {
  test('strict integrity preview matches compile/export blockers', () => {
    const project = makeProject({
      fragments: [frag({
        uid: 'f1',
        locationId: 'room',
        adventure: {
          entry: { default: { x: 2, y: 2 } },
          interactables: [],
        },
      })],
    });

    const compileBlockers = filterCompileBlockers(
      collectCompileValidation(project, { strictValidation: true }),
      { strictValidation: true },
    );
    const aggregate = aggregateProjectValidation(project, {
      strictValidation: true,
      includeEditorSupplemental: false,
    });
    const strictPreview = buildStrictCompilePreviewReport(project);
    const strictGroups = buildEditorIntegrityGroups(project, {
      strictValidation: true,
      includeEditorSupplemental: false,
    });

    expect(aggregate.blockers.map(item => item.message)).toEqual(compileBlockers.map(item => item.message));
    expect(strictPreview.errors.map(item => item.message)).toEqual(compileBlockers.map(item => item.message));
    expect(strictGroups.find(group => group.section === 'must-fix-before-export')?.items.length).toBe(compileBlockers.length);
    expect(wouldStrictCompileBlock(project)).toBe(true);
    expect(compileProject(project, { strictValidation: true }).ok).toBe(false);
  });

  test('default integrity scan includes supplemental warnings without strict adventure gate', () => {
    const project = makeProject({
      fragments: [frag({
        uid: 'f1',
        locationId: 'room',
        adventure: {
          entry: { default: { x: 2, y: 2 } },
          interactables: [],
        },
      })],
      inventory: [{
        id: 'lantern',
        label: 'Lantern',
        assetName: 'lantern.png',
        stateKey: 'unused_flag',
        stateKind: 'variable',
      }],
    });

    const defaultAggregate = aggregateProjectValidation(project);
    const strictAggregate = aggregateProjectValidation(project, { strictValidation: true, includeEditorSupplemental: false });

    expect(defaultAggregate.blockers.some(item => item.message.includes('player spawn'))).toBe(false);
    expect(strictAggregate.blockers.some(item => item.message.includes('player spawn'))).toBe(true);
    expect(defaultAggregate.warnings.some(item => item.message.includes('unused_flag'))).toBe(true);

    const scanReport = buildIntegrityScanReport(project);
    expect(scanReport.warnings.some(item => item.message.includes('unused_flag'))).toBe(true);
    expect(scanReport.errors.every(item => typeof item.code === 'string')).toBe(true);
  });

  test('batch asset import commits atomically on success', () => {
    const project = makeProject();
    const incoming = [sampleAsset('a.png', 'new-a'), sampleAsset('b.png', 'new-b')];
    const result = executeBatchAssetImportTransaction(project, incoming);

    expect(result.ok).toBe(true);
    expect(result.after!.assets).toHaveLength(2);
    expect(result.changeSet?.changedAssetIds).toEqual(['new-a', 'new-b']);
  });

  test('batch asset import rolls back on duplicate batch id with one diagnostic report', () => {
    const project = makeProject({ assets: [sampleAsset('existing.png', 'dup-id')] });
    const incoming = [
      sampleAsset('first.png', 'dup-id'),
      sampleAsset('second.png', 'new-id'),
    ];
    const result = executeBatchAssetImportTransaction(project, incoming);

    expect(result.ok).toBe(false);
    expect(result.status).toBe('rolled_back');
    expect(result.after).toBeNull();

    const report = buildBatchImportFailureReport(result);
    expect(report.ok).toBe(false);
    expect(report.errors.length).toBeGreaterThan(0);
    expect(report.errors.every(item => item.subsystem === 'import')).toBe(true);
    expect(report.errors.some(item => item.code === 'IMPORT_FAILED')).toBe(true);
  });

  test('runtime contract audit produces non-blocking diagnostics', () => {
    const project = makeProject({
      fragments: [frag({
        uid: 'f1',
        locationId: 'room',
        adventure: {
          entry: { default: { x: 0.2, y: 0.8 } },
          interactables: [{
            uid: 'door1',
            kind: 'door',
            label: 'Door',
            x: 0.5,
            y: 0.5,
            action: 'goto:missing',
            conditions: [],
          }],
        },
      })],
    });

    const compiled = compileProject(project);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    const host = PlayerHost.create(compiled.game);
    host.startNew();

    const report = host.auditRuntimeContracts();
    expect(report.errors.every(item => item.subsystem === 'runtime')).toBe(true);
    expect(report.ok).toBe(true);

    host.setRuntimeState({
      ...host.runtime.runtimeState!,
      playerX: 2,
      playerY: 2,
    });

    const invalidPositionReport = buildRuntimeContractAuditReport({
      game: compiled.game,
      started: host.runtime.isStarted,
      state: host.runtime.runtimeState,
      fragment: host.runtime.currentFragment,
      visibleChoiceUids: host.runtime.visibleChoices.map(choice => choice.uid),
      visibleHotspotUids: host.runtime.visibleHotspots.map(hotspot => hotspot.uid),
      visibleInteractableUids: host.runtime.visibleInteractables.map(item => item.uid),
      history: host.runtime.pathHistory,
    });

    expect(invalidPositionReport.errors.some(item => item.message.includes('Player position'))).toBe(true);
    expect(invalidPositionReport.errors.some(item => item.code === 'RUNTIME_INVARIANT_VIOLATION')).toBe(true);
  });

  test('shared validation path deduplicates compile and integrity aggregation', () => {
    const project = makeProject({
      fragments: [frag({
        uid: 'f1',
        locationId: 'room',
        choices: [{ uid: 'c1', label: 'Broken', action: 'goto:missing', conditions: [] }],
      })],
    });

    const compileDiagnostics = collectCompileValidation(project);
    const aggregate = aggregateProjectValidation(project, { includeEditorSupplemental: false });
    const compileBlockers = filterCompileBlockers(compileDiagnostics);

    expect(aggregate.blockers.map(item => item.message)).toEqual(compileBlockers.map(item => item.message));
  });
});
