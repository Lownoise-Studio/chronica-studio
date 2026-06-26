/** Failure reasons a player action can resolve to — both expected content states
 *  (no-destination authoring mistakes) and unexpected runtime failures. */
export type PlayerFailureReason =
  | 'not-started'
  | 'dead-end'
  | 'action-failed'
  | 'asset-missing'
  | 'runtime-invariant'
  | 'save-corrupt'
  | 'package-invalid';

export type PlayerActionResult =
  | { ok: true }
  | { ok: false; reason: PlayerFailureReason; message?: string };

export type PlayerAdvanceDialogueResult =
  | { ok: true; advanced: boolean }
  | { ok: false; reason: PlayerFailureReason; message?: string };

export type AssetWarningField = 'backgroundImage' | 'backgroundAudio' | 'portrait';

/** A presentation-layer asset problem — gameplay continues, the asset is just omitted. */
export type AssetWarning = {
  field: AssetWarningField;
  reference: string;
  message: string;
};

export type RuntimeWarningCode = 'action-failed' | 'runtime-invariant';

/** A contained runtime failure surfaced for visibility — never a raw exception. */
export type RuntimeWarning = {
  code: RuntimeWarningCode;
  message: string;
};
