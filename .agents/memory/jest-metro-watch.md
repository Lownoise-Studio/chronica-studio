---
name: jest installation causes Metro watch failure
description: Installing jest creates temp directories in node_modules that Metro's FallbackWatcher tries to watch and fails
---

## Rule
After adding jest to an Expo project's devDependencies, add a `blockList` to `metro.config.js` that excludes jest globals temp directories.

## Why
Metro's FallbackWatcher walks all of node_modules and tries to `fs.watch()` every subdirectory it finds, including transient temp dirs created/deleted by jest at install time. These dirs may no longer exist by the time Metro starts, causing an `ENOENT: no such file or directory, watch` crash.

## How to apply
```js
// metro.config.js
config.resolver = {
  ...config.resolver,
  blockList: [
    /node_modules\/\.pnpm\/@jest\+globals@[^/]+\/node_modules\/@jest\/globals_tmp_.*/,
  ],
};
```

## Note
The symptom is: `Error: ENOENT: no such file or directory, watch '.../node_modules/.pnpm/@jest+globals@.../node_modules/@jest/globals_tmp_NNNN/build'`
