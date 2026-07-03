# Package Specification

Defines the **`.chronica` package** — the canonical portable format for shipping Chronica games between authoring tools and runtimes.

## Archive structure

A `.chronica` file is a **ZIP archive** (stored, uncompressed entries) containing:

| Path | Required | Contents |
|------|----------|----------|
| `manifest.json` | Yes | Package identity and integrity metadata |
| `story.json` | Yes | Full project document (portable asset paths) |
| `assets/*` | When referenced | Embedded binary media |

No other top-level entries are permitted. Every file under `assets/` must be listed in the manifest asset manifest.

## Manifest fields

| Field | Rule |
|-------|------|
| `format` | Must equal `"chronica-package"`. |
| `version` | Package format version (currently `1`). |
| `app` | Exporting application identifier. |
| `exportedAt` | Non-empty ISO timestamp. |
| `title` | Human-readable title (default `"Untitled Story"` if blank). |
| `gameId` | Stable game identity; must match `story.json.gameId`. |
| `assetCount` | Must equal `assetsManifest.length`. |
| `storySchemaVersion` | Mirrors `story.json.schemaVersion`. |
| `storyContentHash` | Required content fingerprint of `story.json`. |
| `assetsManifest` | Required array of `{ path, size, crc32 }`; no duplicate paths. |

Unknown manifest fields are **preserved and ignored** on import (forward compatibility). Missing integrity fields are **rejected** (no legacy import without hash/manifest).

## Story document rules

- `schemaVersion` within **known** bounds (`1`–`3` in the mobile implementation).
- **Compat ingest** treats v1–v2 as fully enabled and v3 as **known-limited** (warning + `limited` compatibility) until the ingest path declares full v3 parity.
- The **ZIP importer** accepts all known schema versions and migrates on load.
- `gameId`, `id`, `title`, `fragments`, and `assets` required.
- Asset records in shipped packages use portable paths (`assets/<filename>`), never device-local URIs.

## Integrity

1. **ZIP entry integrity** — CRC-32 and size per entry.
2. **Story hash** — `storyContentHash` must match recomputed hash of imported `story.json`.
3. **Asset manifest** — every listed asset must exist with matching size and CRC-32; unlisted `assets/*` entries are rejected.
4. **Reference resolution** — after hydration, every scene/character reference must resolve to a local file.

## Import behavior

1. Validate structure and sizes (defensive limits before full decode).
2. Parse and validate manifest and story.
3. Extract `assets/*` to implementation-defined local storage.
4. Rebuild asset URIs for the target device.
5. Migrate project schema if needed.
6. Compile project — import fails if story does not compile.

Import must return typed failures (`reason` + message), never throw raw exceptions to UI callers.

## Export behavior

1. Validate project compiles.
2. Verify all referenced assets exist on disk.
3. Rewrite asset URIs to portable `assets/` paths in `story.json`.
4. Embed asset binaries and build `assetsManifest`.
5. Compute `storyContentHash` and write manifest.

## Size limits (defensive)

Implementations may enforce ceilings (example defaults in mobile: 256 MiB package, 64 MiB single asset, 2000 assets). Oversized packages fail before unbounded allocation.

## Related documents

- [Detailed import/export rules](../package-round-trip.md)
- [Asset specification](./ASSET_SPEC.md)
- [Compatibility specification](./COMPATIBILITY_SPEC.md)
