# Save Specification

Defines the **runtime save** format and resume rules. Saves capture session progress—not authored project source.

Compliant implementations serialize in-progress play to a logical envelope, validate identity on resume, restore core state, and optionally restore module-owned payloads. Physical storage (files, key-value stores, cloud sync) is implementation-defined; the **logical format** below is what must round-trip across compliant runtimes for the same compiled game.

---

## Canonical save envelope (v2)

The canonical save format is **envelope version 2**. All new saves from compliant implementations should emit this shape.

```json
{
  "formatVersion": 2,
  "projectId": "local-install-id",
  "gameId": "stable-game-id",
  "contentHash": "authored-content-fingerprint",
  "savedAt": "2026-06-22T12:00:00.000Z",
  "state": { },
  "history": [ ],
  "fragmentId": "optional-fragment-uid",
  "modules": [ ]
}
```

### Envelope fields

| Field | Required | Type | Purpose |
|-------|----------|------|---------|
| `formatVersion` | yes | number | Envelope version. Canonical saves use `2`. |
| `projectId` | yes | string | Local install identifier on the saving device. Used by hosts to locate storage slots; not a portable game identity. |
| `gameId` | yes | string | Stable game identity. Must match the compiled game's `gameId` on resume. |
| `contentHash` | yes | string | Authored content fingerprint at compile time. Must match the compiled game's `contentHash` on resume. |
| `savedAt` | yes | string | ISO 8601 timestamp when the save was written. |
| `state` | yes | object | Serialized runtime state (see [Serialized state](#serialized-state)). |
| `history` | no | array | Optional path metadata for player UI (`locationId`, `title` entries). |
| `fragmentId` | no | string | Optional hint to the fragment active when the save was written. **Not authoritative**—resume always re-resolves the active fragment from `state.location` and authored conditions. |
| `modules` | no | array | Optional module payloads (see [Module save entries](#module-save-entries)). |

JSON field names may use snake_case equivalents (e.g. `format_version`) when ingesting saves from other Chronica implementations; normalizers should map them to the canonical names above.

---

## Module save entries

When gameplay modules are attached, each module may contribute an opaque runtime payload. The canonical shape is an **array** of entries:

```typescript
interface ModuleSaveEntry {
  id: string;       // stable module identifier (e.g. "chronica.instability")
  config?: unknown; // optional registry config, reapplied before data load
  data: unknown;    // opaque runtime payload from the module's save hook
}
```

| Field | Required | Purpose |
|-------|----------|---------|
| `id` | yes | Stable module identifier. Same value used at registration and as the save key in legacy record-shaped formats. |
| `config` | no | Module registry configuration. On resume, implementations apply `config` **before** passing `data` to the module load hook. |
| `data` | yes | Module runtime state. Shape is opaque to the core runtime; each module owns its internal versioning inside `data`. |

Implementations that persist modules as a record keyed by id (legacy compat shape) must normalize to this array on read.

---

## Serialized state

Minimum `ChronicaState` fields:

| Field | Type | Purpose |
|-------|------|---------|
| `location` | string | Current location id |
| `variables` | object | Game variables |
| `memory` | object | Persistent memory flags/values |
| `instability` | number | Built-in scalar (legacy compatibility) |
| `reality_layer` | number | Built-in scalar (legacy compatibility) |
| `dialogueLineIndex` | number | Current dialogue line within fragment |

Implementations may extend state only through specification amendments—not ad hoc UI fields.

---

## Resume rules

On resume, compliant implementations follow this order:

1. **Validate identity** — reject saves whose `gameId` or `contentHash` do not match the loaded compiled game (see [Resume validation](#resume-validation)).
2. **Restore core state** — deserialize `state` into the session's runtime state object.
3. **Resolve fragment** — determine the active fragment from `state.location` (and authored conditions). Do not treat `fragmentId` as the source of truth.
4. **Initialize modules** — run module initialization for any modules attached to the session.
5. **Apply module config** — for each entry in `modules`, apply `config` to the module registry when present.
6. **Load module data** — invoke each module's load hook with its `data` payload. Modules with no entry receive an undefined payload and may reset to defaults.

Module hook failures should be isolated where the implementation supports error isolation; core state restoration must not depend on module success.

---

## Resume validation

| Failure | Condition |
|---------|-----------|
| `wrong-game` | Save `gameId` ≠ compiled `gameId` |
| `stale-content` | Save `contentHash` ≠ compiled `contentHash` |
| `corrupt-state` | Missing or unparseable `state` payload |

On stale content, implementations should offer a fresh start—not silently merge incompatible saves.

---

## Legacy save recognition

Implementations should accept and normalize older shapes into the canonical v2 model on read. Writing new saves should use v2.

### RuntimeSave (v0)

Legacy mobile/player saves with **no envelope version field**. Recognized by the presence of required core fields and absence of `formatVersion` / `compatVersion`:

| Field | Notes |
|-------|-------|
| `projectId`, `gameId`, `contentHash`, `state`, `history`, `savedAt` | Required for recognition |
| `modules`, `fragmentId` | Absent |

Normalize: treat as envelope v0; `modules` → empty; validate `gameId` and `contentHash` on resume.

### CompatSave (v1)

Transitional compat-layer saves:

| Field | Value |
|-------|-------|
| `compatVersion` | `1` |
| `modules` | Optional record keyed by module id: `{ [id]: data }` (data only, no `config`) |

Normalize: map `compatVersion: 1` → `formatVersion: 2`; convert `modules` record to `ModuleSaveEntry[]` with `{ id, data }` (no config). Preserve `fragmentId` as hint only.

### Main-format (`format_version` v2)

Saves from the reference main-engine shape:

| Field | Notes |
|-------|-------|
| `format_version` | `2` |
| `saved_at_unix` | Integer unix timestamp (convert to ISO `savedAt` on normalize) |
| `modules` | Array of `{ name, config?, data }` |
| `gameId`, `contentHash` | May be absent on older main saves |

Normalize: map `format_version` → `formatVersion`; map module `name` → `id`; convert timestamp; **require** caller-supplied or embedded `gameId` and `contentHash` before resume when missing—do not resume against an unknown compiled game.

---

## What saves must not include

- Fragment definitions or choice catalogs
- Asset binaries
- Editor layout, graph positions, or debug panels
- Device-local file paths intended for portability

---

## Non-goals

The following are **out of scope** for this specification and for envelope-version migration:

- **Module semantic rewrite** — aligning envelope shape does not redefine module mechanics. Instability, Echo, and other modules may use incompatible internal payloads across implementations until those modules are amended separately. Envelope v2 carries module data; it does not guarantee cross-engine module round-trip.
- **Cross-`contentHash` save merge** — saves from a different authored content fingerprint must be rejected (`stale-content`). Implementations must not silently merge or upgrade saves across content changes.

---

## Storage

Physical storage location is implementation-defined. Hosts may lazy-migrate persisted blobs from legacy shapes to v2 on successful load. The logical v2 envelope is the portability contract.

---

## Related documents

- [Runtime specification](./RUNTIME_SPEC.md)
- [Compatibility specification](./COMPATIBILITY_SPEC.md)
- [Module specification](./MODULE_SPEC.md)
