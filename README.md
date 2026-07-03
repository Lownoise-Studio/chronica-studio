# Chronica Mobile Studio

**The first public implementation of the Chronica Platform.**

Chronica Mobile Studio is a mobile-first implementation of the Chronica Platform, allowing creators to build, test, and play portable `.chronica` games directly on mobile devices. It ships **Chronica Mobile Studio** (authoring) and **Chronica Player** (play-only) in one React Native + Expo app.

This repository is the public home for that work. Application code lives in [`artifacts/chronica-mobile/`](artifacts/chronica-mobile/).

Chronica is designed around **portable game creation**. See [WHY_CHRONICA.md](WHY_CHRONICA.md).

Rather than coupling projects to a specific editor or runtime, games are authored against the **[Chronica Specification](docs/spec/README.md)** and distributed as portable **`.chronica` packages**. The long-term goal is to let creators build, edit, test, and play the same projects across multiple Chronica implementations while maintaining consistent gameplay behavior.

## Platform

```
Chronica
├── Chronica Specification     ← [docs/spec/](docs/spec/README.md) (future public chronica-spec repo)
├── Chronica Studio              ← desktop / professional authoring implementation
├── Chronica Mobile Studio       ← this repository
└── Chronica Player              ← play-only shell (included in this app)
```

Mobile is not a reduced fork or a side experiment. It targets **cross-runtime compatibility** with the specification and other Chronica runtimes.

## Design principles

- **Specification-first architecture** — the Chronica Specification defines behavior; implementations comply
- **Portable `.chronica` packages** — one format for export, import, and play across devices
- **Behavioral parity across implementations** — gameplay outcomes must agree; code structure may differ
- **Feature parity with workflow divergence** — same capabilities over time; mobile uses touch-first UX
- **Touch-first creation experience** — author, playtest, and ship from phone or tablet

## What you can do today

| Capability | Description |
|------------|-------------|
| **Mobile authoring** | Scenes, dialogue, characters, hotspots, variables, assets |
| **Compile & validate** | Catch broken links, invalid conditions, and missing assets before play |
| **Playtest & Player** | In-editor playtest or standalone Chronica Player mode |
| **`.chronica` packages** | Export and import portable games with integrity checks |
| **Save / resume** | Runtime saves tied to `gameId` and content hash |
| **Try Demo** | Bundled Pasture demo (`.chronica` round-trip on device) |

Current public implementation focuses on **state-driven gameplay models**. The Chronica Specification is designed to evolve to support additional presentation capabilities over time.

## Repository layout

| Path | Purpose |
|------|---------|
| [`artifacts/chronica-mobile/`](artifacts/chronica-mobile/) | React Native + Expo app — Mobile Studio + Player |
| [`artifacts/chronica-mobile/engine/`](artifacts/chronica-mobile/engine/) | Specification logic — compiler, session, package, validation (no UI) |
| [`artifacts/chronica-mobile/runtime/`](artifacts/chronica-mobile/runtime/) | Play session host — runtime loop, saves, player boundary |
| [`docs/spec/`](docs/spec/README.md) | Chronica Specification — platform contract |
| [`artifacts/chronica-mobile/docs/`](artifacts/chronica-mobile/docs/) | Mobile architecture and package details |

Other Chronica implementations (including desktop and professional authoring tools) may live in separate repositories. This repo documents and implements the **mobile** surface of the platform.

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
| [Mobile architecture](artifacts/chronica-mobile/docs/ARCHITECTURE.md) | Implementation layout and compliance status |
| [Package boundary](artifacts/chronica-mobile/docs/package-round-trip.md) | Import/export rules and integrity |
| [VISION.md](VISION.md) | Product direction |
| [ROADMAP.md](ROADMAP.md) | Phased delivery |

## Project status

Chronica Mobile Studio is under active development as a **public preview**. The compiler, runtime, package format, and state model are stabilizing; breaking changes may occur before a stable release.

## Repository naming

This repository is currently named **`chronica-studio`** while its primary public artifact is **Chronica Mobile Studio** under `artifacts/chronica-mobile/`. A future rename (for example `chronica-mobile` or `chronica-mobile-studio`) would align the GitHub name with the public product and sit alongside a future ecosystem such as `chronica-spec`, `chronica-player`, and `chronica-mobile`.

## License

Chronica Mobile Studio by [Lownoise Studio](https://lownoise.studio).
