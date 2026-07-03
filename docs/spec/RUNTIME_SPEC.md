# Runtime Specification

Defines the **Chronica Runtime** — the session that loads compiled game data and drives deterministic play. The runtime is independent of any single editor UI.

## Purpose

The runtime is responsible for:

- Loading a **compiled, validated game** (typically from a `.chronica` package or equivalent hydrated project).
- Driving **deterministic game logic**: state, scene resolution, choice/hotspot filtering, action execution.
- Supplying **presentation inputs** (text, media URIs, stage actors, visible interactions)—not owning render technology.
- **Persisting and restoring** in-progress play via the save format—not editor undo or layout state.

The runtime **must not** depend on editor routes, graph layout, validation panels, or project-management UI.

## Authoring vs play boundary

```
┌──────────────────────────────────────────────┐
│  Authoring implementation                   │
│  Scenes · Assets · Export · Validation       │
└────────────────────┬─────────────────────────┘
                     │ .chronica package
                     ▼
┌──────────────────────────────────────────────┐
│  Chronica Runtime / Player                  │
│  Load · Session · Turns · Saves               │
└──────────────────────────────────────────────┘
```

### Authoring responsibilities

- Mutate project source (fragments, choices, assets, characters).
- Run compile/validate before export or playtest.
- Build `.chronica` packages.
- May embed a runtime shell for **playtest** using the same session API as production players.

### Runtime responsibilities

- Parse and hydrate packages.
- Start or resume sessions.
- Execute choice and hotspot actions.
- Expose current fragment, visible interactions, and presentation inputs.
- Serialize runtime state for saves.

The runtime **must not** write authored project source during normal play.

## Session lifecycle

| Phase | Behavior |
|-------|----------|
| **Start** | Bootstrap state from `startLocation`, apply entry effects, resolve active fragment, expose initial dialogue/choices/hotspots. |
| **Turn** | Apply compiled action for choice or hotspot; update state; resolve next fragment; refresh visible interactions. |
| **Dialogue advance** | Increment line index within fragment; gate choices/hotspots until dialogue exhausted (implementation-defined presentation). |
| **Resume** | Validate save against `gameId` and content hash; restore state; resolve fragment. |
| **Save** | Serialize runtime state + metadata; exclude authored project structure. |

## Determinism

Given the same compiled game and the same player inputs, the runtime produces the same state sequence. Randomness, if introduced later, must be explicit and seedable in the specification.

## Presentation inputs

The runtime returns **data**; host implementations **render** it:

| Input | Source |
|-------|--------|
| Scene text / dialogue | Active fragment + dialogue index |
| Background image URI | Resolved from fragment `backgroundImage` |
| Background audio URI | Resolved from fragment `backgroundAudio` |
| Visible choices | Condition-filtered choice list |
| Visible hotspots | Condition-filtered hotspot list |
| Stage actors | Resolved sprites + expressions from state |

See [Rendering specification](./RENDERING_SPEC.md).

## Compile gate

Before play, project data must compile to a **CompiledGame**:

- Fragment index by location and priority.
- Compiled choice and hotspot action maps.
- Content hash for save validation.
- Validation diagnostics on failure.

Playtest and standalone player must use the same compile + session path.

## Host orchestration

Implementations may wrap the runtime in a **player host** that:

- Catches invariant violations and returns structured errors to UI.
- Verifies asset existence on device (without blocking synchronous turns).
- Maps engine output to presentation components.

Game rules remain in specification modules, not in host UI code.

## Non-goals (architectural)

- Runtime does not require cloud connectivity.
- Runtime does not include authoring, export UI, or graph editing.
- Logical separation does not require a separate application binary—only a clear API boundary.

## Related documents

- [Module specification](./MODULE_SPEC.md)
- [Save specification](./SAVE_SPEC.md)
- [Package specification](./PACKAGE_SPEC.md)
