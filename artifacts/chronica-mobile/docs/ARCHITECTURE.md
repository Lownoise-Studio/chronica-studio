# Chronica Mobile Studio — Architecture

This document describes how **Chronica Mobile Studio** fits into the Chronica Platform and what it implements today.

## Platform overview

```
Chronica
├── Chronica Specification          ← [docs/spec/](../../../docs/spec/README.md)
│   ├── Package · Runtime · Module API
│   ├── Save · Event · Scene · Asset
│   └── Rendering · Compatibility
├── Chronica Studio                 ← desktop / professional authoring implementation
├── Chronica Mobile Studio          ← this app (React Native + Expo)
└── Chronica Player                 ← play-only mode (included in this app)
```

Read [WHY_CHRONICA.md](../../../WHY_CHRONICA.md) for the platform rationale.

**Chronica Mobile Studio** is a first-class implementation of the platform—not a prototype runtime. It targets **cross-runtime compatibility** with the Chronica Specification and other Chronica runtimes.

### Guiding principles

| Principle | Meaning |
|-----------|---------|
| **Feature parity** | Same story capabilities across implementations; shipping order may differ |
| **Workflow divergence** | Mobile uses touch-first editors, on-device import, and player app mode |
| **Behavioral parity** | Game outcomes, packages, and saves must agree with the spec |
| **Spec-first** | Spec drift is resolved by clarifying the spec or fixing an implementation |

## Repository layout

```
artifacts/chronica-mobile/
├── engine/          # Spec logic — compiler, session, validator, package, assets (no RN)
├── runtime/         # Play session — ChronicaRuntime, PlayerHost, saves
├── storage/         # File system, .chronica I/O, project persistence
├── components/      # Player and editor UI
├── app/             # Expo Router screens (studio + player modes)
└── docs/            # Architecture and package documentation
```

Only `engine/` and `runtime/` define game behavior. UI layers consume their output.

## Implementations in this app

The same codebase builds two shells via `CHRONICA_APP_MODE`:

| Mode | Entry | Purpose |
|------|-------|---------|
| **studio** | `app/(tabs)/` | Mobile authoring, playtest, export |
| **player** | `app/player/` | Load and play `.chronica` packages |

Both use the same `PlayerHost` → `PlayerView` stack for play.

## Specification compliance (mobile)

Status relative to the **Chronica Specification**, not any single private codebase.

### Implemented

| Contract | Mobile location |
|----------|-----------------|
| **`.chronica` Package** | [PACKAGE_SPEC.md](../../../docs/spec/PACKAGE_SPEC.md), `engine/chronica-package.ts`, `storage/chronica-package-io.ts` |
| **Runtime Contract** | [RUNTIME_SPEC.md](../../../docs/spec/RUNTIME_SPEC.md), `runtime/chronica-runtime.ts`, `runtime/player-host.ts` |
| **Module API** | [MODULE_SPEC.md](../../../docs/spec/MODULE_SPEC.md), `engine/index.ts` |
| **Save Format** | [SAVE_SPEC.md](../../../docs/spec/SAVE_SPEC.md), `runtime/validate-runtime-save.ts` |
| **Event Model** | [EVENT_SPEC.md](../../../docs/spec/EVENT_SPEC.md), `engine/actions/` |
| **Scene Model** | [SCENE_SPEC.md](../../../docs/spec/SCENE_SPEC.md), `engine/types.ts` |
| **Asset Model** | [ASSET_SPEC.md](../../../docs/spec/ASSET_SPEC.md), `engine/asset-resolver.ts` |
| **Rendering Contract** | [RENDERING_SPEC.md](../../../docs/spec/RENDERING_SPEC.md), `engine/player-presentation.ts`, player components |
| **Compatibility Rules** | [COMPATIBILITY_SPEC.md](../../../docs/spec/COMPATIBILITY_SPEC.md), `engine/project-migration.ts` |

### Partial

| Area | Notes |
|------|-------|
| **Presentation profiles** | Adventure / VN-style layouts implemented; additional profiles defined by the spec may land on mobile later. |
| **Authoring feature surface** | Core narrative workflow is implemented; some professional authoring tools in other implementations may offer additional editors or tooling not yet on mobile. |
| **Specification packaging** | Rules are enforced in code and tests; the canonical spec document set may move to a future public `chronica-spec` repository. |

### Not yet in this repository

| Area | Notes |
|------|-------|
| **Standalone `chronica-spec` package** | Planned as the long-term canonical spec home. |
| **Automated cross-runtime conformance suite** | Parity is guarded by package round-trip tests, compiler/runtime tests, and bundled demos (e.g. Pasture); a shared conformance harness across all runtimes is future work. |

### Known compatibility considerations

- **Web preview** — package pickers and native file I/O are limited; native mobile is the reference environment for import/play.
- **Behavioral discrepancies** — treat as spec or implementation bugs; resolve via spec clarification or a targeted fix, not mobile-only forks of engine rules.
- **Package integrity** — imports require `storyContentHash` and `assetsManifest`; legacy packages without integrity metadata are rejected by design.

## Current focus

- Mobile-first authoring
- Portable `.chronica` package support
- Cross-platform runtime parity
- Touch-first workflows

## Related documentation

- [`.chronica` package boundary](./package-round-trip.md) — import/export rules, integrity, size limits, failure reasons

## Canonical specification (future)

The Chronica Specification lives in [`docs/spec/`](../../../docs/spec/README.md) until a dedicated public **`chronica-spec`** repository is published.
