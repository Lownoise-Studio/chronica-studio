# Chronica Studio — Vision

Chronica Studio is a **mobile-first game engine for state-driven games**. Its compiler transforms editable projects into executable games, its runtime executes deterministic rules over authoritative game state, and its package system preserves game integrity across devices.

**Narrative is the first proof that the architecture works.** The current scene/fragment editor is the first **gameplay model** on this foundation—not the engine itself, and not merely a story-writing app.

Chronica's goal is not to be a general-purpose rendering engine. Its goal is to become the best engine for creating **state-driven interactive games on mobile**, where gameplay emerges from validated state, deterministic rules, and meaningful player decisions.

## Lineage

Chronica Studio inherits concepts and runtime behavior from the **Godot Chronica Engine** (GDScript plugin). The mobile app ports that engine to TypeScript so creators can author, playtest, and ship without a desktop toolchain. The Godot engine remains the reference implementation for full-game runtime; Chronica Studio is the creator-facing, mobile-native layer.

## What the engine provides

Every game built in Chronica Studio is structured around shared primitives:

| Concept | Role |
|---------|------|
| **Scenes** | Discrete story moments (locations, dialogue beats, encounters) with text, media, and logic |
| **Choices** | Player actions that branch the narrative and trigger effects |
| **Assets** | Images, audio, and data files attached to scenes |
| **Variables** | Typed game state (booleans, numbers, strings) read by conditions and updated by effects |
| **State** | The live snapshot of location, variables, memory, and instability during play |
| **Events** | Conditions and effects that gate scenes/choices and mutate state on entry or selection |
| **Playtest** | In-app player to run the game on device as the creator builds it |
| **Export** | Portable project JSON for backup, sharing, and future packaging pipelines |

Creators work scene-by-scene today. Future gameplay models—including dialogue, characters, inventory, hotspots, quests, and combat—compose on the same compiler, runtime, package, and state architecture rather than replacing it.

## Architecture

```
Core (compiler, runtime, identity, packages, state, actions, persistence)
  ↓
Gameplay models (narrative, dialogue, inventory, character, quest, interaction, combat, …)
  ↓
Presentation (narrative reader, visual novel, adventure, top-down, hidden object, …)
```

**State + Rules + Execution = Gameplay. Gameplay + Presentation = Player experience.**

**Core owns execution. Gameplay models describe rules. Presentation decides how those rules are experienced.**

A single gameplay model (e.g. inventory) may be used by multiple presentation styles. Presentation concerns must not leak into engine code.

When evaluating new work, ask: *Is this a new gameplay model on top of the same state engine, or is it forcing the core to become genre-specific?* If the latter, it belongs in a gameplay model—not in the engine.

Conceptual capabilities (state engine, action engine, execution engine) belong in documentation, not in folder names. The current `engine/`, `runtime/`, and `components/` layout is authoritative.

## Design principles

- **Mobile-first** — editing and playtesting happen on the device creators already carry.
- **State-driven** — the engine computes state; consequences emerge from validated transitions, not from ad hoc application code.
- **Data-driven** — engine behavior is defined by validated data wherever practical; engine code executes rules, gameplay models describe them.
- **Engine, not editor-only** — every feature must compose with state, compile, runtime, and export.
- **Offline-capable** — projects live on device; cloud sync is optional, not required.
- **Progressive depth** — simple defaults for new creators; Advanced Mode for power users who need raw IDs, conditions, and state inspection.

## Success looks like

A creator opens Chronica Studio on their phone or tablet, builds a branching game with unlockable paths, playtests it immediately, exports the project, and eventually publishes a playable build—without leaving their mobile workflow. Android is the first shipping target, while the product remains mobile-first.
