# Local Development — Chronica Studio Mobile

## App location

The Expo app lives at:

```
artifacts/chronica-mobile
```

From the repo root:

```bash
cd "artifacts/chronica-mobile"
```

## Workspace path contains a space

This repository path includes a space (`Chronica-Studio /Chronica-Studio-Engine`). Always quote the path in shell commands:

```bash
cd "/Users/you/Projects/Chronica-Studio /Chronica-Studio-Engine/artifacts/chronica-mobile"
```

Unquoted `cd` will fail or resolve to the wrong directory.

## Start the app locally

Install dependencies once from the repo root:

```bash
cd "/path/to/Chronica-Studio-Engine"
pnpm install
```

Start Metro with a clean cache:

```bash
cd "/path/to/Chronica-Studio-Engine/artifacts/chronica-mobile"
pnpm exec expo start -c
```

Scan the QR code with **Expo Go** on a device on the same network, or press `a` / `i` for Android emulator / iOS simulator.

### Typecheck and tests

```bash
pnpm --filter @workspace/chronica-mobile typecheck
pnpm --filter @workspace/chronica-mobile test
```

## Chronica Player (standalone shell)

The same codebase builds a **play-only** app when `EXPO_PUBLIC_CHRONICA_APP_MODE=player`:

```bash
cd "/path/to/Chronica-Studio-Engine/artifacts/chronica-mobile"
pnpm start:player
```

This opens `/player` (Open Game, Try Demo, library) instead of the editor. See [runtime-integration.md](./runtime-integration.md) for the load → compile → play pipeline and EAS build steps.

```bash
pnpm build:player:android   # EAS profile: internal APK
```

For TestFlight / App Store submit later, add real Apple credentials under `submit.production.ios` in `eas.json` (`appleId`, `ascAppId`, `appleTeamId`). Empty placeholders are invalid and will block EAS config validation.

## expo-file-system import path

Native file storage uses the legacy API via a thin adapter:

```
artifacts/chronica-mobile/storage/fileSystem.ts
```

Import path must be:

```ts
import * as FS from 'expo-file-system/legacy';
```

Do **not** use `expo-file-system/build/legacy` — it fails to resolve under pnpm/Metro.

A web stub exists at `storage/fileSystem.web.ts` for Metro web bundling.

## Replit-specific config still present

This repo was scaffolded on Replit. The following remain and are **not required** for local Cursor/GitHub development:

| Item | Notes |
|------|-------|
| `.replit`, `.replitignore`, `replit.md` | Replit deployment and agent docs |
| `artifacts/*/.replit-artifact/` | Replit service definitions |
| `.agents/` | Replit agent memory |
| `pnpm-workspace.yaml` overrides | Linux-only native binary exclusions may break macOS web bundling |
| `package.json` `"dev"` script | Sets `REPLIT_*` / `REPL_ID` env vars — use `pnpm exec expo start -c` locally instead |
| `scripts/build.js`, `server/` | Replit-hosted Expo web preview pipeline |

Local development should use `pnpm exec expo start -c` directly, not the Replit `dev` script.
