# `.chronica` Package Round-Trip QA

Repeatable checklist for verifying asset package reliability on real devices.

## Prerequisites

- Chronica Studio mobile app on iOS or Android (not web preview)
- A test project with at least one **image** and one **audio** background assigned to scenes

## Same-device round-trip

1. Create or open a project with scenes referencing `backgroundImage` and `backgroundAudio`.
2. Confirm assets appear in the asset library and preview correctly in the scene editor.
3. Fix any validation issues shown in the project (compile must pass).
4. Export a `.chronica` package from **Export / Import**.
5. Delete the local project from the library (or use a fresh install).
6. Use **Load Game** and select the exported `.chronica` file.
7. Play the imported game:
   - Scene text and choices work
   - Background images load
   - Background audio plays (if assigned)
8. Export again from the imported project.
9. Confirm `gameId` is unchanged across import (Advanced Mode → project metadata or package manifest).

## Cross-device round-trip (recommended)

1. Export `.chronica` on Device A.
2. Transfer the file (AirDrop, Drive, email, etc.) to Device B.
3. Import on Device B via **Load Game**.
4. Play through the same scenes and verify media.

## Expected failures (by design)

| Scenario | Expected result |
|----------|-----------------|
| Export with missing referenced asset | Export blocked with diagnostic |
| Tampered asset bytes in zip | Import rejected (checksum mismatch) |
| Edited `story.json` without updating manifest hash | Import rejected |
| Broken `goto:` target in packaged story | Import rejected (compile gate) |
| Resume save after editing project | Resume rejected (stale `contentHash`) |

## Automated coverage

Run in the repo:

```bash
pnpm --filter @workspace/chronica-mobile test
```

Key suites: `chronica-package.test.ts`, `chronica-package-io.test.ts`, `identity.test.ts`, `showcase-package.test.ts`.
