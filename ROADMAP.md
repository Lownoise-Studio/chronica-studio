# Chronica Studio — Roadmap

Roadmap organized by phase. Items marked ✅ are implemented in the current mobile app (`artifacts/chronica-mobile`).

Phases map to **gameplay models** on the Chronica platform (compiler, runtime, state, packages). See the [Chronica Specification](docs/spec/README.md) and [VISION.md](./VISION.md) for architecture principles.

| Layer | Phases |
|-------|--------|
| **Core** | Phase 1 (compiler, runtime, packages, identity, persistence) |
| **Gameplay models** | Phase 1 narrative + hotspots · Phase 2 dialogue · Phase 3 inventory/quests |
| **Presentation** | Phase 2 VN · future adventure/top-down/hidden-object renderers |
| **Distribution** | Phase 4 export/APK · Phase 5 marketplace |

---

## Phase 1 — Narrative Gameplay Model (MVP)

**Goal:** A creator can build, playtest, and export a branching narrative game entirely on mobile—proving the state-driven core on device.

| Item | Status |
|------|--------|
| Local mobile app runs (Expo Go / device) | ✅ |
| Project list and sample story seed | ✅ |
| Scene editor (text, name, conditions, effects, choices, hotspots) | ✅ |
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
| Chronica Specification (`docs/spec/`) | ✅ |

**Remaining in Phase 1**

- [ ] EAS build pipeline documented and verified for APK/AAB
- [ ] Validation UX polish (inline markers on scene list / graph)
- [ ] Scene reordering / duplicate scene from graph

---

## Phase 2 — Dialogue & Visual Novel Presentation

**Goal:** Improve visual novel presentation on top of the implemented dialogue and character/cast gameplay models.

- [x] Character/cast definitions (name, portrait, expressions)
- [x] Dialogue attribution (speaker labels, portrait display)
- [ ] Background presentation polish (layering, transitions, safe-area tuning)
- [ ] Text presentation modes (narration vs dialogue box)
- [ ] Audio presentation polish (BGM/SFX controls and transitions)
- [ ] Asset library improvements (preview, tags, reuse across scenes)

*Background images per scene, dialogue data, character/cast data, and package round-trip are ✅ in Phase 1/current app.*

---

## Phase 3 — Inventory, Quests & Light RPG Gameplay

**Goal:** Support simple RPG mechanics without becoming a general-purpose RPG toolkit or changing the discrete state-transition execution model.

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

- [x] Chronica Player shell (`EXPO_PUBLIC_CHRONICA_APP_MODE=player`, `/player` home, play-only routes)
- [x] EAS `player` profile for standalone Android APK (`pnpm build:player:android`)
- [ ] Player APK verified on physical device
- [ ] Embedded player runtime (no Expo Go required) — player builds are standalone; dev still uses Expo
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
