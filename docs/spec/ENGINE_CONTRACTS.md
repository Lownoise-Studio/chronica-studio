# Chronica Engine Contracts

This document defines the **engineering contracts** every Chronica runtime, editor, and package implementation must satisfy. Contracts are enforced through validation helpers and regression tests — not automatic repair.

Related: [Foundation Hardening](./FOUNDATION_HARDENING.md) · [Architecture Audit](./ARCHITECTURE_AUDIT.md)

---

## Principles

1. **Validation over repair** — report violations; never silently rewrite project data.
2. **Determinism by default** — identical inputs produce identical outputs unless a feature is explicitly seeded.
3. **Immutable boundaries** — compiled games and exported packages are snapshots; runtime mutates only session state.
4. **Backwards compatibility** — new contract checks must not break existing valid projects/packages.

---

## Runtime contracts

Module: `engine/runtime-contracts.ts`

### Guarantees

| Invariant | Description |
|-----------|-------------|
| Initialization order | `start()` / `tryResume()` must establish `state`, `fragment`, and interaction caches atomically |
| Atomic scene transitions | Location, dialogue index, and player spawn update together in `applyTurn` |
| Atomic state commits | Each `choose`, `activateHotspot`, `activateInteractable` applies a full turn result before refreshing visibility |
| Deterministic event ordering | Interactions resolve through compiled action maps keyed by uid — no implicit ordering |
| No partial interactions | Failed actions return `{ ok: false }` without mutating location |
| Valid player state | Adventure scenes keep player coordinates in normalized 0–1 space after transitions |
| Immutable project data | `CompiledGame` is a read-only snapshot; runtime never writes back to `Project` |

### API

#### `validateRuntimeContracts(context)`

**Preconditions:** Context reflects a runtime snapshot after `start`, `tryResume`, or an interaction.

**Postconditions:** Returns `{ ok, diagnostics, errors, warnings }`. Errors indicate contract violations.

**Failure behavior:** Non-throwing. Diagnostics only.

**Determinism:** Pure function of context.

---

## Deterministic simulation

Module: `engine/deterministic-simulation.ts`

### Guarantees

Same `Project` + same optional `RuntimeSave` + same ordered `RuntimeInput[]` → identical serialized `ChronicaState`.

No hidden randomness in turn resolution, movement, or inventory updates.

### API

#### `replayRuntimeInputs(game, inputs, save?)`

**Preconditions:** `game` is a valid `CompiledGame`. Each input references a currently visible uid.

**Postconditions:** Returns a `ChronicaRuntime` after applying all inputs sequentially.

**Failure behavior:** Throws when an input target is not visible (test/debug aid).

**Determinism:** Required — repeated calls with identical inputs must match.

#### `assertDeterministicReplay(project, inputs, save?)`

**Preconditions:** Project compiles successfully.

**Postconditions:** Runs two independent replays; compares normalized state snapshots.

**Failure behavior:** Returns `{ equal: false, validation }` on divergence — never throws.

#### `snapshotRuntimeState(state)`

**Postconditions:** JSON-serializable normalized state via `serializeState` / `deserializeState`.

---

## Asset contracts

Module: `engine/asset-contracts.ts`

### Guarantees

| Guarantee | Enforcement |
|-----------|-------------|
| Asset IDs immutable | Duplicate ids → error |
| References not silently rewritten | Rename impact reported |
| Delete cannot silently orphan refs | Missing references reported |
| Duplicate imports predictable | Same id/name re-import → warning, no merge |

### API

#### `validateAssetContracts(project)`

**Preconditions:** Any `Project`.

**Postconditions:** Validation-only diagnostics. No mutation.

#### `validateAssetRenameImpact(project, assetId, nextName)`

**Postconditions:** Lists reference paths that would break on rename.

#### `validateDuplicateAssetImport(project, incoming)`

**Postconditions:** Warns when import would collide with existing library records.

---

## Recipe contracts

Module: `engine/recipe-contracts.ts` (+ planning integration in `asset-recipes.ts`)

### Guarantees

Applying the same recipe twice on the same scene **must not silently duplicate** gameplay objects (`make_pickup`, `make_npc`, `make_door`).

Second application reports `duplicate-recipe-object` conflicts and blocks `canApply` unless overwrite is explicitly confirmed for field-level conflicts.

### API

#### `findExistingRecipeObjects(project, fragment, recipe, asset, label)`

**Postconditions:** Lists inventory items, hotspots, interactables, and stage objects that already implement the recipe.

#### `validateRecipeIdempotency(...)`

**Postconditions:** Warning diagnostics for each existing object.

---

## Room generator contracts

Module: `engine/room-generator-contracts.ts`

### Guarantees

Given identical `project`, `assets`, and `PlayableRoomGeneratorOptions`:

- Identical interactable uids
- Identical collider uids
- Identical stage object uids
- Identical adventure structure

Generation order must not affect output.

### API

#### `validateRoomGeneratorDeterminism(project, options?)`

**Postconditions:** Runs generation twice; errors on snapshot mismatch.

#### `snapshotGeneratedRoom(fragment)` / `compareGeneratedRoomSnapshots(a, b)`

**Determinism:** Snapshots use sorted uid lists and deep-cloned adventure data.

---

## Package contracts

Module: `engine/package-contracts.ts`

### Guarantees

```
Project → export plan → story.json → normalized fingerprint
```

Timestamps (`createdAt`, `updatedAt`, `importedAt`) are stripped for equivalence checks. Asset URIs normalize to names for story comparison.

### API

#### `validateRepeatedCompileStability(project)`

**Postconditions:** Two `compileProject` runs produce identical `contentHash` and action maps.

#### `validateRepeatedExportStability(project, exportedAt?)`

**Postconditions:** Two `planChronicaPackage` runs produce identical normalized story fingerprints.

#### `validatePackageRoundTripContent(project, exportedAt?)`

**Postconditions:** `buildPackageStory` preserves normalized structural hash.

#### `stripProjectTimestamps(project)` / `normalizePackageProject(project)`

**Postconditions:** Deterministic normalization helpers for tests and tooling.

---

## Public API contract summary

| Module | Entry point | Blocks runtime? | Mutates data? | Deterministic? |
|--------|-------------|-------------------|---------------|----------------|
| `compileProject` | Compile boundary | Yes on errors | No | Yes |
| `buildCompiledGame` | Internal compile | Throws on bad actions | No | Yes |
| `validateRuntimeContracts` | Runtime audit | No | No | Yes |
| `replayRuntimeInputs` | Test/sim helper | Throws on bad input | Session only | Yes |
| `validateAssetContracts` | Editor/report | No | No | Yes |
| `planAssetRecipeApplication` | Recipe plan | No | No | Yes |
| `applyAssetRecipe` | Recipe apply | Throws on conflict | Yes (copy) | Yes given same ids |
| `generatePlayableRoomFromAssets` | Room gen | Throws on conflict | Yes (copy) | Yes |
| `checkPackageCompatibility` | Load boundary | Yes when required features missing | No | Yes |
| `buildProjectIntegrityReport` | Editor report | No | No | Yes |

---

## Compatibility expectations

- Contract validators are **additive** — existing packages and saves remain valid.
- Strict modes (`strictValidation`, feature compatibility) are opt-in unless a host explicitly opts out of a required feature.
- Future features must declare whether they are **required** or **optional** in `package-compatibility.ts` before shipping.

---

## Future extension rules

1. Add a contract module section here before shipping new generator/recipe/runtime behavior.
2. Add regression tests in `__tests__/foundation-hardening-phase4.test.ts` (or a focused sibling file).
3. Prefer structured diagnostics (`ContractDiagnostic`) over ad-hoc strings.
4. Never auto-fix contract violations in the contract layer — repair belongs in explicit editor actions.
5. Deterministic id helpers live in `authoring-ids.ts`; do not introduce random uids in generators.

---

## Tests

See `__tests__/foundation-hardening-phase4.test.ts` for:

- Runtime contract validation
- Deterministic replay
- Asset immutability / duplicate import reporting
- Recipe idempotency
- Room generator determinism
- Package compile/export/round-trip stability
