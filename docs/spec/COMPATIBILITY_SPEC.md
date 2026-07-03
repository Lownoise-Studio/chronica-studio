# Compatibility Specification

Defines **versioning, parity, and migration** rules so packages and saves work across Chronica implementations.

## Identity

| Identifier | Scope |
|------------|--------|
| `gameId` | Stable across export/import on any device |
| `projectId` / install id | Local library slot; may change on re-import |
| `contentHash` | Fingerprint of authored content at compile time |

Saves bind to `gameId` + `contentHash`. Edited projects invalidate stale saves by design.

## Schema versioning

Projects and packages carry `schemaVersion` (mirrored as `storySchemaVersion` in `.chronica` manifests).

| Tier | Versions | Mobile behavior |
|------|----------|-----------------|
| **Fully enabled** | v1–v2 | Compat ingest reports `fully-enabled`; may reach `playable`. |
| **Known-limited** | v3 | Recognized; compat ingest warns and downgrades to `limited` — not silently `playable`. |
| **Unknown** | > v3 | Rejected with typed errors. |

### Schema v3

Schema **v3** is the current authoring schema. It standardizes structured **dialogue** lines, **hotspots**, **stageActors**, stable **gameId**, and portable asset paths. The mobile **ZIP importer** accepts and migrates v3 packages. The **compat ingest** path recognizes v3 but does not yet declare full parity — callers must surface the `known-limited` warning.

Constants live in `engine/schema-versions.ts` (`CHRONICA_SCHEMA_VERSION_*`).

## Package format versioning

- Manifest `version` field tracks `.chronica` container format.
- Unknown manifest fields are ignored.
- Missing mandatory integrity fields are rejected.

## Cross-implementation parity

| Layer | Parity expectation |
|-------|-------------------|
| **Package import** | Same package loads on any compliant implementation |
| **Compile output** | Same project produces equivalent compiled action maps |
| **Runtime turns** | Same inputs → same state and location sequence |
| **Saves** | Same save resumes on same content hash |
| **Presentation** | May differ visually; must not change game outcomes |

**Behavioral parity** matters more than code or pixel parity.

When implementations disagree, resolution order:

1. Clarify the Chronica Specification.
2. Fix the non-compliant implementation.
3. Add conformance tests to the spec suite (future `chronica-spec` repo).

## Forward and backward compatibility

- **Forward**: older runtimes reject unknown schema/package versions explicitly.
- **Backward**: newer authoring tools migrate down supported schema versions when exporting for older players, if applicable—or document minimum player version.

## Legacy formats

JSON project export without embedded assets is a **backup**, not a complete portable ship format. Runtimes may load story logic but cannot guarantee media until a `.chronica` package is provided.

## Conformance testing (current)

This repository validates compatibility through:

- Package round-trip and integrity tests
- Compiler and runtime unit tests
- Bundled demo packages (e.g. Pasture)

A shared cross-runtime conformance harness is future work for the public `chronica-spec` ecosystem.

## Related documents

- [Package specification](./PACKAGE_SPEC.md)
- [Save specification](./SAVE_SPEC.md)
- [WHY_CHRONICA.md](../../WHY_CHRONICA.md)
