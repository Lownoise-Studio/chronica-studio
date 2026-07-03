# Module Specification

Defines the **Chronica module API** — the portable logic layer that authoring tools and runtimes share. Implementations expose these capabilities through language-specific modules; the contract is behavioral, not a particular folder layout.

## Layering

```
Presentation / Authoring UI
Host & I/O (persistence, package bytes, device files)
Chronica modules (compiler, session, package, validation)
```

Modules **must not** import presentation frameworks (React Native, Godot nodes, Unity MonoBehaviour, etc.).

## Core modules

| Module | Responsibility |
|--------|----------------|
| **Types** | Project, Fragment, Choice, SceneHotspot, StageActor, ChronicaState, ProjectAsset, schema version |
| **Compiler** | `compileProject` → `CompiledGame` with fragment index, action maps, content hash |
| **Validator** | Static analysis: broken links, invalid expressions, missing assets, stage actor bounds |
| **Session** | `startSession`, `choose`, `activateHotspot`, state serialize/deserialize |
| **Turn resolver** | Visible choices/hotspots, action application, fragment transitions |
| **Expression evaluator** | Conditions and effects over variables, memory, and built-in state fields |
| **Action parser** | Parse action strings into typed `ActionStep` sequences |
| **Fragment index** | Resolve active fragment by location, priority, and conditions |
| **Package** | Manifest planning, portable story rewrite, hydration rules |
| **Asset resolver** | Map logical asset names to loadable URIs |
| **Story graph** | Read-only connectivity view (authoring aid; not required at runtime) |
| **Dialogue** | Line indexing, advance rules, exhaustion gating for interactions |

## Compiled game output

`CompiledGame` must include at minimum:

- `gameId`, `contentHash`, `startLocation`
- `initialVariables`, `initialMemory`
- `fragments` (or indexed access)
- `fragmentIndex` — location → priority-sorted candidates
- `choiceActions` — choice uid → compiled steps
- `hotspotActions` — hotspot uid → compiled steps
- `assets`, `characters` catalogs for presentation resolution

## Session API (minimum)

| Operation | Effect |
|-----------|--------|
| `createInitialState` | Bootstrap from start location and initial data |
| `startSession` | Enter game; apply entry effects; return fragment + interactions |
| `choose` | Execute choice actions; advance; return new fragment + interactions |
| `activateHotspot` | Execute hotspot actions; advance; return new fragment + interactions |
| `serializeState` / `deserializeState` | Round-trip runtime state for saves |

## Guarantees

| Guarantee | Meaning |
|-----------|---------|
| **No UI in modules** | Testable in Node or headless environments |
| **Deterministic execution** | No hidden UI state in rules |
| **Data-driven gameplay** | Compiler lowers authored strings to structured steps; runtime executes steps only |
| **Separation of reference and resolution** | Scenes reference assets by name; URIs resolved at import/runtime |

## Gameplay models

Narrative scenes, dialogue, hotspots, stage actors, and variables are **gameplay models** on the core transition system. Future models (inventory, quests, etc.) extend data and compiled output—they do not bypass the session API.

## Related documents

- [Runtime specification](./RUNTIME_SPEC.md)
- [Event specification](./EVENT_SPEC.md)
- [Scene specification](./SCENE_SPEC.md)
