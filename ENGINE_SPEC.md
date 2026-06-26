# Chronica Studio — Engine Specification

This document defines **Chronica Studio** as a game engine. It is the technical contract for how the engine is structured, what it guarantees, and what it is building toward.

Chronica Studio is a **mobile-first game engine** built around **validated state transitions**. The narrative workflow shipping today is the **first gameplay model** on this foundation—not the whole product. Creators use it to build games; the engine runs those games deterministically on device.

For product vision and phased delivery, see [VISION.md](./VISION.md) and [ROADMAP.md](./ROADMAP.md).

---

## 1. Engine identity

### What Chronica Studio is

- A **mobile-first game engine** for authoring, playtesting, and shipping **state-driven interactive games** on phone and tablet.
- A **touch-first editor** layered on top of the same runtime creators playtest—no separate desktop toolchain required for core workflows.
- A **runtime + editor separation**: game logic, state, validation, and packaging live in a portable engine core; UI shells the engine for editing and play.

### What the narrative module is

The current scene editor, dialogue tools, character/cast system, hotspots, variables, and playtest player are early **gameplay models** on the Phase 1 foundation. They prove that the engine primitives—compiler, runtime, state, assets, and `.chronica` packages—work on mobile. Additional models—such as inventory, quests, and challenge systems—compose on the same core rather than replacing it.

### Engine design principles

These principles guide technical decisions. Violations require explicit justification in spec or roadmap.

1. **The core engine owns execution.** The compiler produces `CompiledGame`; the runtime executes deterministic rules. Gameplay and presentation must not bypass this path.
2. **Gameplay models define rules.** Scenes, choices, inventory, quests, and hotspots express *what can happen* as state transitions and conditions.
3. **Presentation defines appearance.** Player UI, VN chrome, and adventure renderers display engine output; they do not own game rules.
4. **State is authoritative.** `ChronicaState` is the source of truth during play. UI reflects state; it does not substitute for it.
5. **All gameplay is expressed as state transitions**, validated at compile time and executed deterministically at runtime.
6. **New genres extend the engine by adding gameplay models**—not by changing the execution model. Continuous simulation, real-time loops, and physics are out of scope until explicitly adopted as a new execution model.
7. **The engine remains data-driven.** Engine behavior is defined by validated data wherever practical. Engine code executes rules; gameplay models describe them. The compiler lowers authored data (e.g. `goto:forest`, `variables.trust += 1`) into structured execution; the runtime must not parse arbitrary per-genre logic. Future models—dialogue, inventory, quests, hotspots, characters—become data the engine understands, not `if (gameType === "RPG")` branches in core code.

Conceptual capabilities (state engine, action engine) are documentation terms only—not folder names. The repository layout (`engine/`, `runtime/`, `components/`) evolves with architecture; it is not reorganized to match terminology.

See [VISION.md](./VISION.md) for product-level architecture and the decision filter for new features.

### Lineage

Chronica Studio inherits runtime semantics from the **Godot Chronica Engine** (reference implementation). The TypeScript engine in `artifacts/chronica-mobile/engine/` is a deliberate port of those concepts for mobile-native authoring and play. Godot remains the long-form reference; Chronica Studio is the creator-facing, device-native engine.

---

## 2. Core architecture

The mobile app (`artifacts/chronica-mobile`) is organized in layers. **Only `engine/` is the engine**; everything else is host, storage, or presentation.

```
┌─────────────────────────────────────────────────────────┐
│  Presentation (components/PlayerView, player chrome)    │
├─────────────────────────────────────────────────────────┤
│  Editor UI (app/, components/)                          │
│  Touch-first screens: library, scene editor, playtest   │
├─────────────────────────────────────────────────────────┤
│  Host & I/O (context/, storage/, runtime/)              │
│  Persistence, file system, .chronica zip I/O, load flow │
├─────────────────────────────────────────────────────────┤
│  Engine (engine/) — compiler, state, actions, packages  │
└─────────────────────────────────────────────────────────┘
```

### `engine/` — portable core

Pure TypeScript. No React, no Expo, no file-system imports. All modules are unit-tested under `__tests__/`.

| Module | Responsibility |
|--------|----------------|
| `types.ts` | Project, Fragment (scene), Choice, ChronicaState, ProjectAsset, schema version |
| `chronica-session.ts` | Runtime session: initial state, start, choice resolution, serialize/deserialize |
| `fragment-store.ts` | Active fragment selection by location, priority, and conditions |
| `turn-resolver.ts` | Choice and hotspot actions, turn advancement, `applyCompiledInteraction` |
| `hotspots.ts` | Hotspot bounds validation and visibility filtering |
| `action-resolver.ts` | Parsing and execution of choice action strings |
| `expression-evaluator.ts` | Conditions and effects over variables, memory, instability |
| `validator.ts` | Project compiler/validator: broken links, invalid expressions, start location |
| `asset-resolver.ts` | Resolve scene background/audio references to loadable URIs |
| `chronica-package.ts` | `.chronica` manifest, portable story rewrite, import hydration |
| `story-graph.ts` | Read-only graph view over fragments and choice edges |
| `editor-helpers.ts` | Editor-only helpers (unlock chips, variable extraction)—still engine-side, no UI |
| `player-presentation.ts` | Presentation constants (overlay opacity)—player chrome, not game rules |
| `load-game.ts` | Import orchestration types (bytes → project); no I/O |

### Runtime / session

**Playtest and future shipped runtimes** drive games through a small session API:

1. `createInitialState` / `startSession` — enter `startLocation`, apply entry effects, expose first fragment and visible choices.
2. `choose` — apply choice action, resolve next fragment, filter choices by conditions.
3. `serializeState` / `deserializeState` — persist in-progress games.

The session is **deterministic**: given the same project data and choice sequence, the engine produces the same state and fragment sequence. Randomness, if introduced later, must be explicit and seedable.

### Project format

Projects are JSON documents with a top-level **`schemaVersion`** (currently `2`). Core fields:

- **Metadata** — `gameId` (stable across export/import), `id` (local install id), `title`, `description`, timestamps
- **Bootstrap** — `startLocation`, `initialVariables`, `initialMemory`
- **Scenes** — `fragments[]` (locationId, conditions, effects, text, choices, media refs)
- **Assets** — `assets[]` (name, type, uri, mimeType)

Fragments reference media by **asset name** (e.g. `backgroundImage: "forest.jpg"`), not by device-local paths. The asset resolver maps names to URIs at runtime on each device.

Legacy **JSON export** strips `uri` fields for portability. **`.chronica` packages** are the preferred ship format (see below).

### Asset system

- Assets are typed: `image`, `audio`, `data`.
- On device, binary files live under app storage (`pse_assets/<projectId>/`).
- The engine stores **logical names** on scenes; the host layer is responsible for import, copy, and URI assignment.
- `asset-resolver.ts` normalizes `file://`, `content://`, and path-like references for the player UI.

### Package format (`.chronica`)

A `.chronica` file is a **ZIP archive** (stored, uncompressed entries) containing:

| Path | Contents |
|------|----------|
| `manifest.json` | `format: "chronica-package"`, `version`, `app`, `exportedAt`, `title`, `gameId`, `storyContentHash`, `assetsManifest`, `assetCount`, `storySchemaVersion` |
| `story.json` | Full project; asset `uri` fields rewritten to portable `assets/<filename>` paths |
| `assets/*` | Binary copies of referenced image/audio files |

Import extracts `assets/*` to local storage, rebuilds `project.assets` with device-local URIs, and preserves fragment media references unchanged.

Package logic is split: **`engine/chronica-package.ts`** (pure format + hydration) and **`storage/chronica-package-io.ts`** (bytes, zip, file I/O).

### Validation / compiler layer

`validator.ts` is the engine’s static analysis pass over a project before play or export:

- Missing or unreachable start location
- Broken `goto:` targets
- Invalid condition or effect expressions
- Structural consistency

Validation errors are typed (`ValidationError`) so the editor can surface them without re-implementing rules. Over time this layer grows into a fuller **project compiler** (warnings, dead scenes, asset reference integrity).

### Editor UI layer

`app/` and `components/` implement touch-first editing and playtest chrome. They:

- Call engine APIs (`startSession`, `choose`, `validateProject`, package builders)
- Persist projects via `ProjectsContext` and `storage/`
- Must not embed game rules that belong in the engine

Playtest UI (`app/project/[id]/play.tsx`) is a **host runtime shell**, not part of `engine/`. Long-term, player and editor will share the same session API with clearer boundaries.

---

## 3. Engine guarantees

These are commitments the engine core must uphold. Violations are bugs.

| Guarantee | Meaning |
|-----------|---------|
| **Deterministic playtest/runtime** | Same project + same inputs → same state and scene sequence. No hidden UI state in engine rules. |
| **Portable `.chronica` packages** | A package exported on one device can be imported on another; referenced media is included and paths are rewritten. |
| **No UI dependencies in `engine/`** | Engine modules import only other engine modules and standard JS APIs. Testable in Node without React Native. |
| **No local-only asset references in shipped packages** | `story.json` inside a `.chronica` file uses `assets/…` paths, never `file://` or `content://`. |
| **Schema versioning** | Every project carries `schemaVersion`. Host layer migrates on load; engine documents breaking changes. |
| **Separation of reference and resolution** | Scenes reference assets by name; resolution to URIs happens at runtime/import, not in authored content. |

---

## 4. Current supported scope

Phase 1 targets **state-driven interactive games** with branching narrative and light adventure structures:

- **Visual-novel-lite** — full-screen background images, scene text, branching choices, optional BGM per scene.
- **Branching fiction** — location graph, gated scenes (conditions), state mutations (effects), variables and memory flags.
- **Light adventure interactions** — per-scene hotspots and clickable regions trigger compiled actions through the same scene + asset + state model.

Not yet supported as first-class engine features: inventory UI, world maps, real-time input, physics, or 3D.

**Hotspots** (tap regions on scene backgrounds with compiled actions), dialogue, and character/cast data are ✅ gameplay models beyond narrative choices.

---

## 5. Near-term engine priorities

Ordered by foundation impact. These are engine-layer efforts (not app polish alone).

1. **Asset package reliability** — ✅ per-asset CRC manifest, hard export gate, import compile gate, `storyContentHash` + `assetsManifest` verification.
2. **Runtime / player separation** — ✅ `PlayerHost` + `PlayerView` over `CompiledGame`; save gate validates `gameId` + `contentHash` on resume; playtest and Load Game share the same host contract.
3. **Project compiler / validator** — ✅ `compileProject` → `CompiledGame` with fragment index, validation gate on play/export.
4. **Event / action system** — ✅ typed `ActionStep` AST, `parseActionString`, compile-time action validation, runtime executes `choiceActions` only.
5. **Scene object / hotspot system** — ✅ typed `SceneHotspot` on fragments, compiled `hotspotActions`, `activateHotspot` on runtime; presentation via `SceneHotspotOverlay`.
6. **Character / audio layer** — speaker definitions, portrait slots, layered BGM/SFX triggers as engine data, not hard-coded UI.

---

## 6. Explicit non-goals (for now)

Chronica Studio is building engine foundations first. The following are **out of scope** until core runtime, packaging, and scene systems are stable:

- **Not a general-purpose physics engine** — no ambition to compete with Unity or Godot on physics, 3D simulation, or arbitrary game loops in Phase 1–3.
- **Not 3D** — no meshes, cameras, or 3D asset pipeline.
- **Not real-time action** — no frame-based combat, platforming, or twitch gameplay until deterministic scene/state runtime and asset packaging are proven on mobile.
- **Not a writing-only app** — prose export without playable structure is a backup path, not the product definition.
- **Not cloud-required** — engine and projects must remain fully usable offline; sync and marketplace are host concerns, not engine dependencies.

---

## Appendix: repository map (engine-relevant)

| Path | Role |
|------|------|
| `artifacts/chronica-mobile/engine/` | Engine source (this spec’s authority) |
| `artifacts/chronica-mobile/__tests__/` | Engine unit tests |
| `artifacts/chronica-mobile/storage/` | File I/O, zip, package bytes—**not** engine |
| `artifacts/chronica-mobile/context/` | React state, persistence orchestration—**not** engine |
| `artifacts/chronica-mobile/runtime/` | Player host (`PlayerHost`), runtime session (`ChronicaRuntime`), save validation |
| `artifacts/chronica-mobile/components/PlayerView.tsx` | Presentation-only player UI (no editor/game rules) |
| Godot Chronica plugin (reference) | Semantic reference for session, effects, and future parity |
| `artifacts/chronica-mobile/app/` | Expo Router screens (editor + playtest shell) |

---

*Document version: 4 — adds data-driven principle (7); gameplay models terminology.*
