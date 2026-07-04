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

## Related documents

- [Package specification](./PACKAGE_SPEC.md)
- [Rendering specification](./RENDERING_SPEC.md)
