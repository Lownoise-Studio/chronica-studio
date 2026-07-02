# Runtime Compat Layer

Mirrors the object shape of the main Chronica engine (Godot reference implementation) at
the **data / runtime** level. This is a thin OO facade over the existing pure functions in
`engine/`; it introduces no new gameplay rules and no Godot-specific concepts (scene nodes,
placeable objects, cameras, terrain, editor docks).

## Why

The Godot Chronica engine organizes its runtime as a set of named objects:

- `ChronicaSession` — owns the active session.
- `ChronicaState` — variables / flags / inventory / history.
- `FragmentStore` — resolves fragments/scenes by id.
- `TurnResolver` — resolves one player action into state changes and next fragment.
- `ExpressionEvaluator` — evaluates conditions.
- `ActionResolver` — applies effects/actions.
- `EventBus` — emits runtime events.
- `Module` system — optional gameplay systems hook the runtime without hardcoding.
- Save/load — core state + module-specific payloads.

Mobile already has all the underlying logic as pure functions. This layer surfaces the
same names and interaction shape so:

1. Documentation, tooling, and shared design across engines refers to one vocabulary.
2. Mobile can eventually import and play `.chronica` packages exported from the main
   engine without a translation step.
3. Optional gameplay systems (dialogue, hotspots, stage actors, and future modules) can
   attach through `ModuleRegistry` instead of accreting into `turn-resolver.ts`.

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
| `types.ts` | Compat-facing types (events, modules, save envelope). |
| `event-bus.ts` | Typed pub/sub for runtime events. |
| `chronica-state.ts` | Class wrapper over engine `ChronicaState` (mutable, JSON-safe). |
| `fragment-store.ts` | Class wrapper over `getActiveFragmentFromIndex`. |
| `expression-evaluator.ts` | Class wrapper over condition/effect evaluation. |
| `action-resolver.ts` | Class wrapper over compiled `ActionStep` execution. |
| `turn-resolver.ts` | Class wrapper over `resolveTurn` / `resolveHotspotActivation`. |
| `module.ts` | `RuntimeModule` contract + hook shape. |
| `module-registry.ts` | Attach/detach modules, dispatch hooks. |
| `chronica-session.ts` | Top-level session object owning the wrappers + registry. |
| `save-load.ts` | Save envelope with per-module payload map + legacy compatibility. |
| `index.ts` | Public surface. |
