# Asset Specification

Defines how **media** is cataloged, referenced, shipped, and resolved at runtime.

## Asset record

| Field | Purpose |
|-------|---------|
| `id` | Stable catalog id |
| `name` | Logical reference used by scenes and characters |
| `type` | `image`, `audio`, or `data` |
| `uri` | Implementation-local load path (hydrated after import) |
| `mimeType` | Media type |
| `size` | Byte size |
| `importedAt` | Provenance timestamp |

## Reference rules

- Scenes and characters reference assets by **`name`** (e.g. `backgroundImage: "forest.jpg"`), not by device path.
- Resolution accepts name, id, uri, or basename matching per implementation rules—**authored packages use names**.
- Shipped `story.json` inside `.chronica` uses portable `assets/<filename>` paths in asset records, never `file://` or `content://`.

## Export

- Every referenced asset must exist and be embedded under `assets/`.
- Manifest lists each path with size and CRC-32.
- Missing assets block export.

## Import

- Extract embedded files to implementation storage.
- Rebuild `uri` fields for the target device.
- Reject packages with unresolved references after hydration.

## URI normalization

Runtimes normalize local paths for loaders:

- `file://` for local files
- Support platform schemes where required (`content://` on Android, etc.)
- Trusted schemes may skip existence probes per implementation policy

## Types

| Type | Typical use |
|------|-------------|
| `image` | Backgrounds, portraits, stage sprites |
| `audio` | Music, ambience, SFX |
| `data` | Opaque blobs (future gameplay models) |

## Related documents

- [Package specification](./PACKAGE_SPEC.md)
- [Rendering specification](./RENDERING_SPEC.md)
