# Rendering Specification

Defines the boundary between **gameplay state** and **presentation**. Chronica runtimes produce presentation **inputs**; host implementations choose render technology.

## Core rule

**Presentation defines appearance. Gameplay modules define rules.**

Player UI, adventure layouts, visual novel chrome, and audio playback display runtime output—they do not decide branching, visibility conditions, or state mutations.

## Presentation inputs

Hosts consume runtime/host output:

| Input | Typical rendering |
|-------|-------------------|
| Background image URI | Full-bleed or letterboxed image |
| Background audio URI | Looping ambience/music |
| Dialogue text + speaker | Caption or dialogue card |
| Character portrait URI | Portrait slot (when speaker present) |
| Stage actors | Sprites at normalized stage coordinates |
| Hotspots | Invisible or guided touch targets |
| Choices | List or button chrome |

## Layout modes

Implementations may support multiple **presentation profiles** for the same runtime data:

- Plain text panel (no scene media)
- Image-backed reading panel
- Adventure layout (stage + interaction sheet)

Profile selection is host configuration—not a change to compiled game rules.

## Stage coordinate system

Stage actors and hotspots use **normalized 0–1 coordinates** relative to the scene stage rectangle:

- Hotspots: `x`, `y`, `width`, `height` from top-left
- Actors: `x` center, `y` feet line; `width` as fraction of stage width

Different aspect ratios may letterbox; hit testing must map to the same logical bounds.

## Expression and visibility

Stage actor sprites resolve from:

1. `expressionFromVariable` state lookup → expression id → asset
2. Default `asset` when no expression matches

Actors with failing `visibleWhen` conditions are omitted from presentation inputs.

## Evolution

The specification is designed to **add presentation capabilities over time**—for example layered audio, portrait variants, parallax stages, or 3D presentation profiles—without changing the authoritative game state model.

New capabilities appear as:

- Additional presentation inputs from runtime/host, or
- Amended scene/asset records in the specification

Implementations advertise supported presentation profiles; packages remain valid if they degrade gracefully when a profile is unsupported.

## Accessibility

Hosts should provide non-visual or alternative interaction paths (e.g. labeled hotspot lists) where platform guidelines require—without duplicating game rules in alternate code paths.

## Related documents

- [Runtime specification](./RUNTIME_SPEC.md)
- [Scene specification](./SCENE_SPEC.md)
- [Asset specification](./ASSET_SPEC.md)
