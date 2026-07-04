# Stage Authoring

Chronica Mobile Studio scenes can be composed visually in the editor while gameplay remains deterministic through existing hotspots, stage actors, variables, and memory flags.

## Phases

| Phase | Scope | Runtime impact |
|-------|-------|----------------|
| **Phase 1 — Authoring composition** | Layers, stage objects, lighting presets, camera guides | None — editor metadata only |
| **Phase 2 — Presentation preview** | Visual preview in scene editor and optional playtest overlay | None — hotspots remain the interaction source |
| **Phase 3 — Asset placement polish** | Asset picker, transform handles, inspector, scene presets | None — editor UX only |

Gameplay stays deterministic through **hotspots**, **actions**, and **state**. Stage objects are never compiled into `CompiledGame`.

## Editor-only vs runtime

| Concept | Runtime? | Notes |
|---------|----------|-------|
| **Stage layers** | No | Background, foreground, props, effects, lighting, UI guides |
| **Stage objects** | No | Visual placement metadata on `Fragment.stageAuthoring` |
| **Model assets** | No | Portable GLB/glTF in `assets/models/`; presentation-only in editor |
| **Presentation transitions** | No | Fade/slide/zoom metadata for editor preview |
| **Playtest presentation overlay** | No | Optional decorative layer in playtest; `pointerEvents: none` |
| **Lighting presets** | No | Morning/day/sunset/night/indoor/cave tints in the editor canvas |
| **Camera guides** | No | Safe area, aspect, center, rule-of-thirds overlays |
| **Hotspots** | Yes | Existing interaction regions and action grammar |
| **Stage actors** | Yes | Existing runtime sprites with gameplay state |

There is **no runtime concept** called `StageObject` or `StageComposition`. The compiler strips `stageAuthoring` before building `CompiledGame` and before computing `contentHash`, so visual-only edits do not change runtime output or stale-save gates.

## Scene layers

Objects are tagged with one of:

- **Background** — distant scenery props
- **Props** — interactive-adjacent set dressing
- **Foreground** — near-camera elements
- **Effects** — particles, glows, overlays (authoring metadata)
- **Lighting** — editor lighting helpers
- **UI Guides** — non-exported editor overlays

Layers control draw order in the **Stage composition** panel and presentation preview.

## Stage objects

Each object stores:

- Asset name (from project library — images or portable GLB/glTF models)
- Position (`x`, `y` in 0–1 coordinates)
- Scale and rotation
- Layer and optional `zIndex`
- Optional `visibleWhen` conditions (evaluated in preview when state is available)
- Optional `hotspotRef` linking a hotspot uid for visual cross-reference
- Optional `presentation.enter` / `presentation.exit` transition metadata (editor only)

Gameplay interactions still flow through **hotspots** and **stage actors**. Stage objects are composition and preview aids.

### Model assets (presentation-only)

Stage objects may reference **model** assets (`.glb` / `.gltf`) from the project library. Chronica is source-agnostic — export from Blender, Synty, Unity, Unreal, or other tools into portable glTF, then import into Chronica.

- Models are packaged under `assets/models/`
- The editor shows a placeholder card or optional `previewImageAssetId` thumbnail
- No 3D renderer or gameplay hit testing is added in this phase
- Model references do not affect compiler output or runtime state

## Phase 2 — Presentation preview

### Stage preview renderer

The scene editor canvas renders `stageAuthoring` objects via `StagePreviewRenderer`:

- Respects layer order and z-index
- Respects hidden/locked state (hidden objects omitted from playtest overlay; editor can show them)
- Applies position, scale, and rotation
- Evaluates `visibleWhen` against preview state when available
- Draws hotspot link indicators when a stage object has `hotspotRef`

### Playtest presentation overlay

In playtest mode, an optional overlay shows the same visuals without affecting gameplay:

- Toggle per scene: **Show presentation overlay in playtest** (default on when objects exist)
- Overlay uses `pointerEvents: none` — hotspots and adventure interactables keep hit testing
- `stageAuthoring` is read from the project fragment, not from `CompiledGame`

### Object ↔ hotspot links

Selecting a linked stage object highlights its hotspot and surfaces the link in the inspector. Selecting a linked hotspot selects the corresponding stage object when available.

## Phase 3 — Asset placement polish

### Asset picker

Open **Assets** in the stage toolbar to browse project assets with thumbnails. Filter by type (all, images, audio, data) and search by name. Selecting an asset inserts a new stage object at the scene center.

### Transform handles

Selected objects show drag, scale, and rotate handles on the canvas:

- Drag the object body to move (respects snap grid when enabled)
- Drag the bottom-right handle to scale
- Drag the top rotate handle to adjust rotation
- Tap empty canvas to place a new object when an image asset exists

Toolbar actions: duplicate, delete, lock, hide, forward/back, align.

**Web keyboard shortcuts:** arrow keys nudge, ⌘/Ctrl+D duplicate, Delete/Backspace remove, G toggle snap, `[` / `]` send backward/forward.

### Object inspector

The selected-object inspector includes:

- Asset preview thumbnail
- Position, scale, and rotation fields
- Layer dropdown
- Visibility condition editor
- Hotspot link selector
- Enter transition picker

### Scene presets

Quick-add presets merge editor-only objects and guides into the current composition:

- **Background image scene** — backdrop object + safe area
- **Dialogue scene** — side framing props + indoor lighting
- **Exploration scene** — scattered props + rule-of-thirds guides
- **Locked door scene** — door prop placement
- **Item pickup scene** — centered pickup prop

Presets use the first project image asset when available.

## Stage composition tools

The scene editor **Stage composition** section supports:

- Asset picker with thumbnails and type filter
- Drag / scale / rotate handles on canvas
- Scene presets (background, dialogue, exploration, door, pickup)
- Duplicate / delete selected object
- Snap grid (default 0.05)
- Align selected objects
- Bring forward / send backward (layer + z-index)
- Lock / hide objects in the editor
- Hotspot link picker and enter transition picker
- Playtest overlay toggle
- Multi-select in the object list
- Lighting preset picker
- Camera guide toggles

## Scene inspector

The **Scene inspector** panel summarizes:

- Stage objects
- Hotspots
- Stage actors
- Selected object ↔ hotspot links
- Gameplay catalog references (inventory, objectives, world flags)
- Variables referenced in scene strings
- Objective and inventory references

## Where to author

| Surface | Path |
|---------|------|
| Stage composition | Scene editor → **Stage composition** |
| Scene inspector | Scene editor → **Scene inspector** |
| Gameplay interactions | Scene editor → Hotspots / Stage actors |

## Helpers

- `engine/stage-authoring.ts` — layer ordering, snap/align, inspector summaries, compile stripping helper
- `engine/model-assets.ts` — portable model paths, validation, package asset collection
- `engine/asset-resolver.ts` — stage object presentation URIs and model preview thumbnails
- `engine/stage-presentation.ts` — render order, visibility, hotspot links, presentation styles, playtest overlay helpers
- `engine/stage-placement.ts` — asset insert, transforms, hotspot ref helpers, scene presets
- `components/stage/StageComposer.tsx` — visual composition UI
- `components/stage/StageAssetPicker.tsx` — thumbnail asset browser
- `components/stage/StageEditorHandles.tsx` — canvas transform handles
- `components/stage/StageObjectInspector.tsx` — selected object inspector
- `components/stage/StagePreviewRenderer.tsx` — shared editor/playtest renderer
- `components/stage/StagePresentationOverlay.tsx` — playtest-only overlay wrapper
- `components/stage/SceneInspectorPanel.tsx` — scene overview panel

## Relationship to gameplay systems

Stage composition complements **Gameplay Components** and **Gameplay Templates**:

1. Insert gameplay via components/templates (hotspots, actors, catalogs)
2. Compose the scene visually with stage objects and link props to hotspots
3. Preview in the editor or playtest overlay — runtime executes hotspots/actions only

Future phases may mirror select stage objects into runtime presentation without changing the deterministic state model.
