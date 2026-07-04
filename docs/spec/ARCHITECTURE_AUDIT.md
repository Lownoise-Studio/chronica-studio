# Foundation Audit Phase 1: Architecture Consistency Report

**Date baseline:** Foundation Hardening Phases 1–6 complete, Foundation Audit P0 + **P1 complete**, 741+ tests passing.

**Scope:** Read-only architecture review with targeted, behavior-preserving cleanup. No gameplay, schema, or large refactors.

This document is the baseline before major editor features.

---

## Executive summary

Chronica’s foundation layer is **functionally sound** but **internally layered**: validation, contracts, diagnostics, and transactions coexist as parallel systems with intentional overlap. Runtime behavior and compile gates are stable. The main debt is **inconsistent adoption** — engine helpers exist for transactions and typed diagnostics, but most UI paths still use direct context mutations and legacy `ValidationError[]` strings.

**Low-risk fixes applied in this audit** (see §10) preserve runtime behavior.

---

## 1. Validation path audit

### Entry-point map

| Layer | Module | Role | Uses `validation-severity.ts`? |
|-------|--------|------|-------------------------------|
| Compile gate | `compiler/compile-project.ts` | Blocks play/export | Yes (`collectCompileValidation`, `filterCompileBlockers`) |
| Core validator | `validator.ts` | Fragment/project structural checks | No |
| Adventure | `adventure-validation.ts` | Adventure invariants | No |
| Asset refs | `asset-reference-safety.ts` | Broad missing-ref scan | No |
| Model assets | `model-assets.ts` | Duplicate ids, preview refs | No |
| Integrity report | `project-integrity.ts` | Editor asset screen panel | Yes — via `aggregateProjectValidation` |
| Integrity UI | `editor-integrity-panel.ts` | Grouped editor sections | Yes (`resolveValidationSeverity`, `strictValidation` option) |
| Contracts | `*-contracts.ts` | Typed contract diagnostics | Uses `contract-types.ts` instead |
| Package structure | `chronica-package.ts` | ZIP/manifest/story validation | No |
| Package features | `package-compatibility.ts` | Foundation feature matrix | No |
| Compat ingest | `compat/package/validate.ts` | Manifest runtime-target grading | No (parallel to above) |
| Post-compile | `analyze-warnings.ts` | Semantic warnings (dead-ends) | No — always `severity: warning` |

### Duplicate / overlapping validation

| Concern | Overlapping modules | Notes |
|---------|---------------------|-------|
| Missing asset refs | `findMissingAssetRefs`, `findMissingAssetReferences`, `validateProjectAssets`, `validateFragmentStageActors`, `adventure-validation` | Different URI requirements; preview-id severity differs (error vs warning) |
| Broken transitions | `validateProjectActions`, `adventure-validation` (interactables), `findBrokenLinks` (deprecated) | Choices/hotspots vs adventure goto |
| Duplicate interactable uids | `adventure-validation` (per-scene), `validation-severity` (cross-scene) | Cross-scene only in strict compile + integrity |
| Duplicate asset ids | `model-assets`, `asset-contracts`, `project-integrity` | Same underlying helper in contracts |
| Dangling references | `asset-contracts`, `project-integrity` | Contracts add name-map pass |

### Severity inconsistencies (documented, not all fixed)

1. **Four severity vocabularies:** `ValidationError.severity/level`, `ValidationSeverity` (`blocking`), `ContractSeverity`, `EngineDiagnostic.severity` (+ `fatal`), `IntegritySeverity`.
2. ~~**Compile vs integrity panel:** `compileProject` skips adventure checks unless `strictValidation`; integrity now shares `aggregateProjectValidation` — pass `{ strictValidation: true }` for export parity.~~ **Fixed in P1.**
3. **Preview image id:** blocking in `validateProjectAssets`, warning in `findMissingAssetReferences`.
4. **URI requirement:** `findMissingAssetRefs` requires loadable `uri`; `findMissingAssetReferences` matches by name/id without uri.
5. ~~**`editor-integrity-panel`** calls `resolveValidationSeverity` without `strictValidation` — optional asset downgrade differs from strict export.~~ **Fixed in P1** — optional `strictValidation` on grouping helpers.

### Recommendations (deferred)

- Route all missing-asset scans through `findMissingAssetReferences` + single severity policy.
- Pass `strictValidation` consistently into integrity panel when mirroring export behavior.
- Deprecate `findBrokenLinks` publicly (already marked deprecated in `validator.ts`).
- Do **not** merge package validators (`chronica-package` vs `package-compatibility` vs `compat/package/validate`) without ingest regression suite — they guard different layers.

---

## 2. Diagnostics integration audit

### Production adoption

| Subsystem | Typed diagnostics | Legacy path |
|-----------|--------------------|-------------|
| Editor transactions (failures) | `diagnosticReport` via `editor-transactions.ts` | — |
| Runtime actions | `diagnoseRuntimeActionFailure` in `player-host.ts` | `RuntimeInvariantError` throws internally |
| Asset delete UI | `executeSafeAssetDelete` → report summary | — |
| Batch import | `buildBatchImportFailureReport` | — |
| Integrity scan | `buildIntegrityScanReport` | — |
| Strict compile preview | `buildStrictCompilePreviewReport` | — |
| Runtime contract audit | `buildRuntimeContractAuditReport` | — |
| Compile | — | `ValidationError[]` (gate unchanged) |
| Package import/export | `buildPackageImportReport` / `buildExportFailureReport` in export UI | — |
| Compatibility | — | `PackageCompatibilityResult` strings |
| Integrity panel | `buildIntegrityScanReport` + legacy `IntegrityIssue[]` | — |
| Recipe / room apply | `formatDiagnosticReportMessage` on transaction failures | — |
| Save/load | — | `resumeRejectionMessage`, `loadSaveFailureMessage` |

### Uncategorized failures (still raw `Error`)

- `asset-recipes.ts` — `applyAssetRecipe`
- `playable-room-generator.ts` — `generatePlayableRoomFromAssets`
- `gameplay-components.ts`, `gameplay-templates.ts` — catalog inserts
- `compiler/build-compiled-game.ts` — internal (gated by compile)
- `storage/fileSystem.ts`, `storage/zip-store.ts` — infra boundary

### `EngineError` usage

Class exists; **not yet thrown** in production paths. Converters (`fromValidationError`, `fromPackageImportFailure`, etc.) are the integration surface.

### Recommendations (deferred)

1. Call `fromResumeRejection` / `fromLoadSaveReason` in play/load screens (message parity, richer recovery hints).
2. Wire save/load and compatibility blockers through typed reports where alerts still use raw strings.

---

## 3. Transaction coverage audit

### Wired

| Path | Mechanism |
|------|-----------|
| Safe asset delete | `executeSafeAssetDelete` → `replaceProjectSnapshot` |
| Recipe apply | `executeApplyRecipeTransaction` → `replaceProjectSnapshot` |
| Room generate | `executeGenerateRoomTransaction` → `replaceProjectSnapshot` |
| Batch asset import | `executeBatchAssetImportTransaction` → `replaceProjectSnapshot` |

### Bypassing transactions (UI → `ProjectsContext.persist`)

| Area | Calls | Risk |
|------|-------|------|
| Single preview asset | `addAsset` | Low — single asset |
| Fragment editor | `updateFragment`, gameplay inserts | Medium |
| Stage composer | direct `moveStageObject` + `updateFragment` | Low (single-field) |
| Settings/characters/gameplay | `updateProject` | Low |

### Context API

- `deleteAsset` — **deprecated** in favor of safe delete; zero call sites after assets.tsx migration.
- `replaceProjectSnapshot` — commit helper for future transaction wiring.

### Recommendations (deferred, priority order)

1. Recipe + room sheets → mutation + `replaceProjectSnapshot` (matches delete pattern).
2. Batch import → `addAssetsBatchMutation` + `runEditorTransactionBatch`.
3. Stage moves → `moveStageObjectMutation` when multi-edit undo is needed.
4. Do **not** wrap low-churn `updateProject` settings fields until undo UI exists.

---

## 4. Contract coverage audit

| Contract module | Production use | Test-only |
|-----------------|----------------|-----------|
| `asset-contracts.ts` | Post-mutation `defaultVerify` in editor mutations | Rename impact (unwired) |
| `recipe-contracts.ts` | `findExistingRecipeObjects` in recipe planning | `validateRecipeIdempotency` |
| `runtime-contracts.ts` | `PlayerHost.auditRuntimeContracts()` (non-blocking) | Full validator + audit report |
| `package-contracts.ts` | Internal normalize helpers | Stability / round-trip |
| `room-generator-contracts.ts` | — | Determinism checks |

**No new contracts invented.** Existing contracts correctly scope to validation/reporting.

### Recommendations (deferred)

- Wire `validateRecipeIdempotency` at apply boundary when recipes use transactions.

---

## 5. Naming consistency

| Term pair | Model layer | UX / diagnostics layer |
|-----------|-------------|------------------------|
| **fragment** vs **scene** | `Fragment`, `fragment.uid`, routes `/fragment/` | `SceneHotspot`, `getSceneOptions`, `SCENE_NOT_FOUND`, `affectedScenes` |
| **room** vs **stage** | `playable-room-generator`, `SceneAdventure` | `StageObject`, `stageAuthoring`, `stage-actors` |
| **object** vs **interactable** vs **hotspot** | `StageObject` (editor) | `AdventureInteractable` (runtime), `SceneHotspot` (narrative taps) |

**Homonyms resolved in this audit:**

- `snapshotRuntimeState` in `diagnostics.ts` → **`snapshotRuntimeDiagnosticContext`** (deprecated alias kept).
- `deterministic-simulation.snapshotRuntimeState` — unchanged (replay snapshots).

**Deferred renames:** `inferProjectCapabilities` (compat) vs `deriveProjectCapabilities` (foundation) — document only; different return shapes.

---

## 6. Dead code audit

### Removed (proven unused, no behavior change)

| Symbol | File |
|--------|------|
| `projectIntegrityScans` | `project-integrity.ts` |
| Export removed → file-private | `normalizeDialogueLines`, `getOutgoingEdges`, `getAdventure`, `hasAdventure`, `stripStageAuthoringFromFragment` |

### Retained (documented unused / future wiring)

| Symbol | Reason kept |
|--------|-------------|
| `validateAssetRenameImpact` | Documented; rename mutation exists |
| `buildEditorIntegrityGroups` | Test coverage; future editor panel |
| `getActiveFragment` | Deprecated; compat reference |
| `deleteAsset` (context) | Deprecated; backward compat |

### Duplicated utilities (deferred)

- `findAssetRecord` in `asset-reference-safety.ts` vs private copy in `asset-resolver.ts` — consolidate only with resolver regression tests.

---

## 7. Public API review

### Barrel (`engine/index.ts`)

Exports **runtime core** (~21 modules). Foundation modules (~35 files) are **intentionally deep-import only**:

`diagnostics`, `editor-transactions`, `editor-mutations`, `asset-recipes`, `playable-room-generator`, `package-compatibility`, `validation-severity`, etc.

### Observations

- App code almost exclusively uses `@/engine/<module>` paths — barrel is thin.
- `contractError` / `contractWarning` exported from `contract-types.ts` — internal to contract validators; acceptable.
- Accidental wide export surface is low; main risk is **deprecated** `deleteAsset` and **deprecated** `findBrokenLinks`.

### Recommendations (deferred)

- Add `engine/foundation.ts` re-export barrel when editor features adopt transactions/diagnostics widely.
- Mark `findBrokenLinks` `@deprecated` in barrel docs (already deprecated in source).

---

## 8. Documentation audit

| Doc | Status | Action taken |
|-----|--------|--------------|
| `ENGINE_CONTRACTS.md` | Accurate module paths | Cross-link to this audit |
| `FOUNDATION_HARDENING.md` | Phases 1–6 accurate | Added Audit Phase 1 section |
| `DIAGNOSTICS.md` | Missing `RUNTIME_ACTION_FAILED` | Updated error code list + snapshot naming |
| `ASSET_SPEC.md` | Missing module paths for phases 3–5 | Added engine module references |
| **New:** `ARCHITECTURE_AUDIT.md` | — | This report |

**Correction noted:** `buildChronicaPackageBytes` lives in `storage/chronica-package-io.ts`, not `engine/`.

---

## 9. Tests

Regression tests added in `__tests__/foundation-audit-phase1.test.ts` for:

- `fromValidationError` respects `validation-severity` ladder (warnings not promoted to errors)
- `project-integrity` `toSeverity` respects `error.level`

Existing 726 tests must continue to pass.

---

## 10. Low-risk fixes applied

| Fix | File | Behavior impact |
|-----|------|-----------------|
| `fromValidationError` uses `resolveValidationSeverity` | `diagnostics.ts` | Diagnostics only — compile/play unchanged |
| `toSeverity` respects `resolveValidationSeverity` | `project-integrity.ts` | Integrity panel grouping only |
| Shared validation aggregation | `project-validation.ts` | Integrity + strict preview parity with compile |
| Batch import diagnostics | `buildBatchImportFailureReport` | Import UI alerts only |
| Runtime contract audit | `buildRuntimeContractAuditReport` | Non-blocking diagnostics only |
| Rename + deprecate runtime snapshot helper | `diagnostics.ts` | Alias preserves old import |
| Deprecate `deleteAsset` in context | `ProjectsContext.tsx` | API annotation only |
| Remove unused exports / dead re-export bag | See §6 | None — symbols were unreferenced |

---

## 11. Remaining technical debt (prioritized)

### P0 — Before major editor features

1. ~~Atomic recipe + room apply via transactions.~~ **Done** — `executeApplyRecipeTransaction`, `executeGenerateRoomTransaction`, `replaceProjectSnapshot`.
2. ~~Diagnostics bridges in import/export/play alerts.~~ **Done** — recipe/room sheets, export compile/package/import use `formatDiagnosticReportMessage`.
3. ~~Unified missing-asset severity policy.~~ **Done** — `applyMissingAssetSeverity` / `buildMissingAssetIssue`; `validateProject` uses `findMissingAssetReferences` once; integrity panel uses `resolveValidationSeverity`.

### P1 — Quality / maintainability

4. ~~Integrity panel strict-mode parity with export.~~ **Done** — `aggregateProjectValidation`, `buildEditorIntegrityGroups({ strictValidation })`, `buildStrictCompilePreviewReport`.
5. ~~Batch asset import transaction.~~ **Done** — `executeBatchAssetImportTransaction`, assets screen wired via `replaceProjectSnapshot`.
6. ~~Runtime contract audit hook (non-blocking).~~ **Done** — `buildRuntimeContractAuditReport`, `PlayerHost.auditRuntimeContracts`, `useChronicaRuntime.auditRuntimeContracts`.

### P2 — Cleanup

7. Consolidate `findAssetRecord` implementations.
8. Remove deprecated `findBrokenLinks` export after grep confirms zero use.
9. Foundation barrel module for editor consumers.

---

## 12. Duplicate systems summary

```
ValidationError pipeline ──┬── compileProject (gate)
                           ├── aggregateProjectValidation (shared)
                           ├── project-integrity (report)
                           └── analyze-warnings (post-compile)

contract-types pipeline ───┬── *-contracts.ts (phase 4)
                           └── editor-mutations verify

diagnostics.ts ────────────┬── transaction failures
                           ├── runtime action failures
                           └── converters (underused in UI)

Package validation ────────┬── chronica-package.ts (structure)
                           ├── package-compatibility.ts (features)
                           └── compat/package/validate.ts (manifest targets)
```

These duplicates are **intentional layer separation** today. Consolidation requires explicit migration plans and regression tests per layer.

---

## Related documents

- [Foundation Hardening](./FOUNDATION_HARDENING.md)
- [Engine Contracts](./ENGINE_CONTRACTS.md)
- [Editor Transactions](./EDITOR_TRANSACTIONS.md)
- [Diagnostics](./DIAGNOSTICS.md)
- [Asset Specification](./ASSET_SPEC.md)
