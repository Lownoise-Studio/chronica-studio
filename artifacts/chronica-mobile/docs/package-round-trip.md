# `.chronica` Package Boundary

A `.chronica` file is a **STORE-only ZIP** (no compression) containing exactly:

```
manifest.json     # integrity + identity metadata
story.json        # the authored Project (portable asset paths)
assets/*          # embedded asset files, one per manifest entry
```

Export is produced by `buildChronicaPackageBytes`; import is validated by
`parseChronicaPackage`. The boundary is treated as **untrusted input** — a
package may be corrupt, truncated, partially transferred, hand-edited, foreign,
or hostile. Import never throws a raw exception to a UI caller: every failure
returns a typed `{ ok: false, reason, error }`.

## Required `manifest.json` fields

| Field | Rule |
| --- | --- |
| `format` | Must equal `"chronica-package"`. |
| `version` | Number, within `[CHRONICA_PACKAGE_VERSION_MIN, CHRONICA_PACKAGE_VERSION_MAX]` (currently `1`–`1`). |
| `app` | Must equal `"Chronica Studio"`. |
| `exportedAt` | Non-empty ISO string. |
| `title` | **Optional** — safely defaulted to `"Untitled Story"` if missing/blank. |
| `gameId` | Required, non-empty; must match `story.json.gameId`. |
| `assetCount` | Number; must equal `assetsManifest.length`. |
| `storySchemaVersion` | Number. |
| `storyContentHash` | Required non-empty; FNV-1a 64-bit hash of `story.json` content. |
| `assetsManifest` | Required array of `{ path, size, crc32 }`; no duplicate paths. |

**Unknown future fields are preserved and ignored**, never rejected — this keeps
forward compatibility for packages written by newer builds. Conversely, a legacy
package **missing** an integrity field (e.g. no `storyContentHash` or
`assetsManifest`) is rejected: integrity fields are mandatory.

## `story.json` rules

- `schemaVersion` is a number within `[PACKAGE_SCHEMA_VERSION_MIN, PACKAGE_SCHEMA_VERSION_MAX]`
  (currently `1`–`3`). Newer schemas are rejected as `unsupported-schema-version`.
- `id`, `title`, `gameId` required; `fragments` and `assets` must be arrays.
- After hydration the project must pass `compileProject` — otherwise import fails
  with `compile-failed` and the broken project is **not** installed.

## Integrity rules

1. **ZIP integrity** — `decodeZip` verifies each entry's CRC-32 and size against
   its local header. A truncated or malformed archive fails as `invalid-zip`.
2. **Structure** — exactly one `manifest.json` and one `story.json`; every other
   entry must live under `assets/`. Duplicate paths (case-insensitive), `..`
   path-traversal segments, and unexpected top-level entries are rejected.
3. **Manifest hash** — `storyContentHash` must equal the recomputed hash of the
   imported `story.json`. Both sides use the same algorithm version, so this is a
   pure content-integrity check.
4. **Asset integrity** — every `assetsManifest` entry must exist in the ZIP with
   matching `size` and `crc32`. Every `assets/*` file in the ZIP must be listed
   in the manifest; **unlisted assets are rejected** (the manifest is the source
   of truth).
5. **Reference resolution** — every asset referenced by a scene/character must
   resolve to a hydrated local file after extraction, else `missing-asset`.

## Size limits (`PACKAGE_LIMITS`)

Defensive ceilings checked before/while reading, to stop a hostile package from
exhausting memory or storage before integrity checks run:

| Limit | Default | Failure |
| --- | --- | --- |
| Whole archive | 256 MiB | `oversized-package` |
| Single asset | 64 MiB | `oversized-asset` |
| Asset count | 2000 | `oversized-package` |
| `story.json` | 16 MiB | `oversized-package` |
| `manifest.json` | 4 MiB | `oversized-package` |

The whole-archive check runs first (before decoding), so an oversized package is
rejected without allocating it.

## Typed import failure reasons

`parseChronicaPackage` returns one of these `reason` values on failure:

| Reason | Meaning |
| --- | --- |
| `invalid-zip` | Not a readable ZIP / truncated / CRC or size mismatch in archive. |
| `oversized-package` | Archive, asset count, `story.json`, or `manifest.json` over limit. |
| `oversized-asset` | A single embedded asset over limit. |
| `missing-manifest` / `missing-story` | Required top-level file absent. |
| `duplicate-manifest` / `duplicate-story` | More than one of a required file. |
| `duplicate-asset-path` | Two entries (or manifest entries) collide after normalization. |
| `path-traversal` | An entry path contains a `..` segment. |
| `unexpected-entry` | An entry is not `manifest.json`, `story.json`, or `assets/*`; or an `assets/*` file not listed in the manifest. |
| `invalid-json` | `manifest.json` or `story.json` is not parseable JSON. |
| `invalid-manifest` | Manifest fails field validation. |
| `unsupported-package-version` | Package `version` outside supported range. |
| `invalid-story` | Story fails field validation. |
| `unsupported-schema-version` | Story `schemaVersion` outside supported range. |
| `gameid-mismatch` | `story.gameId` ≠ `manifest.gameId`. |
| `hash-mismatch` | `storyContentHash` ≠ recomputed story hash. |
| `missing-asset` | A listed/referenced asset is absent from the ZIP or unresolved. |
| `corrupt-asset` | Asset size or CRC-32 does not match the manifest. |
| `compile-failed` | Hydrated project does not compile (diagnostics included). |

The human-readable `error` string accompanies every failure for display; UI
callers should surface `error` (and `diagnostics` when present) and may branch on
`reason` for behavior.

## Import pipeline

```
ZIP bytes
  → size guard (oversized-package)
  → decodeZip (invalid-zip)
  → structural validation (missing/duplicate/traversal/unexpected/oversized-*)
  → parse + validate manifest (invalid-json / invalid-manifest / unsupported-package-version)
  → parse + validate story (invalid-story / unsupported-schema-version)
  → gameId check (gameid-mismatch)
  → story hash check (hash-mismatch)
  → unlisted-asset check (unexpected-entry)
  → per-asset size/CRC check (missing-asset / corrupt-asset)
  → extract assets → hydrate → resolve references (missing-asset)
  → migrateProject → compileProject (compile-failed)
  → success
```

## Export guarantees

`buildChronicaPackageBytes` blocks export unless:

- every referenced asset exists in the library and on disk (else a typed export
  diagnostic: `not-in-library` / `empty-uri` / `missing-file`);
- no two assets collapse to the same package path;
- `manifest.assetCount` equals the number of embedded assets;
- `manifest.storyContentHash` equals the hash of the exported `story.json`.

A successfully exported package always round-trips back through
`parseChronicaPackage` → `compileProject` → `ChronicaRuntime`.
