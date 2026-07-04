# Foundation Hardening

Chronica Foundation Hardening strengthens editor-time correctness and maintainability **without changing save/package schemas** or auto-modifying projects.

All checks are **non-destructive**: they report issues only. Nothing is deleted or rewritten automatically.

## Runtime invariant checks (adventure scenes)

Module: `engine/adventure-validation.ts`

`validateFragmentAdventure(fragment, project)` and `validateProjectAdventures(project)` verify:

| Check | Severity when failed |
|-------|---------------------|
| Player spawn (`entry.default` with 0–1 coordinates) | **Error** |
| Collider rectangles fit inside 0–1 room space | **Error** |
| Interactable uid present and unique within scene | **Error** |
| Interactable kind is valid (`npc`, `pickup`, `door`, `trigger`) | **Error** |
| Interactable position uses 0–1 coordinates | **Error** |
| `goto:` transition targets an existing scene | **Error** |
| Interactable / player / sfx asset references exist in library | **Warning** |
| Invalid condition syntax on interactables | **Warning** |
| Hotspot inventory item ids exist in gameplay catalog | **Warning** |

These checks do **not** run at runtime during play — they are for authoring and integrity reports.

## Project integrity report

Modules: `engine/project-validation.ts`, `engine/project-integrity.ts`, `engine/editor-integrity-panel.ts`

Shared validation flows through `aggregateProjectValidation(project, { strictValidation? })`, the same pipeline as `compileProject` / package export (`collectCompileValidation` + `filterCompileBlockers`).

`buildProjectIntegrityReport(project, options?)` and `buildEditorIntegrityGroups(project, options?)` group findings into:

| Section | Contents |
|---------|----------|
| **Must fix before export** | Compile blockers (`blocking` / `error` severity) |
| **Warnings** | Non-blocking review items |
| **Information** | Informational findings |

Pass `{ strictValidation: true }` to preview exactly what would block strict compile/export. Default mode uses the legacy compile gate plus editor-only supplemental scans (orphan hotspot refs, unresolved recipe hooks).

Typed diagnostics: `buildIntegrityScanReport`, `buildStrictCompilePreviewReport` in `engine/diagnostics.ts`.

Returns legacy shape:

```typescript
{
  ok: boolean;          // true when no errors
  errors: IntegrityIssue[];
  warnings: IntegrityIssue[];
  summary: string;      // e.g. "2 errors · 5 warnings"
}
```

### What blocks runtime / compile

| Layer | Blocks compile? | Blocks playtest? |
|-------|-----------------|------------------|
| `validateProject` **errors** | Yes | Yes (won't compile) |
| `validateProject` **warnings** | No | No |
| Integrity report **errors** | No* | No* |
| Integrity report **warnings** | No | No |

\*Integrity report is informational unless its findings are also surfaced as compile errors via `validateProject`. Adventure invariant **errors** appear in the integrity report; wire them into compile blocking separately if desired.

## Deterministic authoring ids

Module: `engine/authoring-ids.ts`

Recipe and room generators use shared helpers:

- `slugifyAuthoringLabel()` — readable slug from labels/filenames
- `deterministicRoomInteractableUid(roomSlug, role)` — stable ids like `int_demo_dock_npc`
- `uniqueAuthoringSlug`, `uniqueHotspotUid`, `uniqueInteractableUid` — collision-safe suffixes (`_2`, `_3`, …)
- `reserveDeterministicUid()` — keep deterministic base id unless already taken

Same room slug + role always yields the same base interactable id. Re-applying generation to an occupied slot receives a suffixed id instead of silently overwriting.

## Asset reference safety

Module: `engine/asset-reference-safety.ts`

`findMissingAssetReferences(project)` scans:

- Scene backgrounds and audio
- Stage actors, expressions, and stage authoring objects
- Model preview image ids
- Adventure player sprites, interactable sprites, sfx overrides
- Inventory item `assetName` links

Reports warnings only — **does not remove** broken references.

## Save/load regression expectations

- Saves **without** `playerX`, `playerY`, or `lastLocationId` still deserialize via `deserializeState`
- Adventure saves **with** those fields round-trip through `serializeState` / runtime `toSave` / `tryResume`
- Legacy projects without `fragment.adventure` still compile

See `__tests__/foundation-save-regression.test.ts`.

## Related modules

| Module | Purpose |
|--------|---------|
| `engine/validator.ts` | Core project validation (compile gate) |
| `engine/adventure-validation.ts` | Adventure scene invariants |
| `engine/asset-reference-safety.ts` | Missing asset reference scan |
| `engine/project-integrity.ts` | Full integrity report |
| `engine/authoring-ids.ts` | Deterministic generated ids |

## Related documents

- [Asset specification](./ASSET_SPEC.md)
- [Package specification](./PACKAGE_SPEC.md)

---

# Phase 2: Runtime Safety & Compile Boundaries

Phase 2 defines clear boundaries between editor warnings, package/export checks, compile-blocking errors, and runtime-safe fallbacks.

## Validation severity policy

Module: `engine/validation-severity.ts`

| Severity | Meaning | Default compile | Strict compile | Export |
|----------|---------|-----------------|----------------|--------|
| **blocking** | Structural/syntax failure | Blocks | Blocks | Blocks when strict export validation runs |
| **error** | Adventure invariant or cross-scene duplicate id | Ignored* | Blocks | Blocks when strict export validation runs |
| **warning** | Missing optional media, orphans, semantic hints | Does not block | Does not block | Does not block |
| **info** | Unresolved hooks, unreachable semantic hints | Does not block | Does not block | Does not block |

\*Adventure **error** findings are not collected during default compile — only `validateProject` runs. This preserves Phase 1 default behavior.

### Typical level assignments

| Finding | Level |
|---------|-------|
| Missing/invalid start scene | **blocking** |
| Broken `goto:` / transition target | **blocking** (default) / **error** (adventure interactable in strict) |
| Duplicate scene `locationId` (unconditional) | **blocking** |
| Duplicate adventure interactable uid (cross-scene) | **error** (strict only) |
| Missing required adventure spawn | **error** (strict only) |
| Invalid expression / action syntax | **blocking** |
| Missing background image (referenced) | **blocking** (default) |
| Missing player/interactable sprite, sfx, optional audio | **warning** (strict treats as non-blocking) |
| Orphan scenes | **warning** |
| Unresolved recipe hooks (inventory/NPC flags) | **info** / **warning** |

Helpers:

- `resolveValidationSeverity(error, options)`
- `collectCompileValidation(project, options)`
- `filterCompileBlockers(diagnostics, options)`
- `isOptionalAssetIssue(error)`

## Compile / export integration

`compileProject(project, options?)` accepts `{ strictValidation?: boolean }`. Default (`undefined`) preserves legacy blocking: any diagnostic with `severity !== 'warning'` fails compile.

When `strictValidation: true`:

- Also runs `validateProjectAdventures` and cross-scene duplicate interactable checks
- Blocks on **blocking** and **error** severities
- Downgrades optional missing assets to **warning** (non-blocking)

`buildChronicaPackageBytes(project, exportedAt, options?)` accepts the same flag. Default export behavior is unchanged (asset-on-disk checks only). With `strictValidation: true`, export fails when strict compile validation fails (`validationErrors` on the failure result).

## Runtime fallback behavior

Module: `engine/runtime-fallbacks.ts`

Runtime never crashes when optional media is missing. Fallbacks are non-destructive and reported via `PlayerHost.snapshot().mediaFallbacks`:

| Missing | Fallback |
|---------|----------|
| Background image | Solid placeholder stage; warning emitted |
| Background audio | Playback skipped |
| Player sprite | Placeholder avatar in adventure view |
| Interactable sprite | Icon fallback by kind |
| SFX slot | Sound skipped (`useAdventureSfx` swallows errors) |
| Player position in save | Entry point default (`resolvePlayerPositionSafe`) |

`PlayerHost` continues to catch action-level exceptions and return structured `{ ok: false }` results.

## Editor integrity panel data

Module: `engine/editor-integrity-panel.ts`

`buildEditorIntegrityGroups(project)` converts `buildProjectIntegrityReport` findings into:

1. **Must fix before export** — blocking + error severities
2. **Should review** — warnings
3. **Informational** — info-level hints

No UI changes required; consumers can render these groups in any editor surface.

## Tests

See `__tests__/foundation-hardening-phase2.test.ts` for:

- Default compile behavior unchanged
- Strict validation blocking unsafe adventure projects
- Optional missing assets not blocking strict compile
- Runtime fallbacks without throws
- Editor grouping sections

---

# Phase 3: Package/Runtime Compatibility Matrix

Phase 3 makes package compatibility explicit and testable so older and newer `.chronica` projects fail safely.

## Foundation features

Module: `engine/package-compatibility.ts`

| Feature | Required when | Runtime behavior if unsupported |
|---------|---------------|----------------------------------|
| `narrative_fragments` | Project has scenes | **Block** play |
| `adventure_runtime` | Any fragment has `adventure` | **Block** play |
| `assets` | Assets referenced or in library | **Warn** — media skipped, placeholders shown |
| `stage_preview` | Stage authoring / actors present | **Warn** — preview metadata ignored |
| `asset_recipes` | Gameplay catalogs or model metadata | **Warn** — editor-only |
| `playable_room_generation` | Generated room interactable uids | **Warn** — editor-only |

Capabilities are **inferred from story content** — existing packages need no manifest changes. For compat ingest, `deriveParsedPackageCapabilities()` inspects raw package JSON **before** mobile normalization so adventure metadata is not lost during the check.

## Compatibility check

```typescript
deriveProjectCapabilities(project)
deriveParsedPackageCapabilities(parsedPackage)
checkPackageCompatibility(packageMeta, runtimeCapabilities)
checkProjectPlayCompatibility(project, runtimeCapabilities?)
```

Returns:

```typescript
{
  compatible: boolean;
  warnings: string[];
  blockers: string[];
  unsupportedFeatures: FoundationFeature[];
  safeFallbacks: Partial<Record<FoundationFeature, string>>;
  requiredFeatures: FoundationFeature[];
  optionalFeatures: FoundationFeature[];
}
```

`MOBILE_PLAYER_RUNTIME_CAPABILITIES` advertises all foundation features. `NARRATIVE_ONLY_RUNTIME_CAPABILITIES` is a test/legacy profile without `adventure_runtime`.

## Runtime loading safeguards

| Entry point | Behavior |
|-------------|----------|
| `ingestChronicaPackageForMobilePlayer` | Runs feature check after normalization; returns `feature-incompatible` when required features are missing |
| `parseChronicaPackage` (ZIP import) | Blocks import with `incompatible-features` when required features unsupported |
| `useChronicaRuntime` | Exposes `featureCompatibility` and `playCompatibilityBlockers`; sets `compileOk` false when blocked |

Default mobile play remains compatible — blockers only fire when a host explicitly omits a **required** feature (e.g. adventure content on a narrative-only runtime).

## Schema version handling

- `schemaVersion` outside runtime min/max → **blocker**
- Known-limited schema (v3 today) → **warning**, play continues
- Schema newer than fully-enabled ceiling → **warning**, play continues on mobile

## Tests

See `__tests__/foundation-hardening-phase3.test.ts` for:

- Narrative-only package compatibility
- Assets-without-adventure loading
- Adventure package blocking on narrative-only runtime
- Optional feature warnings + fallbacks
- Newer schema version warnings
- Ingest rejection with clear diagnostics

---

# Phase 4: Engine Contracts & Determinism

Phase 4 defines explicit engine contracts for correctness, determinism, and long-term maintainability.

See **[Engine Contracts](./ENGINE_CONTRACTS.md)** for the full engineering reference.

| Module | Purpose |
|--------|---------|
| `engine/contract-types.ts` | Shared `ContractDiagnostic` types |
| `engine/runtime-contracts.ts` | `validateRuntimeContracts` |
| `engine/deterministic-simulation.ts` | `replayRuntimeInputs`, `assertDeterministicReplay` |
| `engine/asset-contracts.ts` | Asset identity and reference validation |
| `engine/recipe-contracts.ts` | Recipe idempotency detection |
| `engine/room-generator-contracts.ts` | Room generator determinism checks |
| `engine/package-contracts.ts` | Compile/export/round-trip stability |

Tests: `__tests__/foundation-hardening-phase4.test.ts`

---

# Phase 5: Editor Action Safety & Transaction Model

Phase 5 formalizes the editor mutation layer so every action is atomic, validated, and observable.

See **[Editor Transactions](./EDITOR_TRANSACTIONS.md)** for the full engineering reference.

| Module | Purpose |
|--------|---------|
| `engine/editor-transactions.ts` | Transaction runner, dirty-state diff, undo/replay helpers |
| `engine/editor-mutations.ts` | Mutation definitions, safe delete/rename, batch import |

Tests: `__tests__/foundation-hardening-phase5.test.ts`

---

# Phase 6: Error Boundaries, Diagnostics & Recovery

Phase 6 unifies engine failures into typed diagnostics with recovery classification and optional structured logging.

See **[Diagnostics](./DIAGNOSTICS.md)** for the full engineering reference.

| Module | Purpose |
|--------|---------|
| `engine/diagnostics.ts` | Typed errors, reports, snapshots, converters |
| `engine/engine-logging.ts` | Optional structured logging (no console spam by default) |

Tests: `__tests__/foundation-hardening-phase6.test.ts`

---

# Foundation Audit Phase 1: Architecture Consistency

Read-only architecture review with targeted cleanup. Establishes baseline before major editor features.

See **[Architecture Audit Report](./ARCHITECTURE_AUDIT.md)** for findings, deferred recommendations, and duplicate-system map.

Tests: `__tests__/foundation-audit-phase1.test.ts`

---

# Foundation Audit P1: Editor Consistency & Transaction Coverage

Aligns editor validation, batch import, and runtime contract diagnostics with foundation systems.

| Area | Module / API | Notes |
|------|--------------|-------|
| Shared validation | `engine/project-validation.ts` — `aggregateProjectValidation`, `wouldStrictCompileBlock` | Same path as compile/export |
| Integrity panel | `buildEditorIntegrityGroups(project, { strictValidation? })` | Must fix / Warnings / Information |
| Batch import | `executeBatchAssetImportTransaction` → `replaceProjectSnapshot` | Wired in assets screen (files, zip, photo library) |
| Runtime contract audit | `buildRuntimeContractAuditReport`, `PlayerHost.auditRuntimeContracts()` | Non-blocking; exposed via `useChronicaRuntime.auditRuntimeContracts` |
| Diagnostics | `buildIntegrityScanReport`, `buildStrictCompilePreviewReport`, `buildBatchImportFailureReport` | All produce `DiagnosticReport` |

Tests: `__tests__/foundation-audit-p1.test.ts` (741+ tests passing)

### Deferred (P2+)

- Dedicated integrity panel UI screen (grouping helpers ready)
- Consolidate `findAssetRecord` implementations
- Foundation barrel module for editor consumers

