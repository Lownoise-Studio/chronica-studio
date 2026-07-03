# Chronica Specification

The **Chronica Specification** is the platform contract for Chronica implementations. It defines portable game data, runtime behavior, saves, and compatibility rules—not a single editor or engine codebase.

**Chronica Mobile Studio** (this repository) is one implementation. Other Chronica runtimes and authoring tools may exist separately. When behavior differs, either the specification should clarify the rule or an implementation should be brought back into compliance.

For the product rationale, read [WHY_CHRONICA.md](../../WHY_CHRONICA.md).

---

## Specification documents

| Document | Defines |
|----------|---------|
| [PACKAGE_SPEC.md](./PACKAGE_SPEC.md) | `.chronica` archive format, manifest, integrity |
| [RUNTIME_SPEC.md](./RUNTIME_SPEC.md) | Session lifecycle, editor vs player boundary |
| [MODULE_SPEC.md](./MODULE_SPEC.md) | Compiler, validator, and session module contract |
| [SAVE_SPEC.md](./SAVE_SPEC.md) | Runtime save format and resume rules |
| [EVENT_SPEC.md](./EVENT_SPEC.md) | Actions, events, and state transitions |
| [SCENE_SPEC.md](./SCENE_SPEC.md) | Scenes, dialogue, choices, hotspots, stage actors |
| [ASSET_SPEC.md](./ASSET_SPEC.md) | Asset catalog, references, resolution |
| [RENDERING_SPEC.md](./RENDERING_SPEC.md) | Presentation vs gameplay separation |
| [COMPATIBILITY_SPEC.md](./COMPATIBILITY_SPEC.md) | Schema versioning, parity, migration |

---

## Design principles

1. **Specification-first** — implementations comply; they do not fork behavior silently.
2. **Portable packages** — `.chronica` is the canonical ship format between authoring and play.
3. **Deterministic runtime** — same project + same inputs → same state and scene sequence.
4. **State is authoritative** — UI reflects runtime state; it does not substitute for game rules.
5. **Presentation is separate** — renderers display engine output; they do not own branching logic.
6. **Feature parity, workflow divergence** — capabilities align across implementations; UX may differ.
7. **Evolving specification** — new presentation and gameplay models extend the spec; implementations catch up.

---

## Future home

This `docs/spec/` tree is the in-repo specification until a dedicated public **`chronica-spec`** repository or shared package is published. Content here may move without changing the underlying contract.

---

## Detailed package reference

Import/export failure reasons, size limits, and security rules: [package-round-trip.md](../package-round-trip.md) (also mirrored under `artifacts/chronica-mobile/docs/`).
