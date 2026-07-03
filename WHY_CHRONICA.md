# Why Chronica?

Chronica exists because **creating story-driven games should not depend on a single editor or runtime.**

Everything else follows from that one idea.

---

## Why does Chronica exist?

Most interactive fiction and narrative games are still trapped inside a specific tool chain. You author in one editor, export in one format, and hope the runtime on another device understands what you built. When it does not, you rebuild—or you stay on one platform forever.

Chronica treats the **game** as portable data and the **platform** as a set of implementations that honor the same contract. Creators work against the **Chronica Specification**. Players receive **`.chronica` packages**. Authoring tools and runtimes can differ; **gameplay behavior should not**.

The long-term goal is simple: build, edit, test, and play the same project across multiple Chronica implementations without rewriting your story every time the tool changes.

---

## Why not just use Godot?

Godot is an excellent general-purpose engine. For many games, it is the right choice.

Chronica is not trying to replace Godot for every genre. Chronica is optimized for a different problem: **portable, specification-driven, story-first games** where the authoritative artifact is a package any compliant runtime can load—not a project folder tied to one editor's export pipeline.

If your game is a real-time 3D action title, Godot (or Unity, or Unreal) may be the better home. If your game is a branching narrative, light adventure, or state-driven experience you want to **ship once and play everywhere Chronica runs**, Chronica is the bet.

---

## Why not just use Unity?

Unity offers depth, ecosystem, and commercial reach. It also couples creators to a particular editor, licensing model, and runtime stack.

Chronica deliberately trades breadth for **portability and behavioral clarity**. A `.chronica` package is meant to mean the same thing on mobile, desktop, and future players—validated against a public specification, not against whichever Unity version exported the project.

Unity remains a valid choice for teams that want a full 3D/commercial toolchain. Chronica is for creators who want **spec-first, cross-implementation story games** without carrying an entire general engine into every target device.

---

## Why a specification instead of a plugin?

A plugin extends one host. When the host changes, the plugin breaks—or your game stays inside that host forever.

A **specification** outlives any single implementation. Chronica Mobile Studio, Chronica Player, desktop authoring tools, and future runtimes can evolve independently as long as they comply with the same package format, runtime contract, save format, and scene/event rules.

That is how you get:

- **Feature parity** with **workflow divergence** (touch on mobile, professional tooling on desktop)
- **Behavioral parity** without **code parity**
- A public **`chronica-spec`** ecosystem instead of one proprietary project format per app

Plugins are useful. Specifications are durable.

---

## What this means in practice

| Idea | How Chronica expresses it |
|------|---------------------------|
| Portable games | `.chronica` packages |
| Shared behavior | Chronica Specification |
| Mobile creation | Chronica Mobile Studio |
| Play anywhere | Chronica Player |
| Cross-runtime trust | Validation, content hash, compatibility rules |

Chronica is becoming a **platform for creating, packaging, and playing story-driven games**—not a single mobile narrative engine living in isolation.

For the technical contract, see the [Chronica Specification](docs/spec/README.md).

For how this repository implements the platform today, see [README.md](README.md).
