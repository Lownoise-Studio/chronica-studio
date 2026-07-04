# Gameplay Authoring (Phase 1 + Phase 2)

Chronica Mobile Studio expands **authoring** and **player feedback** beyond branching dialogue while keeping gameplay deterministic and specification-driven.

## Phase 1 — Authoring catalogs

Phase 1 adds **data model + editor support**:

- Inventory catalog (items linked to assets)
- Hotspot interaction metadata (inspect, collect, use item, one-shot / repeatable)
- Gameplay variables (designer-friendly definitions synced to `initialVariables`)
- Objectives (complete / fail / reveal conditions)
- World state flags (doors, lights, bridges, NPCs, …)
- NPC profiles + stage actor gameplay state

Phase 1 does **not** change:

- Chronica Specification documents
- Runtime contracts (`ChronicaRuntime`, `PlayerHost`, compat layer)
- Save format
- Compiler validation gates
- `.chronica` package structure

All gameplay still executes through existing `variables.*`, `memory.*`, conditions, effects, and action strings.

## Phase 2 — Player-facing feedback

Phase 2 adds **lightweight playtest/player UI** that **reads** Phase 1 catalogs and existing runtime state. It does **not** introduce a new runtime gameplay system.

| Surface | Behavior |
|---------|----------|
| **Inventory HUD** | Shows collected items from catalog `stateKey` values; hidden when empty |
| **Objective tracker** | Active objectives visible; completed objectives in a collapsible history section |
| **Interaction toast** | Short feedback after hotspot actions (pickup, door unlocked, objective updated, inspect text) |
| **Scene preview (editor)** | Lists inventory/objectives/world flags referenced in the current scene |

Phase 1 authoring creates deterministic state. Phase 2 displays that state during playtest and Chronica Player mode.

Phase 2 still does **not** change:

- Action grammar
- Save envelope
- Compiler hash behavior
- Package structure
- Compat runtime

## Phase 3 — Gameplay templates

Phase 3 adds **creator-facing templates** that generate Phase 1 catalog entries, hotspot metadata, and suggested conditions/actions. Templates never introduce new runtime paths.

| Template | Creates |
|----------|---------|
| **Collect Item** | Inventory item, collect hotspot, `variables.has_*` state, pickup feedback, optional objective |
| **Locked Door** | Key item, door world flag, use-item hotspot, unlock action, optional objective |
| **Find Clue** | Memory or inventory clue state, inspect hotspot, objective, optional NPC dialogue condition |
| **Talk to NPC** | NPC profile, stage actor, met flag hotspot, dialogue condition helpers |
| **Simple Quest** | Objective, required item condition, completion memory key helpers |

Use **Template** on the Gameplay screen (catalog only) or **Add gameplay template** in a scene editor (catalog + hotspot/stage actor on the current scene). Review the preview, then apply.

### Example — Collect Item

Applying **Collect Item** with label `Lantern` generates:

- Inventory: `Lantern` → `variables.has_lantern`
- Hotspot: collect interaction, one-shot, action `variables.has_lantern = true`
- Objective: `Collect Lantern` when `variables.has_lantern == true`
- Player toast: `Picked up Lantern`

### Example — Locked Door

Applying **Locked Door** with door `Harbor gate` and key `Rusty key` generates:

- World flag: `memory.harbor_gate_unlocked`
- Key item: `variables.has_rusty_key`
- Hotspot: use-item requiring the key, action sets the door flag
- Objective: `Unlock Harbor gate`

## Phase 4 — Gameplay Components

Phase 4 adds **reusable Gameplay Components** — authoring prefabs (like Unity Prefabs or Godot Scenes) that expand into existing Phase 1 catalogs and scene patches.

There is **no runtime concept** called `GameplayComponent`. Components are editor accelerators only.

| Component | Creates |
|-----------|---------|
| **Treasure Chest** | Collect hotspot, inventory reward, opened memory flag, optional objective |
| **Door** | Door hotspot, open/locked world flag, optional required key |
| **NPC** | Stage actor, NPC profile, met flag, talk hotspot |
| **Collectible** | Inventory item, pickup hotspot, optional objective |
| **Puzzle Switch** | Toggle hotspots (on/off), press counter, world flag, objective hook |
| **Checkpoint** | Inspect hotspot, save hint text, reached memory flag |

Use **Components** on the Gameplay screen (catalog only) or **Add gameplay component** in a scene editor. Search, filter by category, preview, then insert. All generated inventory entries, objectives, hotspots, and stage actors remain fully editable.

Components expand into the same deterministic `variables.*` / `memory.*` state transitions as hand-authored gameplay.

## Where to author

| Surface | Path |
|---------|------|
| Gameplay catalogs | Project → **Gameplay** (layers icon) |
| Gameplay templates | Gameplay screen → **Template**, or scene editor → **Add gameplay template** |
| Gameplay components | Gameplay screen → **Components**, or scene editor → **Add gameplay component** |
| Hotspot interactions | Scene editor → Interactive hotspots |
| Stage actors + NPC state | Scene editor → Stage actors |
| Scene gameplay preview | Scene editor → **Scene gameplay preview** panel |

## Mapping conventions

| Authoring concept | Runtime path |
|-------------------|--------------|
| Inventory item owned | `variables.has_<item> == true` or `memory.<item> == true` |
| World flag | `memory.door_unlocked`, `variables.bridge_down`, … |
| Objective progress | Reuse `completeWhen` / `failWhen` condition strings in scenes |
| NPC posture | `variables.<npc>_state == "idle"` + stage actor `visibleWhen` |
| Hotspot one-shot | `memory.hotspot_<uid>_used` guard (applied via **Apply interaction**) |

Use **Apply interaction** on hotspots to write suggested action/condition strings from the metadata.

## Helpers

- `engine/gameplay-authoring.ts` — catalog validation, hotspot interaction synthesis, initial-state sync
- `engine/editor-helpers.ts` — `buildGameplaySuggestions()`, `extractProjectMemoryFlags()`
- `engine/gameplay-feedback.ts` — inventory/objective resolution for player UI, hotspot feedback messages, scene preview
- `engine/gameplay-templates.ts` — template builders, catalog merge, scene patch helpers
- `engine/gameplay-components.ts` — component library, instantiation, catalog merge

## Next phases

Future work can add custom user components, placement tools, and HUD polish without changing the Phase 1 catalog shapes.
