# Chronica Studio Engine

**Chronica Studio** is a mobile-first game engine for building, playtesting, and shipping state-driven interactive games on phone and tablet. The narrative workflow shipping today is Phase 1 of the engine—not the whole product.

## Project Status

Chronica Studio is under active development. The engine foundation is stabilizing, and the core architecture—compiler, runtime, package format, and state model—is becoming stable. Gameplay models will continue to expand over time, and breaking changes may occur before the first stable release.

## Current Scope

Chronica Studio currently focuses on:

- State-driven interactive games
- Branching narrative
- Visual novel experiences
- Light adventure experiences

Real-time gameplay, physics, and 3D are outside the current scope. Chronica is focused on deterministic state transitions, authored gameplay models, and mobile-first presentation rather than frame-based simulation or general-purpose rendering.

## Current Capabilities

Implemented capabilities in the current mobile app include:

- Mobile-first editor
- Scene editor
- Dialogue system
- Character/cast system
- Hotspots
- Variables and state
- Conditional branching
- Asset library
- ZIP asset import
- Compiler & validation
- Playtest runtime
- `.chronica` package export/import
- Chronica Player
- Save/resume
- Showcase demo

## Road to v1

The next major milestones are focused on:

- Engine stabilization
- Additional gameplay models
- Presentation improvements
- Standalone player polish
- Public creator release

No release dates are promised yet; the priority is a stable, portable foundation for creators and players.

## What’s in this repo

| Path | Purpose |
|------|---------|
| [`artifacts/chronica-mobile/`](artifacts/chronica-mobile/) | Expo/React Native app — editor + runtime host |
| [`artifacts/chronica-mobile/engine/`](artifacts/chronica-mobile/engine/) | Pure TypeScript engine (no UI) |
| [`artifacts/chronica-mobile/runtime/`](artifacts/chronica-mobile/runtime/) | Runtime host — session loop for playtest & Load Game |
| Godot Chronica plugin | Reference engine (separate import) |

## Engine vs editor

- **Editor** — create scenes, choices, assets; validate; export packages  
- **Runtime** — load `.chronica`, run deterministic session logic, render scenes  

See [ENGINE_SPEC.md](ENGINE_SPEC.md) and [RUNTIME_SPEC.md](RUNTIME_SPEC.md) for the full contract.

## Ship format: `.chronica` packages

A `.chronica` file is a ZIP package containing:

- `manifest.json` — package metadata  
- `story.json` — full project (portable asset paths)  
- `assets/*` — embedded image/audio files  

Load Game on the Library screen imports a package and opens the player immediately.

## Local development

```bash
pnpm install
cd artifacts/chronica-mobile
pnpm typecheck
pnpm test
pnpm exec expo start
```

See [docs/local-dev.md](docs/local-dev.md) for local development and platform build details.

## Docs

- [VISION.md](VISION.md) — product direction  
- [ROADMAP.md](ROADMAP.md) — phased delivery  
- [ENGINE_SPEC.md](ENGINE_SPEC.md) — engine architecture & guarantees  
- [RUNTIME_SPEC.md](RUNTIME_SPEC.md) — editor/runtime boundary  

## Try it

On device: open the app → **Try Demo** (bundled `.chronica` showcase) or **Load Game** (your own package).
