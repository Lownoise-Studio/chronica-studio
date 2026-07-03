# Chronica Mobile Studio

**The first public implementation of the Chronica Platform.**

Chronica Mobile Studio is a mobile-first implementation of the Chronica Platform, allowing creators to build, test, and play portable `.chronica` games directly on mobile devices.

→ **[Why Chronica?](../../WHY_CHRONICA.md)** · **[Chronica Specification](../../docs/spec/README.md)** · **[Architecture](docs/ARCHITECTURE.md)**

## Platform

```
Chronica
├── Chronica Specification
├── Chronica Studio              ← desktop / professional authoring
├── Chronica Mobile Studio       ← this app
└── Chronica Player              ← play-only mode in this app
```

## Design principles

- **Specification-first architecture**
- **Portable `.chronica` packages**
- **Behavioral parity across implementations**
- **Feature parity with workflow divergence**
- **Touch-first creation experience**

## What this app provides

| Area | Description |
|------|-------------|
| **Mobile authoring** | Scenes, dialogue, characters, hotspots, variables, assets |
| **Chronica Player** | Standalone play mode (`pnpm start:player`) |
| **`.chronica` packages** | Export, import, integrity-checked round-trip |
| **Runtime** | Deterministic session execution, choices, hotspots, saves |
| **Presentation** | Adventure layout, stage actors, touch hotspots |

Current public implementation focuses on **state-driven gameplay models**. The Chronica Specification is designed to evolve to support additional presentation capabilities over time.

## Stack

React Native + Expo · TypeScript module core (`engine/`, `runtime/`, `storage/`) · Jest

## Scripts

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm exec expo start          # Chronica Mobile Studio (authoring)
pnpm start:player           # Chronica Player
pnpm build:pasture-art      # Regenerate bundled Pasture demo art
```

## Documentation

- [Why Chronica?](../../WHY_CHRONICA.md)
- [Chronica Specification](../../docs/spec/README.md)
- [Architecture & compliance](docs/ARCHITECTURE.md)
- [`.chronica` package boundary](docs/package-round-trip.md)

## License

Chronica Mobile Studio by [Lownoise Studio](https://lownoise.studio).
