---
name: pnpm install strategy
description: How to successfully run pnpm install in this workspace without timeout
---

The workspace-root `pnpm install` hangs indefinitely when run plainly (even 90s timeout produces no output).

**Rule:** Always use `--prefer-offline --no-frozen-lockfile` flags, and run as a background job with a sleep-kill wrapper:

```bash
pnpm install --prefer-offline --no-frozen-lockfile 2>&1 | tail -20 &
BGPID=$!
sleep 80 && kill $BGPID 2>/dev/null; wait $BGPID 2>/dev/null
```

**Why:** The pnpm global store already has most packages cached. The `--prefer-offline` flag resolves from cache without hitting the network, completing in ~75 seconds. Without it, the process hangs, likely due to network/registry latency.

**How to apply:** Any time new packages are added to any artifact's package.json, run with these flags. New artifacts (like chronica-mobile) that have never had node_modules installed also need this — the first install added 1108 packages in ~75s from cache.
