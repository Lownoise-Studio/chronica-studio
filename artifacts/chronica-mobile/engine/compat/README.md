# Runtime Compat Layer

Mirrors the object shape of the main Chronica engine (Godot reference implementation) at
the **data / runtime** level. This is a thin OO facade over the existing pure functions in
`engine/`; it introduces no new gameplay rules and no Godot-specific concepts (scene
nodes, placeable objects, cameras, terrain, editor docks).

## Why

The Godot Chronica engine organizes its runtime as a set of named objects:

- `ChronicaSession` — owns the active session.
- `ChronicaState` — variables / flags / inventory / history.
- `FragmentStore` — resolves fragments/scenes by id.
- `TurnResolver` — resolves one player action into state changes and next fragment.
- `ExpressionEvaluator` — evaluates conditions.
- `ActionResolver` — applies effects/actions.
- `ChronicaEventBus` — emits runtime events (`session_started`, `choice_selected`,
  `turn_resolved`, `state_changed`, `fragment_changed`, `session_saved`,
  `session_loaded`, `module_error`, …).
- `ChronicaModule` + `ModuleRegistry` — optional gameplay systems hook the runtime
  without hardcoding.
- Save/load — core state + module-specific payloads.

Mobile already has all the underlying logic as pure functions. This layer surfaces the
same names and interaction shape so:

1. Documentation, tooling, and shared design across engines refers to one vocabulary.
2. Mobile can eventually import and play `.chronica` packages exported from the main
   engine without a translation step.
3. Optional gameplay systems (dialogue, hotspots, stage actors, and future modules) can
   attach through `ModuleRegistry` instead of accreting into `turn-resolver.ts`.

## Turn flow (choice)

```
validate session + choice
snapshot previous state / fragment
resolve turn via TurnResolver
commit state + fragment
await onChoiceSelected (all modules, priority order, isolated)
await onTurnResolved   (all modules, priority order, isolated)
emit  choice_selected  (full payload: choice, previous/current fragment & state, turnResult)
emit  turn_resolved
emit  state_changed      (unconditional on success)
emit  fragment_changed   (unconditional on success)
```

Module hook failures are caught and routed through `module_error`. The surrounding turn
still commits. Order across modules is deterministic: lower `priority` runs first;
modules with the same priority run in registration order (duplicate id replacement
keeps the original registration slot).

## What this layer is NOT

- Not a rewrite. The existing `ChronicaRuntime` / `PlayerHost` still power playtest and
  Load Game. The compat layer wraps the same primitives.
- Not a UI redesign.
- Not Godot-specific. No 3D, no editor docks, no scene nodes.
- Not a place to add new gameplay rules. Rules stay in `engine/` (compiler, expression
  evaluator, action resolver). This layer routes calls and dispatches events.

## Layout

| File | Role |
|------|------|
| `types.ts` | Compat-facing types (events, hook names, save envelope, TurnResult). |
| `event-bus.ts` | Typed pub/sub with `on` / `off` / `emit` / `once`. |
| `chronica-state.ts` | Class wrapper over engine `ChronicaState` (mutable, JSON-safe). |
| `fragment-store.ts` | Class wrapper over `getActiveFragmentFromIndex`. |
| `expression-evaluator.ts` | Class wrapper over condition/effect evaluation. |
| `action-resolver.ts` | Class wrapper over compiled `ActionStep` execution. |
| `turn-resolver.ts` | Class wrapper over `resolveTurn` / `resolveHotspotActivation`. |
| `context.ts` | `ChronicaRuntimeContext` shared with modules. |
| `module.ts` | `ChronicaModule` hook contract. |
| `module-registry.ts` | Register / dispatch / save / load — with error isolation. |
| `module-save.ts` | `ModuleSaveEntry` normalization; legacy record compat on load. |
| `chronica-session.ts` | Top-level session — composes everything, drives the flow. |
| `save-load.ts` | Envelope shape check + `RuntimeSave` adapters. |
| `modules/` | First-party gameplay modules (see below). |
| `package/` | Cross-engine package compatibility model (see below). |
| `ingest/` | Non-UI mobile-player ingestion pipeline (see below). |
| `index.ts` | Public surface. |

## First-party gameplay modules

Modules are optional. A ChronicaSession runs fine with none attached — every
hook has a default of "do nothing." The compat layer ships two first-party
gameplay modules under `engine/compat/modules/`:

- `InstabilityModule` (id `chronica.instability`) — tracks instability and
  the derived reality layer (0/1/2/3 at 60/100/150), applies a +0.5 baseline
  on player-driven turns, clamps to zero, and emits `instability_changed` /
  `reality_layer_changed` when the tracked values move. Save version 1.
- `EchoModule` (id `chronica.echoes`) — advances echoes through Dormant →
  Active → Manifested based on the current instability, honoring per-echo
  thresholds. Resolved echoes are locked. Emits `echo_state_changed`. Save
  version 1. Reads instability from InstabilityModule when attached, falls
  back to `ChronicaState.instability` otherwise.

Together they prepare mobile for portable main-engine games: their contract
matches the main Chronica engine, so gameplay authored against these modules
plays identically on both runtimes. `TurnResolver` and the pure engine
functions stay untouched — modules extend behavior only through hooks.

## Module save / load

Module payloads follow the Chronica Specification `ModuleSaveEntry` shape:

```typescript
{ id: string; config?: unknown; data: unknown }
```

- **`onSessionSave` / `onSessionLoad`** — runtime `data` (Instability and Echo use these today).
- **`onSessionSaveConfig` / `onSessionLoadConfig`** — optional registry `config`, applied **before** data on resume.

`ModuleRegistry.saveAll` emits an array of entries. `loadAll` accepts:

- canonical arrays (`[{ id, config?, data }]`), or
- legacy compat v1 records (`{ [moduleId]: data }`).

Legacy record values may also be `{ config?, data }` objects. Missing module entries still pass `undefined` to load hooks. Hook failures remain isolated via `module_error`.

The compat save envelope (`compatVersion: 1`) remains the **default write format** for `ChronicaSession.toSave()`. Module payloads are stored as `ModuleSaveEntry[]` in both v1 and canonical v2 writes.

### Write formats

```typescript
// Default — compat v1 (compatVersion: 1)
session.toSave(projectId);
session.toSave(projectId, { format: 'compat-v1' });
session.toSave({ projectId, format: 'compat-v1' });

// Opt-in canonical v2 (formatVersion: 2, SAVE_SPEC)
session.toSave(projectId, { format: 'canonical-v2' });
session.toSave({ projectId, format: 'canonical-v2' });
```

Canonical v2 emits `formatVersion: 2`, ISO `savedAt`, and `modules: ModuleSaveEntry[]`. Both shapes resume through `normalizeSaveEnvelope` inside `tryResume`. Production `save-store` still uses legacy `RuntimeSave` — not switched yet.

### Dual-read normalization

`normalizeSaveEnvelope` (in `save-load.ts`) accepts RuntimeSave v0, CompatSave v1, canonical v2, and main-format `format_version: 2` on read. See `docs/spec/SAVE_SPEC.md`.

## Package compatibility (runtime targets)

### Story schema versions

Compat validation uses explicit tiers from `engine/schema-versions.ts`:

| Constant | Value | Role |
|----------|-------|------|
| `CHRONICA_SCHEMA_VERSION_MIN` | 1 | Lowest recognized revision |
| `CHRONICA_SCHEMA_VERSION_MOBILE_PLAYER_FULLY_ENABLED_MAX` | 2 | Compat ingest full parity |
| `CHRONICA_SCHEMA_VERSION_KNOWN_MAX` | 3 | Spec ceiling (v3 = dialogue/hotspots/stage-actors schema) |

- **v1–v2** — `schemaVersionSupport: fully-enabled`; may reach `playable`.
- **v3** — `known-limited`: explicit warning, `playable` downgraded to `limited`. Not rejected, not silently fully enabled.
- **> v3** — `unsupported` with typed error.

The existing ZIP importer (`engine/chronica-package.ts`) still accepts all known versions (1–3) — unchanged.

`engine/compat/package/` adds a **cross-engine package model** on top of the
existing format-level manifest in `engine/chronica-package.ts`. The two are
deliberately separate:

- The **format manifest** answers "is this a valid Chronica package archive?"
  It stays untouched, and the existing mobile importer keeps using it.
- The **compat manifest** answers "can this runtime play this package?" —
  by listing modules the package needs, capability tags, and a set of
  `ChronicaRuntimeTarget`s.

A single `.chronica` package can now advertise multiple targets. For example,
a 3D-authored main-engine project can ship both a `godot-3d` target (full
experience) and a `mobile-player` target (narrative + stage2d fallback). The
validator picks the first target it can satisfy — so a mobile host does not
reject the whole package just because a 3D-only target exists alongside a
mobile-compatible one.

`validateChronicaPackageCompatibility(manifest, options)` returns:

| Level | Meaning |
|-------|---------|
| `playable` | A fully compatible target is available; `selectedRuntimeTarget` is set. |
| `limited` | A target matches by id, but some of its capabilities are unsupported — you can play with reduced features. |
| `editor_only` | No runnable target, but the core narrative data is loadable for editing. |
| `unsupported` | Nothing usable — a required target or module is missing, the schema is out of range, or the manifest is malformed. |

Mobile hosts pass `MOBILE_PLAYER_COMPATIBILITY_OPTIONS` to advertise the
mobile-player target id and its capability set (`narrative`, `dialogue`,
`variables`, `choices`, `hotspots`, `stage2d`, `touch`, `modules`,
`save-load`). Bridge helpers (`createCompatManifestFromMobileProject`,
`inferMobilePlayerRuntimeTarget`) build compat manifests from authored mobile
projects so mobile-exported packages advertise themselves in the same
vocabulary as main-engine exports.

Existing mobile packages remain compatible: legacy manifests without a
`runtimeTargets` array fall back to root-level capabilities and
`entryFragmentId`, so nothing that used to import still needs to advertise
a runtime target to keep working.

## Mobile-player ingestion pipeline (non-UI)

`engine/compat/ingest/` is the first non-UI ingestion path for cross-runtime
`.chronica` packages. It takes a **parsed** package-like object (structure
described by `ParsedChronicaPackage`) and turns it into a runnable
`ChronicaSession` — without touching the existing mobile importer, the UI, or
`TurnResolver`.

Scope of this step:

- **In scope**: manifest compatibility check, runtime-target selection,
  defensive normalization of fragments/choices/characters/assets into the
  strict mobile shapes, compilation to `CompiledGame`, optional session
  factory that also attaches first-party modules.
- **Out of scope (later steps)**: reading `.chronica` ZIP bytes, hydrating
  asset files to local URIs, and any user-facing import UI. Those keep using
  `engine/chronica-package.ts` / `storage/chronica-package-io.ts`.

Entry points:

- `ingestChronicaPackageForMobilePlayer(pkg, options)` — pure. Returns a
  discriminated union: `{ ok: true, game, project, compatibility, warnings,
  unsupportedContent, ... }` on success, or `{ ok: false, reason, errors, ... }`
  when compat rejects the package, the entry fragment is missing, no fragments
  survive normalization, or compilation fails.
- `createMobileSessionFromChronicaPackage(pkg, options)` — awaits the ingest,
  then wraps the compiled game in a `ChronicaSession`, optionally attaches
  `InstabilityModule` / `EchoModule` (using package-supplied hints when
  present), and optionally auto-starts the session.

Normalization is defensive: anything the mobile runtime cannot consume is
dropped and collected into `unsupportedContent[]` (typed by
`UnsupportedContentReport`). Ingestion never throws on unknown fields.

## Developer bridge (provisional)

`dev/` at the app root hosts a **temporary developer-only** path that
exercises the compat pipeline in-app so we can iterate on parity with the
main engine before shipping the real archive reader and import UX:

- `dev/fixtures/godot-hybrid-package.ts` — a small, hand-authored parsed
  package that mimics a main-engine export with both a `godot-3d` and a
  `mobile-player` runtime target, two fragments, one choice, and hints for
  the instability / echo modules.
- `dev/chronica-compat-import.ts` — `importChronicaPackageForDeveloper(pkg,
  options?)` wraps `createMobileSessionFromChronicaPackage` and returns a
  display-friendly summary (title, compatibility level, selected target,
  current fragment text, choices, warnings count) alongside the raw session.
- `components/ChronicaCompatDevPanel.tsx` — a minimal panel mounted next to
  the existing `DeveloperMenu` on the About tab. It appears only when
  `isStudioApp() && (__DEV__ || advancedMode)`. Tapping **Import hybrid
  fixture** runs the pipeline and shows the summary; **Advance first
  choice** exercises the session.

This bridge is intentionally provisional. It reproduces the compat behavior
we expect the main engine to match — but parity is **expected, not
guaranteed**. Do not depend on it from product code; the shipping importer
(`engine/chronica-package.ts` + `storage/chronica-package-io.ts`),
`PlayerHost`, and every project flow remain untouched.
