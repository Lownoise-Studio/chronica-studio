# Chronica Studio — Runtime Specification

This document defines the boundary between **Chronica Studio Editor** (authoring) and **Chronica Runtime / Player** (playing packaged games).

The runtime is the part of Chronica that **runs games**. It must be conceptually independent of editor screens, even when both currently ship inside the same mobile app. This spec does **not** require splitting into a second app today—it defines the separation so future code can move safely.

Related documents: [ENGINE_SPEC.md](./ENGINE_SPEC.md), [VISION.md](./VISION.md), [ROADMAP.md](./ROADMAP.md).

---

## 1. Runtime purpose

The **Chronica Runtime** (also called the **Player**) is responsible for:

- Loading a **compiled, validated game** (typically a `.chronica` package or an equivalent in-memory `Project` with hydrated assets).
- Driving **deterministic game logic**: session state, scene resolution, choice filtering, action execution.
- **Presenting** the current scene to the player: text, backgrounds, audio, and (eventually) characters, hotspots, and inventory UI.
- **Persisting and restoring** in-progress play via save data derived from runtime state—not editor state.

The runtime **must not depend** on editor routes, scene editors, graph layout, validation panels, or project-management UI. It consumes **shippable project data + local asset files** and exposes a small session API. Presentation (React Native views, Expo Image, audio playback) wraps that API; it does not replace it.

Today, playtest (`app/project/[id]/play.tsx`) is an **editor-hosted runtime shell**, and **Chronica Player** (`app/player/index.tsx`, `EXPO_PUBLIC_CHRONICA_APP_MODE=player`) is the standalone shell—both call the same `PlayerHost` / `PlayerView` stack. See [docs/runtime-integration.md](./docs/runtime-integration.md).

---

## 2. Editor vs Runtime boundary

```
┌──────────────────────────────────────────────────────────────────┐
│                     CHRONICA STUDIO EDITOR                        │
│  Library · Scene editor · Assets · Graph · Export · Validation   │
│  Creates and mutates Project data; never required during play    │
└───────────────────────────────┬──────────────────────────────────┘
                                │ shippable output
                                ▼
                    ┌───────────────────────┐
                    │   .chronica package   │
                    │  (or validated Project)│
                    └───────────┬───────────┘
                                │ load + hydrate
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                     CHRONICA RUNTIME / PLAYER                     │
│  Load package · Session · Choices · Scene output · Saves         │
│  No editing; no graph; no compiler UI                            │
└──────────────────────────────────────────────────────────────────┘
```

### Editor responsibilities

The editor **authors** games. It owns everything that mutates or inspects project source during development:

| Area | Responsibility |
|------|----------------|
| **Scenes** | Create, rename, edit fragment/scene content (text, conditions, effects, media refs) |
| **Choices** | Edit labels, actions, choice-level conditions, linking between scenes |
| **Assets** | Import, preview, delete; assign asset names to scenes |
| **Graph view** | Read-only (or future layout) visualization of scene connectivity—editor affordance |
| **Validation / compiler** | Run `validateProject`, surface errors, block or warn before export/play |
| **Package export** | Build `.chronica` (manifest + story + embedded assets) and legacy JSON backup |
| **Project library** | List, duplicate, delete projects; onboarding; metadata editing |
| **Advanced / debug UI** | Raw IDs, expression syntax, debug state panels—creator tools only |

The editor **may** embed a runtime for **playtest**, but playtest must call the same session API a standalone player would use—not duplicate game rules in UI code.

### Runtime responsibilities

The runtime **plays** games. It owns everything needed from “game loaded” through “session ended or saved”:

| Area | Responsibility |
|------|----------------|
| **Load game package** | Parse `.chronica`, validate manifest/story, extract assets, hydrate local URIs |
| **Start / resume session** | Bootstrap `ChronicaState`, enter start scene, or restore from save |
| **Resolve choices / actions** | Apply choice actions, run entry effects, advance location |
| **Scene output** | Resolve current fragment, visible choices, and presentation inputs (background URI, audio URI, text) |
| **Show assets** | Resolve asset names to loadable URIs; host layer renders images/audio |
| **Save state** | Serialize runtime state (location, variables, memory, instability)—not editor undo or graph positions |
| **Deterministic logic** | All branching and state mutation via `engine/` session and resolver modules |

The runtime **must not** write back to authored project source (fragments, choices) during normal play. Saves are **runtime snapshots**, not project edits.

### Where the boundary lives today (reference)

| Layer | Path | Editor | Runtime |
|-------|------|--------|---------|
| Engine session API | `engine/chronica-session.ts`, `turn-resolver.ts`, `fragment-store.ts` | — | ✓ |
| Asset resolution | `engine/asset-resolver.ts` | — | ✓ |
| Package format (pure) | `engine/chronica-package.ts` | export/import rules | load/hydrate rules |
| Package I/O | `storage/chronica-package-io.ts` | export bytes | import bytes |
| Validator | `engine/validator.ts` | ✓ primary consumer | optional pre-flight |
| Editor helpers | `engine/editor-helpers.ts` | ✓ | ✗ |
| Story graph | `engine/story-graph.ts` | ✓ | ✗ |
| Playtest UI | `app/project/[id]/play.tsx` | compile gate, routing | thin shell over `PlayerView` |
| Player presentation | `components/PlayerView.tsx`, `components/player/useSceneAudio.ts` | — | ✓ |
| Player host | `runtime/player-host.ts`, `hooks/useChronicaRuntime.ts` | — | ✓ |
| Load Game | `storage/load-game.ts`, Library screen | entry point | entry point → same `PlayerHost` via play screen |

---

## 3. Package contract

The **`.chronica` package** is the canonical ship format between editor and runtime.

### Structure

ZIP archive (stored entries) containing:

| Entry | Required | Purpose |
|-------|----------|---------|
| `manifest.json` | Yes | Package metadata: `format`, `version`, `app`, `exportedAt`, `title`, `assetCount`, `storySchemaVersion` |
| `story.json` | Yes | Full game project document |
| `assets/*` | When referenced | Binary image/audio files copied at export time |

### Rules

1. **No local device paths in packages** — `story.json` asset records use portable paths (`assets/<filename>`), never `file://`, `content://`, or absolute paths.
2. **Scene media refs stay logical** — fragments use asset **names** in `backgroundImage` / `backgroundAudio`; same on export and import.
3. **Hydration on import** — runtime host extracts `assets/*` to app storage and rebuilds `project.assets[].uri` with valid local URIs before play.
4. **Schema versioning** — `story.json` includes `schemaVersion`; `manifest.storySchemaVersion` mirrors it. Host layer runs migrations on load; runtime consumes migrated shape only.
5. **Validation before play** — runtime should refuse or degrade gracefully on invalid packages (missing manifest, corrupt zip, checksum failure). Editor validates before export; runtime validates on import.

Legacy **JSON-only export** (URIs stripped) is a **backup**, not a complete ship format—runtime may load story text but cannot guarantee assets until a `.chronica` package is provided.

---

## 4. Runtime API concept

The runtime exposes a **session-oriented API** through `PlayerHost`, backed by `ChronicaRuntime` and a compiled `CompiledGame`.

### Compile gate (editor + player entry)

| API | Intent | Implementation |
|-----|--------|----------------|
| `compileProject(project)` | Validate + build `CompiledGame` | `engine/compiler/compile-project.ts` |
| `PlayerHost.create(game)` | Orchestration over runtime session | `runtime/player-host.ts` |
| `useChronicaRuntime(project)` | React hook: compile → host → snapshot | `hooks/useChronicaRuntime.ts` |

### Package loading

| API | Intent | Current implementation (reference) |
|-----|--------|----------------------------------|
| `loadGamePackage(bytes)` | Parse `.chronica`, validate, extract assets, return playable `Project` | `parseChronicaPackage()` in `storage/chronica-package-io.ts`; `loadGameFromBytes()` in `engine/load-game.ts` |
| `isGamePackage(bytes)` | Detect `.chronica` vs plain JSON | `isChronicaPackageBytes()` in `engine/chronica-package.ts` |

Import validates `manifest.gameId === story.gameId` and, when present, `manifest.storyContentHash` against authored story content.

### Session lifecycle

| API | Intent | Current implementation (reference) |
|-----|--------|----------------------------------|
| `PlayerHost.startNew()` | New game from `startLocation`, apply entry effects | `ChronicaRuntime.start()` → `startSession()` |
| `PlayerHost.tryResume(save)` | Validate save, restore `ChronicaState`, resolve scene + choices | `validateRuntimeSave()` + `ChronicaRuntime.tryResume()` |
| `PlayerHost.snapshot()` | Fragment, choices, URIs, state for UI | `runtime/player-host.ts` |
| `getRuntimeState()` | Current `ChronicaState` | `snapshot().state`; `serializeState()` for persistence |

### Turn loop

| API | Intent | Current implementation (reference) |
|-----|--------|----------------------------------|
| `PlayerHost.choose(choice)` | Apply compiled choice actions, advance state | `ChronicaRuntime.choose()` → `engine/chronica-session.ts` |
| `getCurrentScene()` | Active fragment for current location/state | `snapshot().fragment` via `getActiveFragmentFromIndex()` |
| `PlayerHost.activateHotspot(hotspot)` | Apply compiled hotspot actions, advance state | `ChronicaRuntime.activateHotspot()` |
| `getVisibleHotspots()` | Hotspots passing condition checks on current fragment | `snapshot().visibleHotspots` |

### Presentation inputs (runtime host, not game rules)

The engine returns **data**; the host **renders** it:

| Input | Source |
|-------|--------|
| Scene text | `fragment.text` |
| Background image URI | `resolveSceneBackgroundUri(assets, fragment.backgroundImage)` |
| Background audio URI | `resolveSceneAudioUri(assets, fragment.backgroundAudio)` |
| Choice labels | `visibleChoices[].label` |
| Hotspot regions | `visibleHotspots[]` (normalized bounds + label); presentation hit-tests and calls `activateHotspot` |

Future APIs (`getHotspots()`, `getPortrait()`, `getInventory()`) should follow the same pattern: engine resolves shippable data; host draws it.

### Save format

`RuntimeSave` (see `runtime/chronica-runtime.ts`) contains **session state only**:

- `projectId` — local install id (`CompiledGame.installId`)
- `gameId` — stable game identity; must match `CompiledGame.gameId` on resume
- `contentHash` — authored content fingerprint; must match `CompiledGame.contentHash` on resume
- Serialized `ChronicaState` (`location`, `variables`, `memory`, `instability`, `reality_layer`)
- `history` — optional path metadata for UI
- `savedAt` — ISO timestamp

`validateRuntimeSave()` rejects saves when `gameId` or `contentHash` do not match the current compiled game (`wrong-game`, `stale-content`, `corrupt-state`). Storage key remains `pse_save_<projectId>` for Phase 1.

They must **not** include fragment definitions, asset binaries, or editor layout.

---

## 5. Editor-only data vs shippable data

### Must ship (in `.chronica` / runtime `Project`)

| Data | Notes |
|------|-------|
| `schemaVersion` | Migration key |
| `manifest.json` | Package metadata (`.chronica` only) |
| Scenes / fragments | `locationId`, `title`, text, conditions, effects, choices, media refs |
| Choices | `label`, `action`, `conditions`, stable `uid` |
| Variables bootstrap | `initialVariables`, `initialMemory`, `startLocation` |
| Assets | Embedded files + catalog entries (name, type, mimeType; hydrated `uri` after import) |
| Project metadata | `title`, `description` (for player title screen) |

### Must not ship

| Data | Reason |
|------|--------|
| Editor UI state | Scroll positions, open tabs, draft unsaved fields |
| Debug panels | Advanced mode inspector, raw state dumps for creators |
| Graph layout cache | Node positions, zoom, selection—unless explicitly added to schema for editor round-trip only (never required for play) |
| Validation error cache | Recomputed on load in editor |
| Dev / toolchain metadata | Replit, Cursor, `.agents/`, CI configs, mockup sandboxes |
| Local-only file paths | `file://`, `content://`, absolute paths in exported `story.json` |
| Library bookkeeping | Project list order, onboarding flags, duplicate internal ids from other projects |
| Playtest-only flags | e.g. `loaded=1` navigation params, “Game loaded” banners |

### JSON backup export (legacy)

Story structure ships; **asset URIs are stripped**. Runtime can load text and logic but **cannot** guarantee visuals until assets are re-imported or a `.chronica` package is used.

---

## 6. Future importance

New game systems must be designed **against the runtime boundary** from the start—not as editor-only features bolted onto playtest.

| Future system | Runtime-facing design |
|---------------|----------------------|
| **Hotspots** | ✅ Shippable `SceneHotspot` on fragments; compiled `hotspotActions`; `activateHotspot` on runtime; `SceneHotspotOverlay` for presentation |
| **Character portraits** | Shippable character catalog + expression keys; runtime resolves sprite URI per dialogue line |
| **Audio layers** | BGM/SFX triggers as scene or choice data; runtime owns playback lifecycle |
| **Inventory** | Items in `ChronicaState` or shippable item defs; runtime `useItem` / `hasItem` API |
| **Quests / objectives** | State flags + shippable quest graph; runtime tracks progress, editor authors defs |
| **RPG systems** | Stats and checks as variables/effects today; future typed modules still serialize into runtime state |

**Rule:** If a player needs it mid-game, it must be representable in **package + runtime state + session API**. If only a creator needs it while editing, it stays in the **editor**.

---

## 7. Non-goal (for now)

- **Do not split into a second app yet.** Editor and runtime may coexist in `artifacts/chronica-mobile`; separation is logical and architectural first.
- **Do not duplicate game logic in UI.** Playtest screens must thin-wrap the session API.
- **Do not require cloud** for runtime load or save.
- **Do not expand runtime scope** into authoring, validation UI, or export—those remain editor responsibilities.

When extraction happens, the expected move is:

1. `engine/` — unchanged pure core (already shared).
2. **Runtime host** — package load, session loop, save I/O, presentation adapters.
3. **Editor app** — depends on engine + optional embedded runtime for playtest.

---

## Summary

| | Editor | Runtime |
|---|--------|---------|
| **Purpose** | Author and package games | Play packaged games |
| **Input** | Creator actions, imports | `.chronica` / validated `Project` |
| **Output** | Packages, validation feedback | Scene presentation, saves |
| **State mutated** | Project source | `ChronicaState` only |
| **Depends on** | Engine + storage + UI | Engine + storage (load/assets) + presentation |

The contract between them is **`.chronica` + schemaVersion + session API**. Everything else is implementation detail that should migrate behind that boundary over time.

---

*Document version: 1 — aligns with project `schemaVersion: 1` and `.chronica` package `version: 1`.*
