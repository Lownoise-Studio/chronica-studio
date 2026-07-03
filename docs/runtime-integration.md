# Runtime integration

How a `.chronica` package becomes a playable session in Chronica Studio and Chronica Player.

Related: [Runtime specification](../docs/spec/RUNTIME_SPEC.md), [docs/package-round-trip.md](./package-round-trip.md).

---

## Overview

```
.chronica bytes
    → parseChronicaPackage / importProjectPackage
    → Project (hydrated assets on disk)
    → compileProject
    → CompiledGame
    → PlayerHost (session API)
    → PlayerView (presentation)
```

The **engine** owns compilation and deterministic session logic. The **runtime** (`PlayerHost`, saves) wraps the engine for play. The **app shell** (editor playtest or standalone player) loads packages and mounts `PlayerView`.

---

## Load path

1. **Pick or receive file** — document picker (`pickAndLoadGame`) or Android `VIEW` intent (`content://` / `file://` URI in player builds).
2. **Detect format** — `isChronicaPackageBytes()` (ZIP magic) vs legacy JSON (`loadGameFromBytes` in `engine/load-game.ts`).
3. **Import package** — `importProjectPackage()` in `ProjectsContext`:
   - Parses manifest + story via `parseChronicaPackage`
   - Verifies asset CRC32 when manifest includes checksums
   - Extracts embedded assets to `documentDirectory/pse_assets/{projectId}/`
   - Persists project JSON locally
4. **Navigate to play** — `/project/{id}/play?loaded=1` auto-starts when `loaded=1`.

Studio and Player share this path. Player builds use the same import + play routes; editor routes are blocked when `EXPO_PUBLIC_CHRONICA_APP_MODE=player`.

---

## Compile → session

`useChronicaRuntime(project)` (used by `play.tsx`):

| Step | Module | Output |
|------|--------|--------|
| Validate + compile | `engine/compiler` | `CompiledGame`, diagnostics |
| Bootstrap session | `runtime/player-host.ts` | `PlayerHost` |
| Resolve scene | `engine/session` | current fragment, visible choices/hotspots |
| Resolve media | `engine/asset-resolver` | background/audio URIs |
| Persist progress | `runtime/save.ts` | runtime snapshot keyed by project id |

`PlayerHost.choose()` and `PlayerHost.activateHotspot()` both produce `ActionStep[]` and share the same execution path — no `gameType` branching.

---

## Presentation

`PlayerView` renders:

- Scene text and choice buttons
- Adventure layout (stage + story sheet) when the scene has hotspots and a background
- `SceneHotspotOverlay` for tap targets
- Save / restart / back controls

Playtest (Studio) and Player use the same component. Player mode adjusts copy and routes **Back** to `/player` instead of the editor.

---

## App modes

| Mode | Env | Home | Editor |
|------|-----|------|--------|
| Studio (default) | — | `/(tabs)` | Full |
| Player | `EXPO_PUBLIC_CHRONICA_APP_MODE=player` | `/player` | Blocked |

Config: `config/app-mode.ts`, build overrides in `app.config.ts` when `CHRONICA_APP_MODE=player`.

---

## Building Chronica Player

From `artifacts/chronica-mobile`:

```bash
# Local dev (player shell)
pnpm start:player

# EAS preview APK (internal distribution)
pnpm build:player:android
```

The `player` EAS profile sets player env vars, uses bundle id `studio.lownoise.chronicaplayer`, and builds an APK for sideloading.

### Test plan

1. Export a `.chronica` from Studio (with assets + hotspots).
2. Install the player APK on a device.
3. **Open Game** → pick the package → story starts.
4. Play through choices and hotspots; save and resume.
5. **Try Demo** works offline with the bundled showcase package.

---

## Embedding a fixed game (future)

White-label builds can bundle a `.chronica` in app assets and skip the library screen. That is not implemented yet; the current player is **load-any-package** first.
