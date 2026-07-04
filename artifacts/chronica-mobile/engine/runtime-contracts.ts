import { getPlayerPosition } from './adventure';
import { getActiveFragmentFromIndex } from './compiler/fragment-index';
import type { CompiledGame } from './compiler/types';
import {
  buildContractResult,
  contractError,
  contractWarning,
  type ContractDiagnostic,
  type ContractValidationResult,
} from './contract-types';
import {
  buildDiagnosticReport,
  fromContractDiagnostic,
  type DiagnosticReport,
} from './diagnostics';
import type { ChronicaState, Fragment } from './types';

export type RuntimeHistoryEntry = { locationId: string; title: string };

export interface RuntimeContractContext {
  game: CompiledGame;
  started: boolean;
  state: ChronicaState | null;
  fragment: Fragment | null;
  visibleChoiceUids: readonly string[];
  visibleHotspotUids: readonly string[];
  visibleInteractableUids: readonly string[];
  history: readonly RuntimeHistoryEntry[];
}

function isNormalizedCoord(value: number | undefined): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

/** Verify runtime invariants after initialization, transitions, or interaction commits. */
export function validateRuntimeContracts(context: RuntimeContractContext): ContractValidationResult {
  const diagnostics: ContractDiagnostic[] = [];
  const { game, started, state, fragment, history } = context;

  if (!started) {
    if (state !== null) {
      diagnostics.push(contractWarning('runtime', 'pre-start-state', 'Runtime state exists before start() completed.'));
    }
    return buildContractResult(diagnostics);
  }

  if (!state) {
    diagnostics.push(contractError('runtime', 'missing-state', 'Started runtime must have ChronicaState.'));
    return buildContractResult(diagnostics);
  }

  if (!fragment) {
    diagnostics.push(contractError('runtime', 'missing-fragment', 'Started runtime must have an active fragment.'));
    return buildContractResult(diagnostics);
  }

  if (state.location !== fragment.locationId) {
    diagnostics.push(contractError(
      'runtime',
      'location-mismatch',
      `State location "${state.location}" does not match active fragment "${fragment.locationId}".`,
      'state.location',
    ));
  }

  try {
    const resolved = getActiveFragmentFromIndex(state.location, state, game.fragmentIndex);
    if (resolved && resolved.uid !== fragment.uid) {
      diagnostics.push(contractError(
        'runtime',
        'fragment-index-mismatch',
        `Active fragment uid "${fragment.uid}" does not match fragment index resolution "${resolved.uid}".`,
      ));
    }
  } catch {
    diagnostics.push(contractError(
      'runtime',
      'unresolved-fragment',
      `Fragment index cannot resolve location "${state.location}".`,
    ));
  }

  if (fragment.adventure) {
    const position = getPlayerPosition(state);
    if (!isNormalizedCoord(position.x) || !isNormalizedCoord(position.y)) {
      diagnostics.push(contractError(
        'runtime',
        'invalid-player-position',
        'Player position must remain inside normalized 0–1 room coordinates.',
        'state.playerX/state.playerY',
      ));
    }
  }

  for (const uid of context.visibleChoiceUids) {
    if (!(uid in game.choiceActions)) {
      diagnostics.push(contractError('runtime', 'orphan-choice', `Visible choice "${uid}" has no compiled action.`, uid));
    }
    if (!fragment.choices.some(choice => choice.uid === uid)) {
      diagnostics.push(contractError('runtime', 'foreign-choice', `Visible choice "${uid}" does not belong to the active fragment.`, uid));
    }
  }

  for (const uid of context.visibleHotspotUids) {
    if (!(uid in game.hotspotActions)) {
      diagnostics.push(contractError('runtime', 'orphan-hotspot', `Visible hotspot "${uid}" has no compiled action.`, uid));
    }
    if (!(fragment.hotspots ?? []).some(hotspot => hotspot.uid === uid)) {
      diagnostics.push(contractError('runtime', 'foreign-hotspot', `Visible hotspot "${uid}" does not belong to the active fragment.`, uid));
    }
  }

  for (const uid of context.visibleInteractableUids) {
    if (!(uid in game.interactableActions)) {
      diagnostics.push(contractError('runtime', 'orphan-interactable', `Visible interactable "${uid}" has no compiled action.`, uid));
    }
    if (!(fragment.adventure?.interactables ?? []).some(item => item.uid === uid)) {
      diagnostics.push(contractError('runtime', 'foreign-interactable', `Visible interactable "${uid}" does not belong to the active fragment.`, uid));
    }
  }

  if (history.length > 0) {
    const latest = history[history.length - 1];
    if (latest.locationId !== fragment.locationId) {
      diagnostics.push(contractWarning(
        'runtime',
        'history-location-drift',
        `History tail "${latest.locationId}" differs from active fragment "${fragment.locationId}" during in-scene interaction.`,
      ));
    }
  }


  return buildContractResult(diagnostics);
}

/** Optional non-blocking runtime contract audit as typed diagnostics. */
export function buildRuntimeContractAuditReport(context: RuntimeContractContext): DiagnosticReport {
  const result = validateRuntimeContracts(context);
  return buildDiagnosticReport(result.diagnostics.map(item =>
    fromContractDiagnostic(item, {
      subsystem: 'runtime',
      code: item.severity === 'error' ? 'RUNTIME_INVARIANT_VIOLATION' : undefined,
      recoveryCategory: 'auto-recovered',
      recoveryHint: 'Runtime contract diagnostics are informational and do not block play.',
      developerDetails: `runtime-contract:${item.code}`,
    }),
  ));
}
