---
name: jest compatibility with expo 54
description: Which jest versions work with expo 54 / react-native 0.81.5 in this workspace
---

## Rule
For expo ~54 projects, use:
- jest: ~29.7.0
- jest-expo: ~54.0.17
- @types/jest: 29.5.14

DO NOT use jest@30 or jest-expo@56+ — they cause `TypeError: this._moduleMocker.clearMocksOnScope is not a function`.

## Why
jest-expo@54 is pinned to jest@29. The jest@30 runtime module mocker API changed in a breaking way. Expo releases a compatible jest-expo version per SDK; always match them.

## How to apply
Install: `pnpm add -D "jest@~29.7.0" "jest-expo@~54.0.17" "@types/jest@29.5.14" --prefer-offline`

Expo warns in the dev server logs if versions are mismatched — check those warnings as part of install verification.
