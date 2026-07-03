# Event Specification

Defines how **player interactions** become **state transitions**. Chronica expresses gameplay as compiled action steps—not ad hoc UI callbacks.

## Action strings

Choices and hotspots carry an **action** string authored in a constrained grammar. At compile time, actions parse into ordered **ActionStep** sequences. At runtime, only compiled steps execute.

## Action step kinds (current)

| Kind | Purpose |
|------|---------|
| `goto` | Transition to a location id (resolve next fragment) |
| `set` | Set a boolean flag (memory) |
| `clear` | Clear a boolean flag |
| `assign` | Assign a value to a variable path |
| `increment` | Add to a numeric variable |
| `decrement` | Subtract from a numeric variable |

Multi-step actions combine steps with semicolon-separated strings in authored content.

## Event sources

| Source | Trigger |
|--------|---------|
| **Choice** | Player selects a visible choice after dialogue exhaustion (when applicable) |
| **Hotspot** | Player activates a visible hotspot region |
| **Fragment entry** | Effects run when a fragment becomes active (not player events, but state mutations on entry) |

## Conditions

Choices, hotspots, stage actors, and fragments may declare **conditions**—expressions evaluated against runtime state. All conditions on an object must pass for it to be visible or selectable.

Condition syntax is shared across the specification; invalid conditions fail compile validation.

## Effects

Fragments may declare **entry effects** applied when the fragment becomes active (before presenting dialogue). Effects use the same expression grammar as action assignments.

## Execution order

1. Player selects choice or hotspot.
2. Runtime looks up compiled steps for that uid.
3. Steps mutate state in order.
4. Fragment index resolves next active fragment for new location/state.
5. Entry effects on new fragment apply.
6. Dialogue index resets on fragment/location change (unless specification defines otherwise).
7. Visible choices and hotspots refresh (typically after dialogue exhaustion).

## Determinism

Action execution must be deterministic for a given compiled game and input sequence. Side effects outside state (audio, animation) are presentation concerns.

## Future events

Additional step kinds and event sources (inventory use, timed triggers, etc.) extend this specification explicitly. Implementations must not invent parallel action systems in UI layers.

## Related documents

- [Scene specification](./SCENE_SPEC.md)
- [Module specification](./MODULE_SPEC.md)
- [Runtime specification](./RUNTIME_SPEC.md)
