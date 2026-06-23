# Repository Cleanup Report

Audit of **Chronica-Studio-Engine** for Cursor/GitHub long-term development.

## Executive summary

This repo is a **Replit-scaffolded pnpm monorepo** with three deployable artifacts (mobile app, API server, design mockup sandbox) plus shared `lib/*` packages. The **primary product** is `artifacts/chronica-mobile`. Much of the rest is Replit platform wiring, agent scaffolding, or future backend work not yet connected to the mobile app.

**Highest-impact follow-ups (later phases):** fix **Replit-only `pnpm-workspace.yaml` platform overrides** that break macOS local dev (e.g. missing `lightningcss.darwin-arm64.node`).

---

## Safe to delete (local only — gitignored or regenerable)

| Path | Notes |
|------|-------|
| `node_modules/` | Reinstall with `pnpm install` |
| `.local/` | Replit runtime state |
| `artifacts/*/node_modules/` | Same as above |
| `artifacts/chronica-mobile/.expo/` | Expo cache |
| `**/*.tsbuildinfo` | TypeScript incremental build cache |
| `.config/npm/` | Replit npm global config stub |

**Safe when they appear:** `dist/`, `static-build/`, `web-build/`, `coverage/`, `.cache/`

---

## Safe to delete from git (later phases — not Phase 1)

| Path | Why |
|------|-----|
| `attached_assets/` | Session uploads (screenshots, zip imports) — **Phase 1: untrack + ignore only** |
| `replit.md` | Replit agent template; replace with root README when ready |
| `.replit`, `.replitignore` | Replit deployment config |
| `artifacts/*/.replit-artifact/` | Replit artifact/service definitions |
| `.agents/` | Replit agent memory (migrate notes to `docs/` first) |
| `scripts/src/hello.ts` | Placeholder scaffold |

### Conditional — if leaving Replit entirely

| Path | Why |
|------|-----|
| `artifacts/mockup-sandbox/` | Replit design canvas; not used by mobile app |
| `artifacts/chronica-mobile/scripts/build.js` | Replit Expo web deployment |
| `artifacts/chronica-mobile/server/` | Replit static build server |
| `scripts/post-merge.sh` | Replit post-merge hook |

---

## Replit-only files & config

| Item | Purpose |
|------|---------|
| `.replit` | Ports, nix, deployment, postMerge hook |
| `.replitignore` | Deploy image size reduction |
| `replit.md` | Replit agent project doc template |
| `artifacts/*/.replit-artifact/artifact.toml` | Service definitions |
| `.agents/` | Replit agent memory |
| `.local/` | Replit agent skills/state |
| `chronica-mobile` `"dev"` script | Replit env vars (`REPLIT_*`, `REPL_ID`) |
| `build.js` / `serve.js` | Replit-hosted Expo web preview |
| `app.json` expo-router origin | `https://replit.com/` |
| `mockup-sandbox/vite.config.ts` | `@replit/vite-plugin-*` when `REPL_ID` set |
| `pnpm-workspace.yaml` | `@replit/*` catalog; linux-x64-only native binary overrides |

### Critical: macOS local dev

`pnpm-workspace.yaml` overrides exclude non-Linux native binaries for `esbuild`, `lightningcss`, etc. On darwin-arm64 this can cause:

> `Cannot find module '../lightningcss.darwin-arm64.node'`

Fix in a later phase by removing or platform-conditionalizing those overrides.

---

## Build / cache artifacts

| Location | In git? | Action |
|----------|---------|--------|
| `node_modules/` | Ignored | Never commit |
| `.local/` | Ignored | Never commit |
| `**/.expo/` | Ignored | Never commit |
| `**/*.tsbuildinfo` | Ignored | Never commit |
| `static-build/` | Ignored | Never commit |
| `lib/*/generated/` | Tracked | Keep until CI codegen |
| `mockup-sandbox/src/.generated/` | Tracked | Auto-regenerated at dev time |

---

## Should stay (core codebase)

| Path | Role |
|------|------|
| `artifacts/chronica-mobile/` | Expo/React Native app — primary product |
| `artifacts/api-server/` | Express API scaffold |
| `lib/` | API spec, codegen, Drizzle scaffold |
| `artifacts/mockup-sandbox/` | Replit design canvas (optional long-term) |
| `pnpm-workspace.yaml`, lockfile, tsconfigs | Monorepo tooling |

---

## Unused / questionable (no action in Phase 1)

| Item | Finding |
|------|---------|
| `@workspace/api-client-react` in mobile | Declared but zero imports; mobile uses AsyncStorage |
| `lib/integrations/` | Listed in workspace yaml but directory missing |
| `lib/db/` schema | Empty placeholder |
| `scripts/hello.ts` | Unused placeholder |

---

## Cleanup phases

1. **Phase 1 (done):** Ignore `attached_assets/`; untrack uploads; tighten gitignore; add `docs/`.
2. **GitHub hygiene:** Root README; migrate `.agents/memory/*` to docs.
3. **Replit decoupling:** Fix platform overrides; add local Expo script without Replit env.
4. **Monorepo slimming (optional):** Remove mockup-sandbox, unused deps.
5. **Backend (if kept):** Flesh out DB schema or remove premature `db push`.
