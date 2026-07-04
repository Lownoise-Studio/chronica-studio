# Asset Specification

Defines how **media** is cataloged, referenced, shipped, and resolved at runtime.

Chronica is **asset-source agnostic**. Assets from Meshy, Synty, Blender, Unity, Unreal, or any other toolchain should enter Chronica through **portable formats** — not source-specific runtime coupling.

## Asset record

| Field | Purpose |
|-------|---------|
| `id` | Stable catalog id (must be unique within a project) |
| `name` | Logical filename / reference used by scenes and stage objects |
| `type` | `image`, `audio`, `data`, or `model` |
| `uri` | Implementation-local load path (hydrated after import) |
| `mimeType` | Media type |
| `size` | Byte size |
| `importedAt` | Provenance timestamp |
| `source` | Optional provenance label (e.g. `"Sketchfab"`, `"In-house"`) |
| `license` | Optional license string for packaged assets |
| `previewImageAssetId` | Optional catalog id of a preview image for model thumbnails |

Portable path fields in shipped packages:

- Images, audio, data: `assets/<filename>`
- Models: `assets/models/<filename>`

## Reference rules

- Scenes and characters reference assets by **`name`** (e.g. `backgroundImage: "forest.jpg"`), not by device path.
- Stage objects reference assets by **`name`** for presentation-only editor preview.
- Resolution accepts name, id, uri, or basename matching per implementation rules—**authored packages use names**.
- Shipped `story.json` inside `.chronica` uses portable `assets/...` paths in asset records, never `file://` or `content://`.

## Export

- Every referenced asset must exist and be embedded under `assets/` (or `assets/models/` for model type).
- Manifest lists each path with size and CRC-32.
- Missing assets block export.

## Import

- Extract embedded files to implementation storage.
- Rebuild `uri` fields for the target device.
- Reject packages with unresolved references after hydration.
- Source-specific vendor fields (e.g. `meshyId`, `unityGuid`) are ignored with warnings — only portable asset metadata is consumed.

## URI normalization

Runtimes normalize local paths for loaders:

- `file://` for local files
- Support platform schemes where required (`content://` on Android, etc.)
- Trusted schemes may skip existence probes per implementation policy

## Types

| Type | Typical use |
|------|-------------|
| `image` | Backgrounds, portraits, stage sprites, model preview thumbnails |
| `audio` | Music, ambience, SFX |
| `data` | Opaque blobs (future gameplay models) |
| `model` | Portable 3D assets (presentation/editor metadata; no full 3D gameplay yet) |

## Portable 3D models

**GLB** (`.glb`, `model/gltf-binary`) and **glTF** (`.gltf`, `model/gltf+json`) are the preferred portable 3D formats for Chronica packages.

- Model assets are stored under `assets/models/` in `.chronica` packages.
- Model assets do **not** affect deterministic gameplay or runtime state.
- Until a 3D renderer exists, editors show placeholder cards/thumbnails and optional `previewImageAssetId` images.
- Do not embed Meshy API keys, Unity GUIDs, or other source-specific runtime fields in shipped packages.

### Model preview in the asset library

Chronica Studio provides a **model asset detail panel** in the asset library:

- Shows filename, type, size, source, license, and MIME type
- Displays a linked preview thumbnail when `previewImageAssetId` is set
- Warns when no preview thumbnail is linked
- Offers GLB/glTF import guidance (source-agnostic conversion tips)
- Lets creators import or link a preview image without adding 3D gameplay

## Smart Asset Intake (Phase 3)

Chronica Studio can **classify imported assets at authoring time** and suggest how they might be wired into a project. This is **derived metadata only** — nothing is stored in `ProjectAsset`, save files, or `.chronica` packages unless the creator explicitly edits optional fields (e.g. `source`, `license`, `previewImageAssetId` from Phase 2).

### Classification

Each asset is analyzed from:

- Filename tokens (underscore/hyphen separated)
- File extension and MIME type
- Path-like names (folder segments in zip imports, e.g. `backgrounds/forest.jpg`)

**Categories:** `model`, `character`, `npc`, `player`, `pickup`, `door`, `gate`, `key`, `lantern`, `prop`, `background`, `ambient`, `music`, `sfx`, `ui`, `unknown`.

**Confidence:** `high`, `medium`, or `low`. Low-confidence and `unknown` results show a mild “Needs classification” hint in the asset library. Classification is **optional** — creators can continue without confirming a role.

### Suggested recipes

When confidence is sufficient, Chronica suggests an authoring recipe (not an automatic action):

| Recipe | Typical use |
|--------|-------------|
| `make_pickup` | Inventory item in Gameplay catalog |
| `make_door` | Door or gate hotspot |
| `make_npc` | NPC or stage actor portrait |
| `make_background` | Scene background image |
| `make_ambient` | Scene ambient audio loop |
| `make_music` | Scene music track |
| `make_sfx` | Hotspot or action sound effect |
| `make_ui` | Title, menu, or HUD graphic |
| `none` | No recipe (e.g. generic 3D model) |

### Import report

After batch import, the editor builds a non-blocking **import report**:

- **Detected** — assets with a known category
- **Unknown** — assets that need manual review
- **Warnings** — ambiguous keywords or low-confidence matches
- **Suggested next actions** — grouped recipe hints (informational only)

### Limitations

- Heuristic filename/path matching only — no AI, Meshy API, or 3D mesh analysis
- Does not mutate projects, compile output, or runtime behavior
- Does not replace the model detail panel (Phase 2)
- Recipes are suggestions; wiring into gameplay catalogs or scenes remains manual

## Apply suggested asset recipes (Phase 4)

Phase 4 turns Smart Asset Intake **suggestions into editable authoring changes** in the project editor.

### Planning before apply

`planAssetRecipeApplication(project, assetId, recipe)` returns a **non-destructive change plan**:

- Human-readable preview lines (inventory item, hotspot, stage object, adventure interactable, etc.)
- Target scene (defaults to the start location scene)
- **Conflicts** when an existing background, audio, or SFX slot would be replaced
- `requiresManualConfirmation` for low-confidence / unknown classifications
- `canApply` only when overwrite and confidence confirmations are satisfied

`applyAssetRecipe(...)` merges the plan into a project copy using existing gameplay template helpers where appropriate.

### Supported recipes

| Recipe | Creates / links |
|--------|------------------|
| `make_pickup` | Inventory item, collect hotspot, stage prop, optional adventure pickup |
| `make_door` | Unlocked door hotspot (`locked=false`), stage prop, optional adventure door |
| `make_npc` | NPC profile, stage actor, talk hotspot, optional adventure NPC + dialogue hook |
| `make_background` | `backgroundImage` + stage backdrop object |
| `make_ambient` / `make_music` | `backgroundAudio` assignment |
| `make_sfx` | `adventure.sfx.*` override when the scene has adventure data |
| `make_ui` | Stage object on `ui-guides` layer |

### Safety

- Never silently overwrites existing background/audio/SFX assignments — requires explicit overwrite confirmation
- Low-confidence classifications require an additional manual confirmation toggle
- Adds new catalog entries and scene objects; does not delete existing configured objects
- All generated labels, actions, and placements remain editable in scene / gameplay editors

### Limitations

- Does not invoke external APIs or auto-run playtests
- `make_sfx` requires an existing `fragment.adventure` layer
- Ambient and music share the single `backgroundAudio` field today

## Playable room generator (Phase 5)

Phase 5 adds a **one-click playable room generator** that assembles a Harbor-style adventure scene from classified project assets.

### Entry points

- Asset library header: **Generate playable room**
- Uses Smart Asset Intake classification to pick background, player, NPC, pickup, gate/door, ambient, and SFX assets

### Planning

`planPlayableRoomFromAssets(project, options)` returns:

- Selected assets (with placeholders when optional types are missing)
- Preview lines for spawn point, interactables, colliders, audio, and SFX
- Overwrite conflicts when a target scene already has adventure/background/audio data
- Toggle options: NPC, pickup, locked gate, ambient, SFX, create-new-scene, set-as-start

`generatePlayableRoomFromAssets(...)` applies the plan after confirmations.

### Generated demo flow

The default layout mirrors the Harbor Lantern pattern:

1. Player spawns at `(0.18, 0.78)`
2. NPC talk interaction sets met flags
3. Pickup appears after talking to the NPC (when both toggles enabled)
4. Locked gate blocks until pickup is collected (optional toggle)
5. Open gate interaction after pickup
6. Ambient loop on `backgroundAudio`
7. Basic `adventure.sfx` mapping when SFX assets match

All interactables, colliders, catalog entries, and stage objects remain editable after generation.

### Safety

- Does not overwrite existing adventure/background/audio without explicit confirmation
- Missing asset types use safe placeholders (no sprite / generic labels)
- Creates a new scene by default to avoid clobbering authored content

### Engine modules

| Module | Role |
|--------|------|
| `engine/asset-intake.ts` | Import classification and suggested recipes |
| `engine/asset-recipes.ts` | Recipe planning and apply |
| `engine/playable-room-generator.ts` | Playable room planning and apply |
| `engine/model-assets.ts` | Model asset validation |
| `engine/asset-contracts.ts` | Asset identity and reference contracts |
| `engine/editor-mutations.ts` | Transactional recipe/room/delete mutations |

## Foundation hardening

See [Foundation Hardening](./FOUNDATION_HARDENING.md) for adventure invariant checks, project integrity reports, deterministic authoring ids, asset reference safety scans, and save/load regression expectations. See [Engine Contracts](./ENGINE_CONTRACTS.md) for runtime, asset, recipe, package, and determinism guarantees.

## Related documents

- [Package specification](./PACKAGE_SPEC.md)
- [Rendering specification](./RENDERING_SPEC.md)
