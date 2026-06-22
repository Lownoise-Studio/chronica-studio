---
name: expo-file-system legacy + Metro web bundler
description: expo-file-system/build/legacy cannot be resolved by Metro for the web platform; fix with a .web.ts platform stub
---

## Rule
Never import `expo-file-system/build/legacy` at the top level of a shared module.
Create a sibling `<module>.web.ts` that stubs out all exports with no-ops — Metro automatically uses the `.web.ts` version for web builds.

## Why
Metro's web bundler resolves module specifiers differently from native. The `build/legacy` sub-path is only available for the native resolver. The `.web.ts` platform override is the standard Expo/React Native solution for platform-specific code.

## How to apply
- `storage/fileSystem.ts` — native implementation (uses expo-file-system/build/legacy)
- `storage/fileSystem.web.ts` — web stub (all async functions are no-ops returning empty/undefined)
- Any new storage or native-only module: follow the same pattern

## Note
TypeScript does NOT automatically pick up `.web.ts` overrides; both files are compiled together. Design the API surface so both files share identical exported types.
