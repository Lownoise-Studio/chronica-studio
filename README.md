# Chronica Studio

**Chronica Studio** is a platform for building and playing portable narrative games. Creators author against the **[Chronica Specification](docs/spec/README.md)**, export **`.chronica` packages**, and play the same project across Chronica implementations with consistent gameplay behavior.

This repository is the public home for **Chronica Mobile Studio** — a mobile-first authoring and play app — plus the TypeScript engine that implements the specification on device. Application code lives in [`artifacts/chronica-mobile/`](artifacts/chronica-mobile/).

| Milestone | Status |
|-----------|--------|
| **Foundation v1** | ✅ Complete — core runtime, asset pipeline, editor safety, diagnostics |
| **Visual Scene Composer** | ➡️ Next — visual stage authoring and higher-level editing tools |

See [ROADMAP.md](ROADMAP.md) for phased delivery and [RELEASE_NOTES_FOUNDATION_V1.md](RELEASE_NOTES_FOUNDATION_V1.md) for the v1 baseline summary.

---

## What you get today

Core capabilities shipped in **Foundation v1**:

| Feature | Description |
|---------|-------------|
| **Playable narrative adventure runtime** | Branching scenes, choices, hotspots, dialogue, and adventure-mode movement/interaction |
| **Deterministic runtime** | Same project + same inputs → same state and scene sequence |
| **Smart asset pipeline** | Import, classify, and validate assets with intake hints |
| **Asset recipes** | Apply reusable patterns (pickups, NPCs, doors) from library assets |
| **Playable room generation** | Scaffold adventure scenes from a background and asset set |
| **Editor transactions** | Atomic, validated editor mutations with rollback on failure |
| **Diagnostics** | Structured error reports with recovery classification |
| **Package compatibility** | Feature matrix checks before play and import |

You can also export/import **`.chronica` packages**, playtest in-app, run **Chronica Player** mode, and save/resume with integrity checks. See [WHY_CHRONICA.md](WHY_CHRONICA.md) for the product rationale.

---

## Architecture

Chronica separates the **specification** (portable contract), **authoring implementations** (Studio tools), and **player runtimes** (play-only shells):

```
Chronica Specification
        │
        ├── Chronica Studio          ← desktop / professional authoring (future / separate repos)
        │
        ├── Chronica Mobile Studio   ← this repository (author + play)
        │
        └── Chronica Player          ← play-only shell (included in this app)
```

Portable **`.chronica` packages** flow from any compliant authoring tool into any compliant player. Mobile is a first-class implementation, not a reduced fork.

---

## Foundation v1

**Foundation v1** is the engineering baseline tagged before Visual Scene Composer work begins. It establishes:

- A **playable narrative adventure runtime** with compile gates, runtime fallbacks, and save/resume
- **Asset Pipeline Phases 1–5** — smart intake, recipes, playable room generation
- **Foundation Hardening Phases 1–6** — validation, project integrity, runtime fallbacks, package compatibility, engine contracts, diagnostics & recovery
- **Architecture Audit P0 + P1** — atomic editor transactions, unified validation severity, shared diagnostics pipeline, batch import transactions

**Quality at v1:** 741 passing automated tests · typecheck clean

Engineering references: [FOUNDATION_HARDENING.md](docs/spec/FOUNDATION_HARDENING.md) · [ARCHITECTURE_AUDIT.md](docs/spec/ARCHITECTURE_AUDIT.md)

---

## What Chronica is not yet

Foundation v1 is a strong **core architecture baseline**, not a full game-engine product:

- **Not a full Unity/Godot replacement** — Chronica targets portable narrative and adventure games, not general-purpose 3D engines
- **No visual scene editor yet** — scenes are edited through mobile forms and lists; Visual Scene Composer is the next milestone
- **No combat framework yet** — inventory, quests, and encounter systems are planned, not shipped
- **No marketplace or cloud tooling yet** — distribution, sync, and discovery remain future work

---

## Platform

```
Chronica
├── Chronica Specification     ← [docs/spec/](docs/spec/README.md)
├── Chronica Studio              ← desktop / professional authoring (future)
├── Chronica Mobile Studio       ← this repository
└── Chronica Player              ← play-only shell (included in this app)
```

## Design principles

- **Specification-first architecture** — the Chronica Specification defines behavior; implementations comply
- **Portable `.chronica` packages** — one format for export, import, and play across devices
- **Behavioral parity across implementations** — gameplay outcomes must agree; code structure may differ
- **Feature parity with workflow divergence** — same capabilities over time; mobile uses touch-first UX
- **Touch-first creation experience** — author, playtest, and ship from phone or tablet

## Repository layout

| Path | Purpose |
|------|---------|
| [`artifacts/chronica-mobile/`](artifacts/chronica-mobile/) | React Native + Expo app — Mobile Studio + Player |
| [`artifacts/chronica-mobile/engine/`](artifacts/chronica-mobile/engine/) | Specification logic — compiler, session, package, validation (no UI) |
| [`artifacts/chronica-mobile/runtime/`](artifacts/chronica-mobile/runtime/) | Play session host — runtime loop, saves, player boundary |
| [`docs/spec/`](docs/spec/README.md) | Chronica Specification — platform contract |
| [`artifacts/chronica-mobile/docs/`](artifacts/chronica-mobile/docs/) | Mobile architecture and package details |

## `.chronica` packages

A `.chronica` file is a portable ZIP package:

- `manifest.json` — identity, integrity metadata, asset manifest
- `story.json` — full project (portable asset references)
- `assets/*` — embedded media

Open a package in **Chronica Player** or import via **Load Game**. See [package boundary docs](artifacts/chronica-mobile/docs/package-round-trip.md).

## Local development

Clone the repository:

```bash
git clone https://github.com/Lownoise-Studio/chronica-studio.git
cd chronica-studio
```

Install dependencies:

```bash
pnpm install
```

Run Chronica Mobile Studio:

```bash
cd artifacts/chronica-mobile

pnpm typecheck
pnpm test
pnpm exec expo start
```

See [docs/local-dev.md](docs/local-dev.md) for platform build details.

> **Note**
>
> All commands assume your current working directory is the root of the cloned `chronica-studio` repository unless otherwise specified.

## Documentation

| Document | Description |
|----------|-------------|
| [Why Chronica?](WHY_CHRONICA.md) | Strategic manifesto — why the platform exists |
| [Chronica Specification](docs/spec/README.md) | Platform contract (package, runtime, save, scene, …) |
| [Foundation Hardening](docs/spec/FOUNDATION_HARDENING.md) | Validation, integrity, contracts, transactions, diagnostics |
| [Release notes — Foundation v1](RELEASE_NOTES_FOUNDATION_V1.md) | v1 milestone summary |
| [Roadmap](ROADMAP.md) | Phased delivery |
| [Mobile architecture](artifacts/chronica-mobile/docs/ARCHITECTURE.md) | Implementation layout and compliance status |
| [Package boundary](artifacts/chronica-mobile/docs/package-round-trip.md) | Import/export rules and integrity |
| [VISION.md](VISION.md) | Product direction |

## Project status

**Foundation v1 is complete** and tagged as the baseline before Visual Scene Composer. The compiler, runtime, package format, and editor safety layer are stabilizing; breaking changes may still occur before a stable public release.

## Repository naming

This repository is currently named **`chronica-studio`** while its primary public artifact is **Chronica Mobile Studio** under `artifacts/chronica-mobile/`. A future rename (for example `chronica-mobile` or `chronica-mobile-studio`) would align the GitHub name with the public product and sit alongside a future ecosystem such as `chronica-spec`, `chronica-player`, and `chronica-mobile`.

## License

Chronica Mobile Studio by [Lownoise Studio](https://lownoise.studio).
