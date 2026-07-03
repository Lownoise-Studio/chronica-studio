# Mobile Compat ↔ Main Engine Parity Audit

**Scope**: Compare the mobile compat layer (`artifacts/chronica-mobile/engine/compat/*`) against the reference main Chronica engine addon (`chronica-engine-public-main/addons/chronica_engine/*`) shipped in the attached snapshot.

**Method**: Read the mobile compat source as authoritative. Read the main engine source as the reference. Diff subsystem-by-subsystem. Flag cross-engine portability blockers versus mobile-native differences.

**Conventions**:

- **Equivalent** — behavior is identical for cross-engine purposes.
- **Close** — same intent, small differences that would rarely be observable.
- **Partial** — same feature exists on both sides but shape or coverage differs materially.
- **Missing** — one side has it, the other does not.
- **Unknown** — cannot decide without more information (e.g. behavior not exercised by main engine tests here).

Recommended actions are grouped later. Nothing in this audit changes shipped runtime code — the file lives alongside the compat layer as documentation.

---

## 1. Per-subsystem status

| Subsystem | Current mobile behavior | Intended main-engine behavior | Status | Risk | Recommended next action |
|---|---|---|---|---|---|
| **ChronicaSession lifecycle** | Class facade. `start()` async: reset state → apply entry effects → `initializeAll` modules → emit `session_started` / `fragment_changed` / `state_changed` → `onSessionStart` hooks → `turn_resolved` (entry). `reset()` emits `session_reset`. | Node. `start(location)` synchronous: set location → resolve fragment → emit `session_started` / `fragment_changed` / `state_changed`. No `session_reset`, no `onSessionStart` hook. Modules initialize when `add_module()` is called, not lazily on start. | Close | Low | Keep mobile's shape but document that `session_reset` and `onSessionStart` are mobile-only. Consider a `session_reset` no-op emitter on the main side later. |
| **TurnResolver** | `choose(choice)` async. Snapshots state/fragment → resolves via compiled `ActionStep[]` → commits → awaits module hooks (`onChoiceSelected`, `onTurnResolved`) → emits `choice_selected` (full payload) → `turn_resolved` → `state_changed` / `fragment_changed` **unconditionally**. Also supports `activateHotspot`. | `TurnResolver.resolve(choice, state, store)` synchronous. Duplicates state twice (previous + current), parses `choice.action` string at runtime via `ActionResolver.resolve`, resolves next fragment, applies entry effects, commits, emits `turn_resolved` signal (previous, current, choice, fragment). `ChronicaSession.choose` then emits `choice_selected` / `fragment_changed` / `state_changed` **unconditionally**. No hotspot resolver. | Close | Low | **R2 COMPLETE** (Task 7): module hooks before `choice_selected`, unconditional change events, full payload with previous/current state and fragment. Hotspot path still uses conditional emits — mobile-only. |
| **ActionResolver** | Compiled `ActionStep[]` at build time. Runtime executes typed steps: `goto`, `set`, `clear`, `assign`, `increment`, `decrement`. Compat class `applyString` parses on demand for legacy paths. | Runtime string parser. Splits on `;`, understands `goto:` and delegates `+=` / `=` to `ExpressionEvaluator`. **`set:` / `clear:` / `-=` do not exist in the engine's action resolver** — they are only rewritten by `StudioActionAdapter` at package import time into `memory.foo = true` / `memory.foo = false` / `x += -N`. | Close | Low | Mobile accepts a superset of authored strings. When ingesting main packages the actions are already canonical (`memory.x = true`, `x += -N`), so mobile is a strict superset with equivalent runtime behavior. No action needed; note as documented. |
| **ExpressionEvaluator** | Regex-based. Numeric-safety: coerces both sides of `<`, `<=`, `>`, `>=` to a finite number to avoid string-vs-number ambiguity. `==` / `!=` are strict identity. Rejects `Infinity` / `NaN` in `parseValue`. Assignment supports strings, numbers, booleans, quoted literals. | Regex-based, same three patterns (condition, increment, assignment). `==` / `!=` type-guard: mismatched types are unequal. Ordering comparisons use Godot Variant `<`/`>` — behavior across mixed types is Godot-defined. `int` only for increment magnitude. Float literals via `is_valid_float()`. | Close | Low | Mobile is stricter around finite-number coercion and identical-type equality; both match on well-authored inputs. No action needed. Note: main's increment magnitude is `int`, mobile also parses via `parseInt`, so integer-only increments match. |
| **ChronicaState** | `{ location, instability, reality_layer, memory, variables, dialogueLineIndex }`. `instability` / `reality_layer` typed as `number` (can be non-integer — e.g. +0.5 baseline). Wrapped in a `ChronicaState` class with `.raw` accessor. Preserves `dialogueLineIndex` for tap-to-advance. | `{ location, instability: int, reality_layer: int, memory, variables }`. `instability` and `reality_layer` are `int`. No dialogue index — dialogue is not represented in main's core state. `sync_instability_mirror()` on any variable write to `instability`. | Partial | Medium | Mobile allows non-integer instability (used by `InstabilityModule`'s +0.5 default). Cross-engine save round-trip loses fractional instability on main (`int(...)`). Recommend switching mobile's default `turnIncrement` to an integer and storing `instability` as int, matching main's contract. Non-breaking to product code. |
| **FragmentStore** | Compiled `fragmentIndex.byLocation` pre-sorted by priority DESC. Ties broken by input order (stable sort). `active()` returns first candidate whose conditions all pass. | `FragmentStore.get_active_fragment(location, state)` filters by `id == location` and `is_valid(state)`, sorts by `FragmentSorter.compare`: priority DESC, then `id` ASC, then `text` ASC. | Close | Low | Same primary sort key. Tie-breakers differ but tie-breaking on same-location + same-priority is a corner case. Mark as documented; optionally align to main's id-then-text tie-break for exact parity. |
| **Event names** | `session_started`, `session_loaded`, `session_saved`, `session_reset`, `choice_selected`, `hotspot_activated`, `dialogue_advanced`, `turn_resolved`, `state_changed`, `fragment_changed`, `module_error`, `instability_changed`, `reality_layer_changed`, `echo_state_changed`. Snake_case. Payloads typed. | `session_started`, `session_loaded`, `fragment_changed`, `state_changed`, `choice_selected`, `echo_activated`, `echo_manifested`, `echo_resolved`. Plus Godot signals (`turn_resolved` etc.). Snake_case. Payloads dictionaries. | Partial | Medium | Missing on mobile: `echo_activated` / `echo_manifested` / `echo_resolved` (mobile emits generic `echo_state_changed`). Extra on mobile (harmless additions): `session_saved`, `session_reset`, `hotspot_activated`, `dialogue_advanced`, `module_error`, `instability_changed`, `reality_layer_changed`. **Fix**: emit main-shaped events too, additively — see recommendation R1. |
| **Event order** | choose: resolve → module hooks → `choice_selected` → `turn_resolved` → `state_changed` → `fragment_changed` (all unconditional on success). | choose: `TurnResolver` runs modules first (via `turn_resolved` signal → `_on_turn_resolved` → module hooks) → `choice_selected` → `fragment_changed` → `state_changed`, **unconditionally**. | Close | Low | **R2 COMPLETE** (Task 7): hooks-before-`choice_selected` and unconditional change events aligned. Main still emits `fragment_changed` before `state_changed`; mobile emits `state_changed` first — minor ordering difference for cross-engine listeners. |
| **choice_selected payload** | `{ choice, previousFragment, resultingFragment, currentFragment, previousState, currentState, turnResult }`. | `{ choice, fragment }` (includes the resulting fragment). | Equivalent | Low | **R2 COMPLETE** (Task 7): mobile is a strict superset of main's payload. |
| **session_started payload** | `{ fragment }`. | `{ location, fragment }`. | Close | Low | Add `location` to mobile's payload additively. See R2. |
| **Module lifecycle hooks** | `initialize`, `onSessionStart`, `onChoiceSelected`, `onTurnResolved`, `onSessionSave`, `onSessionLoad`. Sync or async; failures isolated via `module_error`. Ordered by `priority` ASC then registration order (duplicate id keeps slot). | `initialize`, `on_turn_resolved`, `on_session_loaded`, `on_session_save`, `on_session_load`, plus `get_registry_config` / `apply_registry_config`. Sync only. Ordered by `priority` ASC then registration order. **No `onSessionStart`, no `onChoiceSelected`.** | Close | Low | **R3 COMPLETE** (Task 7): `priority` field and sorted dispatch. Mobile still has extra hooks (`onSessionStart`, `onChoiceSelected`) — mobile enrichment. |
| **Module save/load payloads** | Object keyed by module id: `save.modules = { [id]: payload }`. Only `data` persisted. No `config`. | Array of `{ name, config, data }`. Both config and data persisted; on load main re-applies `config` before `on_session_load`. | Partial | Medium | Cross-engine save round-trip loses `config` on both sides. Non-blocking for mobile-only saves. Blocking for save portability. Consider evolving `ModuleSavePayload` to `{ config?, data }` and translating on ingest. See R4. |
| **CompatSave format** | `{ compatVersion: 1, projectId, gameId, contentHash, fragmentId?, state, history[], modules?, savedAt (ISO) }`. Gate on `gameId` + `contentHash` at resume. | `{ format_version: 2, saved_at_unix: int, state, modules: Array }`. **No gameId/contentHash gate** on load. | Partial | High for portability, low for mobile | Save files are not cross-engine readable in either direction. Mobile enforces strict identity on resume; main does not. Non-blocking for mobile-only play. For portability we'd need a common envelope format. See R5. |
| **Package format manifest** | `engine/chronica-package.ts` accepts story schemaVersion 1–3 (known). Compat validator recognizes v3 as **known-limited** (warning + `limited`, not `playable`). | Same fields. `SCHEMA_VERSION_MAX := 3`. | Close | Low | **R6 partial (Task 9)**: v3 no longer rejected by compat; full v3 ingest parity still open. |
| **Runtime target model (`ChronicaPackageManifest` in compat)** | New model on the mobile side: `runtimeTargets[]`, `requiredModules[]`, `optionalModules[]`, `capabilities[]`, `entryFragmentId`, `contentHash`. Validator picks first compatible target. | **Does not exist on main.** Main's manifest carries no runtime-target concept, no module lists, no capability tags. | Missing on main | Blocking for cross-engine target model | The runtime target concept lives entirely on the mobile side today. For the model to reach real cross-engine value, the main engine's exporter must learn to emit `runtimeTargets` in its manifest (as an unknown-but-preserved field, or in a new schema version). See R7. |
| **Package importer / archive reader** | Mobile keeps the existing `storage/chronica-package-io.ts` importer. Compat pipeline is loader-agnostic (`ParsedChronicaPackage` in memory). | Main's `ChronicaPackageImporter` reads a ZIP, verifies size/crc32, hashes, imports assets, converts fragments to engine resources. | Equivalent (loaders match on both sides) | Low | No action for parity. Mobile has extra ZIP-level constants and mirrors the same integrity gates. |
| **Ingestion normalization** | Defensive per-field normalization for fragments/choices/hotspots/dialogue/stageActors/characters/assets. Unknown fields collected as `UnsupportedContentReport`. Never throws. | Main's `ChronicaPackageFragmentConverter` only reads `locationId`, `priority`, `text`, `conditions`, `effects`, and `label`+`action` on choices. **Per-choice conditions are silently dropped**. No hotspots, dialogue, stage actors, characters. | Partial | Medium | Mobile → main direction loses per-choice conditions, hotspots, dialogue, stage actors, characters. This is main-side missing functionality, not a mobile compat bug. Non-blocking for the mobile-player runtime target since mobile keeps all fields. |
| **`InstabilityModule` semantics** | Default `turnIncrement = +0.5` per player-driven turn (choice + hotspot). Clamp to min 0. Reality layer 0/1/2/3 at 60/100/150. Emits `instability_changed` / `reality_layer_changed`. Save v1 `{ instability, realityLayer }`. | `InstabilityManager.auto_increment_per_turn: int = 0` (no auto-increment by default). Sets `reality_phase = 1` at instability >= 10. Does not track a `reality_layer` distinct from `instability`. No dedicated events. Save via `get_registry_config` + `on_session_save`. | Partial | Medium | Mechanics are meaningfully different: threshold values (10 vs 60/100/150), default increment (0 vs 0.5), variable name (`reality_phase` vs `reality_layer`), event emission. A main-engine save/module payload will not restore identically on mobile. See R8. |
| **`EchoModule` semantics** | Numeric thresholds (`activationThreshold`, `manifestationThreshold`). Runtime state (`Dormant → Active → Manifested → Resolved`) is deterministic from instability. Save v1 `{ echoes: [full instance with state and resolved flag] }`. Emits `echo_state_changed`. `Resolved` is only reachable via load. | `EchoDefinition` uses **condition expressions** (`activation_conditions[]`, `manifestation_conditions[]`, `resolution_conditions[]`) and effect expressions (`effects_on_activate/manifest/resolve[]`). Runtime state persisted in `ChronicaState.variables.echoes` map. Save format is `{ definitions: [...definitions only...] }` — runtime state lives in narrative state. Emits `echo_activated` / `echo_manifested` / `echo_resolved`. | Partial | High | Data shapes are incompatible: mobile cannot represent condition-driven transitions; main cannot represent numeric thresholds. Neither's save payload can be read by the other. See R9. |
| **Developer hybrid fixture** | Hand-authored `ParsedChronicaPackage` with `godot-3d` + `mobile-player` targets, two fragments, one choice, `terrain`/`camera` fields to exercise unsupported-content reporting, echo/instability module hints. | No such fixture on the main side because runtime targets don't exist there. | N/A | Low | The fixture accurately models what a **future** hybrid main-engine export would look like. Assumptions are labeled as provisional in the developer bridge. |

---

## 2. Blocking gaps before true cross-engine package portability

These are gaps that stop a real-world main-engine package from being imported and played on mobile without loss, or vice versa. They need explicit product decisions before shipping the runtime-target model.

1. **Main engine does not emit `runtimeTargets`** (or `requiredModules` / `capabilities`) in its package manifest. Until the exporter learns to write them, the compat validator has nothing target-shaped to match against, and every main package falls through to the legacy root-capability branch. This is the single largest blocker.
2. **`InstabilityModule` and `EchoModule` are incompatible data shapes across engines.** Mobile is threshold-driven; main is condition-driven. Save payloads produced by one runtime cannot be consumed by the other. Cross-engine games that use either module will not round-trip.
3. **Save envelope format diverges** (`format_version`/`saved_at_unix`/`modules[]` on main vs `compatVersion`/`savedAt`/`modules{}` on mobile). Cross-engine save portability is not achievable without a shared envelope.
4. **Compat ingest treats schema v3 as known-limited** — v3 packages warn and downgrade to `limited` rather than rejecting or silently playing as fully enabled. Full v3 ingest parity remains open.
5. **Module hook contract differs**: mobile fires `onChoiceSelected` (main has no analog). **`priority` ordering now matches main** (R3 COMPLETE). Cross-engine modules run in the same relative order when priorities are authored consistently.

## 3. Non-blocking differences (acceptable for mobile today)

These are real differences but do not block cross-engine narrative-only packages, and rewriting mobile to match main would cost more than the parity is worth right now.

1. **Extra mobile events** (`session_saved`, `session_reset`, `hotspot_activated`, `dialogue_advanced`, `module_error`, `instability_changed`, `reality_layer_changed`, `echo_state_changed`). Additive. Main has no consumers to break.
2. **Mobile-only hooks** (`onChoiceSelected`, per-turn dialogue advance). Mobile enrichment; main can ignore.
3. **Mobile session methods are async**. Main is sync. Only observable if a shared module is written against Godot's sync assumption.
4. **Fragment tie-breaker differs** (input-order on mobile vs id/text on main). Corner case; only matters for authors who intentionally rely on identical priority.
5. **Mobile's `ExpressionEvaluator` is stricter** on numeric coercion. Rejects `Infinity` / `NaN`, coerces ordering comparisons to numbers. Never produces a different result on well-authored inputs.
6. **Mobile's `ActionResolver` accepts a superset of the syntax** (`set:` / `clear:` / `-=` in addition to canonical forms). Main packages already ship the canonical forms via `StudioActionAdapter`.
7. **Mobile has separate hotspot resolution and a compiled `ActionStep` pipeline** — a mobile-only feature. Not observable on main packages.
8. **Mobile's compat manifest and `runtimeTargets` model itself** is a mobile-native addition and additive from main's perspective.

## 4. Recommended next-task sequence

Each recommendation is scoped to be an independently shippable task. Numbers reflect suggested order.

**R1. Additive echo lifecycle events (small).**
Emit `echo_activated`, `echo_manifested`, `echo_resolved` alongside the existing `echo_state_changed` in `EchoModule`. Additive on the event map, no removal, no consumer breakage. Directly improves cross-engine event parity.

**R2. Align `choose` event shape — COMPLETE (Task 7).**
- `choice_selected` includes `resultingFragment`, `currentFragment`, `previousFragment`, `previousState`, `currentState`, and `turnResult`.
- Module hooks run before `choice_selected` is emitted.
- `fragment_changed` / `state_changed` emit unconditionally on every successful `choose`.
- Remaining gap: `location` in `session_started` payload (still open).

**R3. Add module `priority` field — COMPLETE (Task 7).**
`ChronicaModule.priority?: number` (default 0). `ModuleRegistry` sorts by priority ASC then registration order across `initializeAll`, `callHook`, `saveAll`, and `loadAll`. Duplicate id replacement preserves registration slot.

**R4. Save module payload with `config` (medium).**
Evolve `CompatSave.modules` from `Record<id, data>` to `Record<id, { config?, data }>` while keeping legacy shape readable. On load, feed `config` into the module before `onSessionLoad`. Blocking for cross-engine save round-trip if we ever try it.

**R5. Rethink the save envelope for cross-engine portability (large).**
Design a shared save envelope both engines can read. Options: mobile switches to main's `{ format_version, saved_at_unix, state, modules[] }`; or main adopts mobile's `compatVersion`; or a new v2 envelope. Requires main-engine buy-in — put this behind a design doc before writing code.

**R6. Full schema v3 compat ingest parity (medium, partial — Task 9).**
v3 is **recognized** (`known-limited`, explicit warning). Remaining: declare v3 fully enabled on compat ingest once normalization covers all v3 fields end-to-end. Optionally add a `gameId` pattern check (warning, not error) matching main's `^[A-Za-z0-9_-]{1,128}$`.

**R7. Main-engine exporter must produce compat manifests (large, not a mobile task).**
The `runtimeTargets` / `requiredModules` / `capabilities` fields need to appear in real `.chronica` manifests. Coordinate with main-engine maintainers. Mobile can ingest today — nothing lands on main.

**R8. Rework `InstabilityModule` for main parity (medium).**
Default `turnIncrement` to `0` (opt-in like main). Move `reality_layer` to `reality_phase` variable to match main's semantic (or expose both). Keep the mobile-specific 60/100/150 tiering as an opt-in module option, not a default.

**R9. Redesign `EchoModule` to condition/effect model (large).**
Replace numeric thresholds with condition-expression arrays (`activationConditions`, `manifestationConditions`, `resolutionConditions`) and effect-expression arrays (`effectsOnActivate/Manifest/Resolve`). Persist runtime state via `ChronicaState.variables.echoes` map, not a per-instance save entry. Emit `echo_activated` / `echo_manifested` / `echo_resolved`. This is the largest single piece of parity work and unlocks cross-engine echo authoring.

**R10. Update the hybrid fixture and dev bridge once R7/R8/R9 land.**
Rework `dev/fixtures/godot-hybrid-package.ts` to use condition-driven echoes and integer instability so the dev bridge exercises the corrected data shapes.

---

## Appendix: source files consulted

Mobile compat (`artifacts/chronica-mobile/engine/compat/*`):

- `types.ts`, `event-bus.ts`, `context.ts`, `chronica-state.ts`, `chronica-session.ts`, `fragment-store.ts`, `turn-resolver.ts`, `action-resolver.ts`, `expression-evaluator.ts`, `module.ts`, `module-registry.ts`
- `modules/instability-module.ts`, `modules/echo-module.ts`
- `package/types.ts`, `package/validate.ts`, `package/bridge.ts`
- `ingest/types.ts`, `ingest/normalize.ts`, `ingest/ingest.ts`, `ingest/session-factory.ts`
- `dev/chronica-compat-import.ts`, `dev/fixtures/godot-hybrid-package.ts`

Main engine (`chronica-engine-public-main/addons/chronica_engine/*`):

- `chronica_session.gd`, `chronica_state.gd`, `chronica_serializer.gd`
- `turn_resolver.gd`, `action_resolver.gd`, `expression_evaluator.gd`
- `fragment.gd`, `choice.gd`, `fragment_store.gd`, `fragment_sorter.gd`
- `chronica_package.gd`, `chronica_package_constants.gd`, `chronica_package_validator.gd`, `chronica_package_importer.gd`, `chronica_package_fragment_converter.gd`, `chronica_package_hash.gd`, `studio_action_adapter.gd`
- `core/chronica_event_bus.gd`, `core/chronica_module.gd`
- `modules/chronica/instability_manager.gd`, `modules/chronica/echo_manager.gd`, `modules/chronica/echo_definition.gd`
