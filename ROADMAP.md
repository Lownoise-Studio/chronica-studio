# Chronica Studio — Roadmap

Roadmap organized by phase. Items marked ✅ are implemented in the current mobile app (`artifacts/chronica-mobile`).

---

## Phase 1 — Narrative Game Engine MVP

**Goal:** A creator can build, playtest, and export a branching narrative game entirely on mobile.

| Item | Status |
|------|--------|
| Local mobile app runs (Expo Go / device) | ✅ |
| Project list and sample story seed | ✅ |
| Scene editor (text, name, conditions, effects, choices) | ✅ |
| Choice linking with scene picker | ✅ |
| Variable unlock chips (tap-to-insert conditions from story state) | ✅ |
| Playtest / in-app player | ✅ |
| Asset import (images, audio, data) | ✅ |
| Project export / import (JSON backup) | ✅ |
| `.chronica` game package export / import | ✅ |
| Load Game from Library (import + play immediately) | ✅ |
| Runtime host module (`runtime/chronica-runtime.ts`) | ✅ |
| Player host + save integrity gate (`runtime/player-host.ts`) | ✅ |
| Presentation-only player UI (`components/PlayerView.tsx`) | ✅ |
| Asset package reliability (export gate, CRC manifest, import compile gate) | ✅ |
| Story Graph View | ✅ |
| Engine tests (expressions, validator, turn resolver, runtime, packages) | ✅ |
| Advanced Mode (raw IDs, conditions syntax, state inspector) | ✅ |
| Onboarding for first-time creators | ✅ |
| ENGINE_SPEC.md + RUNTIME_SPEC.md | ✅ |

**Remaining in Phase 1**

- [ ] EAS build pipeline documented and verified for APK/AAB
- [ ] Validation UX polish (inline markers on scene list / graph)
- [ ] Scene reordering / duplicate scene from graph

---

## Phase 2 — Visual Novel / Character Layer

**Goal:** Games look and feel like visual novels—not plain text screens.

- [ ] Character definitions (name, portrait, expressions)
- [ ] Dialogue attribution (speaker labels, portrait display)
- [ ] Background layers (full-screen images per scene, transitions)
- [ ] Text presentation modes (narration vs dialogue box)
- [ ] Audio cues (BGM, SFX per scene or choice)
- [ ] Asset library improvements (preview, tags, reuse across scenes)

*Background images per scene and package round-trip are ✅ in Phase 1.*

---

## Phase 3 — Light RPG Systems

**Goal:** Support simple RPG mechanics without becoming a general-purpose RPG toolkit.

- [ ] Inventory items (pick up, use, consume)
- [ ] Stats and derived checks (e.g. trust ≥ N gates a choice)
- [ ] Combat or challenge encounters (turn-based or choice-resolved)
- [ ] World map or location hub navigation
- [ ] Save slots beyond single autosave per project
- [ ] Memory flags (persistent story knowledge separate from variables)

*Note: Many primitives exist in the Godot engine (`memory`, `instability`, effects); mobile UI and authoring tools still need to be built.*

---

## Phase 4 — Export / Packaging / Sharing

**Goal:** Creators can ship playable builds, not just packages.

- [ ] Standalone Android APK/AAB via EAS
- [ ] Embedded player runtime (no Expo Go required)
- [ ] Custom app icon and splash per project (optional white-label)
- [ ] Share project via file, link, or cloud backup
- [ ] API server sync (`artifacts/api-server` scaffold exists; not wired to mobile)
- [ ] Versioned project schema migrations (partial — `schemaVersion` + migrate on load)

*`.chronica` portable packages and Load Game are ✅.*

---

## Phase 5 — Platform / Marketplace Possibilities

**Goal:** Explore distribution and discovery—only after Phases 1–4 are solid.

- [ ] Published game gallery or creator portfolio
- [ ] Template library (genres, starter projects)
- [ ] Community sharing / remix with attribution
- [ ] Monetization hooks (paid templates, tip jar, premium export)
- [ ] Moderation and content guidelines

*These are exploratory. No commitment until core authoring and export are reliable.*

---

## Current stack (for planning context)

| Layer | Location |
|-------|----------|
| Mobile app | `artifacts/chronica-mobile` |
| TS engine port | `artifacts/chronica-mobile/engine/` |
| Runtime host | `artifacts/chronica-mobile/runtime/` |
| Demo showcase | `artifacts/chronica-mobile/demo/` |
| Godot reference engine | separate repo / `attached_assets` import |
| API scaffold | `artifacts/api-server`, `lib/` |
| Design sandbox (Replit) | `artifacts/mockup-sandbox` |

See [docs/local-dev.md](docs/local-dev.md) for running the app locally.  
See [README.md](README.md) for repo overview.
