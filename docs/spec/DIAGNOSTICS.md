# Engine Diagnostics

Foundation Hardening Phase 6 introduces a unified diagnostics system so every engine failure answers:

- **What failed?**
- **Where did it fail?**
- **Why did it fail?**
- **What can safely recover?**
- **What must the user fix?**

No uncategorized errors should escape engine boundaries.

---

## Core modules

| Module | Purpose |
|--------|---------|
| `engine/diagnostics.ts` | Typed errors, reports, snapshots, converters |
| `engine/engine-logging.ts` | Optional structured logging |

Related boundaries:

- `runtime/player-host.ts` — catches runtime exceptions and classifies them
- `engine/editor-transactions.ts` — attaches `diagnosticReport` on failed transactions

---

## Engine error model

Each failure is an `EngineDiagnostic`:

```typescript
{
  code: EngineErrorCode;
  severity: 'info' | 'warning' | 'error' | 'fatal';
  subsystem: 'asset' | 'scene' | 'runtime' | 'package' | ...;
  message: string;
  developerDetails?: string;
  recoveryHint: string;
  recoveryCategory: RecoveryCategory;
  relatedIds?: { assetIds?, fragmentUids?, transactionId?, ... };
  path?: string;
}
```

### Canonical error codes

| Code | Typical cause |
|------|----------------|
| `ASSET_NOT_FOUND` | Missing library entry or unresolved reference |
| `SCENE_NOT_FOUND` | Missing fragment or stage object |
| `TRANSITION_TARGET_INVALID` | Broken goto / dead-end transition |
| `PACKAGE_INCOMPATIBLE` | Required runtime feature unsupported |
| `INVALID_PROJECT_STATE` | Project fails structural validation |
| `INVALID_RUNTIME_STATE` | Save/resume state inconsistent |
| `FAILED_TRANSACTION` | Editor mutation blocked or rolled back |
| `VALIDATION_FAILED` | Compile/contract validation error |
| `IMPORT_FAILED` | Package import rejected |
| `EXPORT_FAILED` | Package export blocked |
| `SAVE_CORRUPT` | Unreadable save payload |
| `SAVE_STALE` | Save predates project edits |
| `RUNTIME_INVARIANT_VIOLATION` | Stale choice/hotspot/dialogue reference |
| `RUNTIME_ACTION_FAILED` | Generic player action failure |
| `INTERACTION_FAILED` | Interactable/hotspot action could not run |
| `MISSING_MEDIA` | Media skipped with runtime fallback |

Throw typed errors with `EngineError` when code must abort with a structured payload.

---

## Recovery categories

Every diagnostic includes a **recovery classification** — reporting only, no automatic repair.

| Category | Meaning |
|----------|---------|
| `auto-recovered` | Engine applied a safe fallback; gameplay/editor may continue |
| `safe-retry` | User can retry after a transient or environmental issue |
| `manual-fix` | User must change project content or editor input |
| `project-repair-recommended` | Compile/integrity issues should be resolved in the editor |
| `cannot-continue` | Import/play/resume cannot proceed until environment changes |

---

## Diagnostic reports

`buildDiagnosticReport(diagnostics)` returns an editor-ready aggregate:

```typescript
{
  summary: string;
  errors: EngineDiagnostic[];
  warnings: EngineDiagnostic[];
  recoverySuggestions: string[];
  affectedAssets: string[];
  affectedScenes: string[];
  affectedPackageData: string[];
  ok: boolean;
}
```

Specialized builders:

- `buildEditorTransactionFailureReport(result)`
- `buildBatchImportFailureReport(result)`
- `buildIntegrityScanReport(project, options?)`
- `buildStrictCompilePreviewReport(project)`
- `buildRuntimeContractAuditReport(context)` (via `runtime-contracts.ts`)
- `buildPackageImportReport(result, packageTitle?)`
- `buildPackageCompatibilityReport(result, packageTitle?)`
- `buildExportFailureReport(result)`
- `fromCompileFailure(diagnostics, warnings?)`

---

## Runtime error boundaries

`PlayerHost` is the runtime safety shell. Methods that can throw (`choose`, `activateHotspot`, `activateInteractable`, `advanceDialogue`) are wrapped and converted via `diagnoseRuntimeActionFailure`.

Media gaps use existing fallbacks in `runtime-fallbacks.ts`, converted to diagnostics with `fromRuntimeFallbackWarning`.

Save/resume paths:

- `fromResumeRejection(reason)`
- `fromLoadSaveReason(reason)`

Gameplay continues where safe; structured warnings appear in snapshots instead of uncaught exceptions.

---

## Transaction failure reports

Failed editor transactions follow:

```
Validate → Failure → Rollback → Diagnostic Report
```

`EditorTransactionResult.diagnosticReport` is populated whenever `ok === false`.

Never fail silently — validation blockers and rollback verify errors both produce reports.

---

## Package import diagnostics

Instead of a generic “Import failed”, use:

```typescript
buildPackageImportReport(result, 'Harbor Lantern')
```

Incompatible adventure packages produce messages like:

```
Unsupported feature: Adventure Runtime
Required by: Harbor Lantern
Suggested recovery: Open with Chronica Player that supports adventure runtime and schema v3 content.
```

Powered by `fromPackageCompatibility` + `checkPackageCompatibility`.

---

## Crash snapshot foundation

Local-only helpers for future bug reports — **no telemetry, uploads, or analytics**.

| Helper | Captures |
|--------|----------|
| `snapshotEngineState({ project, compileOk, ... })` | Project id, schema, counts |
| `snapshotEditorTransaction(result)` | Transaction id, status, diagnostic summary |
| `snapshotRuntimeDiagnosticContext({ game, fragment, warnings, ... })` | Active scene, warning counts |

`deterministic-simulation.snapshotRuntimeState` is a separate helper for replay snapshots — do not confuse the two. A deprecated alias `snapshotRuntimeState` remains on the diagnostics helper for backward compatibility.

Snapshots are JSON-serializable structs suitable for manual export from a future debug panel.

---

## Logging layer

`engine/engine-logging.ts` provides optional structured logging.

Levels: `trace` | `debug` | `info` | `warning` | `error` | `fatal`

```typescript
configureEngineLogging({ sink: mySink, minLevel: 'warning' });
engineLog('error', 'Package import blocked', { reason: 'missing-manifest' });
```

Default: **no sink**, minimum level `warning` — zero console spam unless explicitly configured.

Use `createMemoryLogSink()` in tests.

---

## Extension guidelines

1. **Never throw raw strings** across engine boundaries — use `EngineError` or structured result types.
2. **Always assign** `code`, `subsystem`, and `recoveryCategory`.
3. **Convert legacy diagnostics** through `fromContractDiagnostic` / `fromValidationError` instead of duplicating messages.
4. **Do not auto-repair** — classify recovery and let the editor/player surface hints.
5. **Log at boundaries** with `engineLog` when a sink is configured; keep messages concise.

---

## Future crash reporting integration

Phase 6 prepares snapshots and typed reports only. A future debug/export flow could:

1. Collect `snapshotEngineState` + `snapshotRuntimeState` on failure
2. Attach the latest `diagnosticReport`
3. Let the user copy/share locally

No network pipeline is included in this phase.

---

## Tests

`__tests__/foundation-hardening-phase6.test.ts`

---

## Related docs

- [Editor Transactions](./EDITOR_TRANSACTIONS.md)
- [Foundation Hardening](./FOUNDATION_HARDENING.md)
- [Engine Contracts](./ENGINE_CONTRACTS.md)
