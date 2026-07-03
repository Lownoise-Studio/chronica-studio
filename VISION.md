# Chronica — Vision

## Vision

**What is Chronica?**

Chronica is a **platform for creating, packaging, and playing story-driven games**.

Creators author against the Chronica Specification. Games ship as portable **`.chronica` packages**. Any compliant implementation can load, run, and present the same project—mobile studio, desktop studio, dedicated player, or future services.

Chronica is not a single app, not a plugin for someone else's engine, and not a genre locked to one editor. It is the shared contract and ecosystem around portable interactive fiction and state-driven adventure.

## Mission

**Why does it exist?**

To let creators **build games once** and **move them across Chronica implementations** without redefining gameplay.

Story structure, variables, branching, assets, and runtime behavior should survive the tool change—not be re-authored for every device or every vendor.

## Principles

- **Specification first** — the Chronica Specification is the source of truth; implementations comply
- **Behavioral parity** — the same package and inputs produce the same game outcomes on every runtime
- **Feature parity, workflow divergence** — capabilities align across implementations; UX may differ (touch on mobile, professional tooling on desktop)
- **Portable packages** — `.chronica` is the canonical handoff between authoring and play
- **Creator-first tooling** — reduce friction from idea to playable build on the devices creators actually use
- **Long-term ecosystem** — specification, studios, players, and services as peers—not one monolithic app

## Platform

```
Chronica
├── Specification
├── Studio                    ← professional / desktop authoring
├── Mobile Studio             ← first public implementation (this repository)
├── Player                    ← play-only experiences
└── Future services           ← sync, discovery, analytics, marketplace (TBD)
```

## What ships today

This repository implements **Chronica Mobile Studio** and **Chronica Player** on React Native + Expo. It is the first public surface of the platform—not a reduced or experimental fork.

For the technical contract, see the [Chronica Specification](docs/spec/README.md).  
For why the platform exists, see [WHY_CHRONICA.md](WHY_CHRONICA.md).  
For how to run and contribute to this implementation, see [README.md](README.md).

## What comes next

The platform story is only as credible as the games it runs. The next proof points are **finished, compelling games** and **new gameplay and presentation capabilities** shipped on the same package and runtime foundation—not more documentation.

Build once. Play anywhere.
