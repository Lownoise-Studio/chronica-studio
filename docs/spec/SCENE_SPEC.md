# Scene Specification

Defines the **scene model** — how authored story structure maps to runtime presentation and interaction.

## Project structure

A **project** contains:

- Metadata (`gameId`, title, description, timestamps)
- Bootstrap (`startLocation`, `initialVariables`, `initialMemory`)
- `fragments[]` — scene records
- `assets[]` — media catalog
- `characters[]` — cast definitions (optional)

Projects carry **`schemaVersion`** for migration.

## Fragment (scene)

Each fragment represents a candidate scene at a **location id**:

| Field | Purpose |
|-------|---------|
| `uid` | Stable editor identity |
| `locationId` | Graph node id; actions use `goto:<locationId>` |
| `title` | Display name |
| `priority` | When multiple fragments share a location, highest priority whose conditions pass wins |
| `conditions` | Gate fragment activation |
| `effects` | Entry mutations when fragment becomes active |
| `text` | Legacy body text (used when dialogue empty) |
| `dialogue` | Ordered dialogue lines (preferred) |
| `choices` | Player choices when dialogue exhausted |
| `hotspots` | Normalized tap regions with actions |
| `stageActors` | Sprites on scene stage |
| `backgroundImage` | Asset name for background |
| `backgroundAudio` | Asset name for loop audio |

## Dialogue

Each dialogue line:

| Field | Purpose |
|-------|---------|
| `uid` | Stable identity |
| `speakerId` | Character id, or null/omit for narration |
| `expressionId` | Optional expression key for portrait/sprite |
| `text` | Line content |

Runtime tracks **`dialogueLineIndex`** in state. Choices and hotspots typically appear only after dialogue is exhausted unless specification defines otherwise.

## Choices

| Field | Purpose |
|-------|---------|
| `uid` | Stable identity; maps to compiled actions |
| `label` | Player-facing text |
| `action` | Action string |
| `conditions` | Visibility gate |

## Hotspots

Normalized **0–1 coordinates** relative to scene stage:

| Field | Purpose |
|-------|---------|
| `uid`, `label` | Identity and accessibility |
| `x`, `y`, `width`, `height` | Bounds |
| `action`, `conditions` | Same grammar as choices |

## Stage actors

Sprites placed on a logical stage (not tile maps):

| Field | Purpose |
|-------|---------|
| `uid`, `label` | Identity |
| `asset` | Default sprite asset name |
| `x`, `y` | Position (center x, feet y) in 0–1 space |
| `width`, `scale`, `zIndex` | Layout |
| `expressions` | Map expression id → asset name |
| `expressionFromVariable` | State path selecting expression id |
| `visibleWhen` | Condition list |

## Location resolution

At runtime, **location** in state selects candidate fragments sharing `locationId`. Highest **priority** fragment whose **conditions** pass becomes active.

## Supported gameplay focus (current)

Public implementations today emphasize **state-driven interactive fiction**—branching narrative, dialogue, light adventure hotspots, and stage presentation.

The scene model is designed to **extend** as the specification adds gameplay models without breaking portable packages.

## Related documents

- [Event specification](./EVENT_SPEC.md)
- [Asset specification](./ASSET_SPEC.md)
- [Rendering specification](./RENDERING_SPEC.md)
