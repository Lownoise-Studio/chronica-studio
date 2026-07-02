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
emit  choice_selected
await onChoiceSelected (all modules, isolated)
      resolve turn via TurnResolver
      commit state + fragment
await onTurnResolved (all modules, isolated)
emit  turn_resolved
emit  state_changed      (only if state actually changed)
emit  fragment_changed   (only if fragment actually changed)
```

Module hook failures are caught and routed through `module_error`. The surrounding turn
still commits. Order across modules is deterministic (registration order).

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
| `chronica-session.ts` | Top-level session — composes everything, drives the flow. |
| `save-load.ts` | Envelope shape check + `RuntimeSave` adapters. |
| `modules/` | First-party gameplay modules (see below). |
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
