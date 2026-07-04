import {
  buildEditorTransactionFailureReport,
  type DiagnosticReport,
} from './diagnostics';
import { engineLog } from './engine-logging';
import { createId } from './identity';
import {
  contractError,
  type ContractDiagnostic,
} from './contract-types';
import type { Project } from './types';

/** Domains tracked by dirty-state reporting. */
export type EditorChangeDomain =
  | 'assets'
  | 'scenes'
  | 'adventure'
  | 'runtime-metadata'
  | 'package-metadata'
  | 'settings'
  | 'gameplay-catalog';

export interface EditorChangeSet {
  domains: EditorChangeDomain[];
  changedAssetIds: string[];
  changedFragmentUids: string[];
  changedFields: string[];
  summary: string;
}

export interface EditorMutationDefinition {
  kind: string;
  label: string;
  validate(project: Project): ContractDiagnostic[];
  apply(project: Project): Project;
  verify(before: Project, after: Project): ContractDiagnostic[];
  describeChangeSet(before: Project, after: Project): EditorChangeSet;
}

export type EditorTransactionStatus = 'committed' | 'rolled_back' | 'failed';

export interface EditorTransactionResult {
  ok: boolean;
  status: EditorTransactionStatus;
  before: Project;
  after: Project | null;
  changeSet: EditorChangeSet | null;
  diagnostics: ContractDiagnostic[];
  diagnosticReport: DiagnosticReport | null;
  transactionId: string;
  label: string;
}

export function cloneProject(project: Project): Project {
  return JSON.parse(JSON.stringify(project)) as Project;
}

const PROJECT_SETTINGS_KEYS = [
  'title',
  'description',
  'startLocation',
  'schemaVersion',
  'gameId',
] as const;

const GAMEPLAY_CATALOG_KEYS = [
  'inventory',
  'objectives',
  'worldState',
  'gameplayVariables',
  'npcProfiles',
  'characters',
] as const;

const RUNTIME_METADATA_KEYS = [
  'initialVariables',
  'initialMemory',
] as const;

function stableJson(value: unknown): string {
  return JSON.stringify(value);
}

/** Structured diff between two project snapshots for dirty-state tracking. */
export function computeEditorChangeSet(before: Project, after: Project): EditorChangeSet {
  const domains = new Set<EditorChangeDomain>();
  const changedAssetIds = new Set<string>();
  const changedFragmentUids = new Set<string>();
  const changedFields = new Set<string>();

  const beforeAssets = new Map(before.assets.map(asset => [asset.id, asset]));
  const afterAssets = new Map(after.assets.map(asset => [asset.id, asset]));

  for (const [id, asset] of afterAssets) {
    const previous = beforeAssets.get(id);
    if (!previous || stableJson(previous) !== stableJson(asset)) {
      domains.add('assets');
      changedAssetIds.add(id);
    }
  }
  for (const id of beforeAssets.keys()) {
    if (!afterAssets.has(id)) {
      domains.add('assets');
      changedAssetIds.add(id);
    }
  }

  const beforeFragments = new Map(before.fragments.map(fragment => [fragment.uid, fragment]));
  const afterFragments = new Map(after.fragments.map(fragment => [fragment.uid, fragment]));

  for (const [uid, fragment] of afterFragments) {
    const previous = beforeFragments.get(uid);
    if (!previous || stableJson(previous) !== stableJson(fragment)) {
      domains.add('scenes');
      changedFragmentUids.add(uid);
      if (stableJson(previous?.adventure) !== stableJson(fragment.adventure)) {
        domains.add('adventure');
        changedFields.add(`fragments.${uid}.adventure`);
      }
    }
  }
  for (const uid of beforeFragments.keys()) {
    if (!afterFragments.has(uid)) {
      domains.add('scenes');
      changedFragmentUids.add(uid);
    }
  }

  for (const key of PROJECT_SETTINGS_KEYS) {
    if (stableJson(before[key]) !== stableJson(after[key])) {
      domains.add('settings');
      changedFields.add(key);
    }
  }

  for (const key of GAMEPLAY_CATALOG_KEYS) {
    if (stableJson(before[key]) !== stableJson(after[key])) {
      domains.add('gameplay-catalog');
      changedFields.add(key);
    }
  }

  for (const key of RUNTIME_METADATA_KEYS) {
    if (stableJson(before[key]) !== stableJson(after[key])) {
      domains.add('runtime-metadata');
      changedFields.add(key);
    }
  }

  if (before.updatedAt !== after.updatedAt) {
    domains.add('package-metadata');
    changedFields.add('updatedAt');
  }

  const domainList = [...domains];
  const summaryParts: string[] = [];
  if (changedAssetIds.size > 0) summaryParts.push(`${changedAssetIds.size} asset(s)`);
  if (changedFragmentUids.size > 0) summaryParts.push(`${changedFragmentUids.size} scene(s)`);
  if (domainList.includes('gameplay-catalog')) summaryParts.push('gameplay catalog');
  if (domainList.includes('settings')) summaryParts.push('project settings');

  return {
    domains: domainList,
    changedAssetIds: [...changedAssetIds],
    changedFragmentUids: [...changedFragmentUids],
    changedFields: [...changedFields],
    summary: summaryParts.length > 0 ? summaryParts.join(', ') : 'no structural changes',
  };
}

export function mergeChangeSets(...sets: EditorChangeSet[]): EditorChangeSet {
  const domains = new Set<EditorChangeDomain>();
  const changedAssetIds = new Set<string>();
  const changedFragmentUids = new Set<string>();
  const changedFields = new Set<string>();

  for (const set of sets) {
    for (const domain of set.domains) domains.add(domain);
    for (const id of set.changedAssetIds) changedAssetIds.add(id);
    for (const uid of set.changedFragmentUids) changedFragmentUids.add(uid);
    for (const field of set.changedFields) changedFields.add(field);
  }

  const summaryParts: string[] = [];
  if (changedAssetIds.size > 0) summaryParts.push(`${changedAssetIds.size} asset(s)`);
  if (changedFragmentUids.size > 0) summaryParts.push(`${changedFragmentUids.size} scene(s)`);

  return {
    domains: [...domains],
    changedAssetIds: [...changedAssetIds],
    changedFragmentUids: [...changedFragmentUids],
    changedFields: [...changedFields],
    summary: summaryParts.length > 0 ? summaryParts.join(', ') : 'no structural changes',
  };
}

function hasValidationErrors(diagnostics: ContractDiagnostic[]): boolean {
  return diagnostics.some(item => item.severity === 'error');
}

function finalizeTransactionResult(
  result: Omit<EditorTransactionResult, 'diagnosticReport'>,
): EditorTransactionResult {
  const diagnosticReport = result.ok ? null : buildEditorTransactionFailureReport(result);
  if (!result.ok) {
    engineLog('warning', diagnosticReport?.summary ?? result.label, {
      status: result.status,
      transactionId: result.transactionId,
    });
  }
  return { ...result, diagnosticReport };
}

/**
 * Run a single editor transaction or a batched sequence atomically.
 * Lifecycle: Begin → Validate → Apply → Verify → Commit | Rollback.
 */
export function runEditorTransaction(
  project: Project,
  input: EditorMutationDefinition | EditorMutationDefinition[],
  options: { label?: string; transactionId?: string } = {},
): EditorTransactionResult {
  const mutations = Array.isArray(input) ? input : [input];
  const before = cloneProject(project);
  const transactionId = options.transactionId ?? createId();
  const label = options.label ?? mutations.map(mutation => mutation.label).join(' + ');
  const diagnostics: ContractDiagnostic[] = [];

  for (const mutation of mutations) {
    diagnostics.push(...mutation.validate(project));
  }
  if (hasValidationErrors(diagnostics)) {
    return finalizeTransactionResult({
      ok: false,
      status: 'failed',
      before,
      after: null,
      changeSet: null,
      diagnostics,
      transactionId,
      label,
    });
  }

  let working = cloneProject(project);
  try {
    for (const mutation of mutations) {
      const stepBefore = cloneProject(working);
      working = mutation.apply(working);
      diagnostics.push(...mutation.verify(stepBefore, working));
    }
  } catch (error) {
    diagnostics.push(contractError(
      'editor',
      'apply-failed',
      error instanceof Error ? error.message : 'Mutation apply failed',
    ));
    return finalizeTransactionResult({
      ok: false,
      status: 'rolled_back',
      before,
      after: null,
      changeSet: null,
      diagnostics,
      transactionId,
      label,
    });
  }

  if (hasValidationErrors(diagnostics)) {
    return finalizeTransactionResult({
      ok: false,
      status: 'rolled_back',
      before,
      after: null,
      changeSet: null,
      diagnostics,
      transactionId,
      label,
    });
  }

  const changeSet = mergeChangeSets(
    computeEditorChangeSet(before, working),
    ...mutations.map(mutation => mutation.describeChangeSet(before, working)),
  );

  return finalizeTransactionResult({
    ok: true,
    status: 'committed',
    before,
    after: working,
    changeSet,
    diagnostics,
    transactionId,
    label,
  });
}

/** Alias for batched imports and multi-step editor actions. */
export function runEditorTransactionBatch(
  project: Project,
  mutations: EditorMutationDefinition[],
  options: { label?: string; transactionId?: string } = {},
): EditorTransactionResult {
  return runEditorTransaction(project, mutations, options);
}

export function normalizeProjectForCompare(project: Project): Project {
  const copy = cloneProject(project);
  copy.updatedAt = '';
  return copy;
}

export function projectsStructurallyEqual(a: Project, b: Project): boolean {
  return stableJson(normalizeProjectForCompare(a)) === stableJson(normalizeProjectForCompare(b));
}

/** Build a restore mutation from a committed transaction's before snapshot. */
export function createRestoreProjectMutation(
  snapshot: Project,
  undoLabel: string,
): EditorMutationDefinition {
  return {
    kind: 'restore-project',
    label: undoLabel,
    validate: () => [],
    apply: () => cloneProject(snapshot),
    verify: (before, after) => (
      projectsStructurallyEqual(snapshot, after)
        ? []
        : [contractError('editor', 'undo-verify', 'Restore did not reproduce the expected snapshot')]
    ),
    describeChangeSet: (before, after) => computeEditorChangeSet(before, after),
  };
}

export function buildInverseTransaction(
  result: EditorTransactionResult,
): EditorMutationDefinition | null {
  if (!result.ok || !result.after) return null;
  return createRestoreProjectMutation(result.before, `Undo: ${result.label}`);
}

/** Replay the inverse of a committed transaction against the post-commit project. */
export function replayInverseTransaction(
  project: Project,
  result: EditorTransactionResult,
): EditorTransactionResult {
  const inverse = buildInverseTransaction(result);
  if (!inverse) {
    return finalizeTransactionResult({
      ok: false,
      status: 'failed',
      before: cloneProject(project),
      after: null,
      changeSet: null,
      diagnostics: [contractError('editor', 'no-inverse', 'Transaction was not committed — no inverse available')],
      transactionId: result.transactionId,
      label: `Undo: ${result.label}`,
    });
  }
  return runEditorTransaction(project, inverse, {
    label: inverse.label,
    transactionId: `${result.transactionId}-undo`,
  });
}

/** Verify that undo + replay returns to the original project state. */
export function verifyTransactionUndo(
  originalBefore: Project,
  undoResult: EditorTransactionResult,
): boolean {
  if (!undoResult.ok || !undoResult.after) return false;
  return projectsStructurallyEqual(originalBefore, undoResult.after);
}
