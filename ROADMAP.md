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
| Project export / import (JSON) | ✅ |
| Engine tests (expressions, validator, turn resolver, editor helpers) | ✅ |
| Advanced Mode (raw IDs, conditions syntax, state inspector) | ✅ |
| Onboarding for first-time creators | ✅ |

**Remaining in Phase 1**

- [ ] **Story Graph View** ← *Next recommended feature*
- [ ] Validation UX (surface broken links and invalid expressions in-editor)
- [ ] Scene reordering / duplicate scene from graph
- [ ] EAS build pipeline documented and verified for APK/AAB
- [ ] Root README for GitHub (replace Replit-centric docs)

---

## Phase 2 — Visual Novel / Character Layer

**Goal:** Games look and feel like visual novels—not plain text screens.

- [ ] Character definitions (name, portrait, expressions)
- [ ] Dialogue attribution (speaker labels, portrait display)
- [ ] Background layers (full-screen images per scene, transitions)
- [ ] Text presentation modes (narration vs dialogue box)
- [ ] Audio cues (BGM, SFX per scene or choice)
- [ ] Asset library improvements (preview, tags, reuse across scenes)

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

**Goal:** Creators can ship playable builds, not just JSON files.

- [ ] Standalone Android APK/AAB via EAS
- [ ] Embedded player runtime (no Expo Go required)
- [ ] Custom app icon and splash per project (optional white-label)
- [ ] Share project via file, link, or cloud backup
- [ ] API server sync (`artifacts/api-server` scaffold exists; not wired to mobile)
- [ ] Versioned project schema migrations

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

## Next recommended feature: Story Graph View

**Why:** Creators currently edit scenes in a list and wire choices manually. A graph view would show scenes as nodes and choices as edges—making structure visible, catching broken links, and speeding up large projects.

**Scope sketch (Phase 1 completion):**

- Read-only graph of `locationId` nodes and `goto:` edges
- Tap node → open scene editor
- Highlight orphan scenes and broken destinations
- No engine changes required; pure editor UX over existing project model

---

## Current stack (for planning context)

| Layer | Location |
|-------|----------|
| Mobile app | `artifacts/chronica-mobile` |
| TS engine port | `artifacts/chronica-mobile/engine/` |
| Godot reference engine | separate repo / `attached_assets` import |
| API scaffold | `artifacts/api-server`, `lib/` |
| Design sandbox (Replit) | `artifacts/mockup-sandbox` |

See `docs/local-dev.md` for running the app locally.
