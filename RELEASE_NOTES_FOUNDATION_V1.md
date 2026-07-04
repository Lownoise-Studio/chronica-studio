# Chronica Foundation v1

Core architecture baseline for the Chronica engine.

## Highlights

- Playable narrative adventure runtime
- Asset Pipeline Phases 1–5
- Foundation Hardening Phases 1–6
- Architecture Audit P0 + P1

## Engineering guarantees

- Deterministic runtime behavior
- Deterministic package generation
- Transaction-based editor mutations
- Runtime and package compatibility checks
- Structured diagnostics with recovery classification
- Stable asset pipeline and backwards-compatible saves/packages

## Quality

- 741 passing tests
- Typecheck clean

Baseline before Visual Scene Composer and higher-level authoring tools.

## Related documentation

| Document | Description |
|----------|-------------|
| [FOUNDATION_HARDENING.md](docs/spec/FOUNDATION_HARDENING.md) | Phases 1–6 engineering reference |
| [ARCHITECTURE_AUDIT.md](docs/spec/ARCHITECTURE_AUDIT.md) | Audit findings and completed P0/P1 work |
| [ASSET_SPEC.md](docs/spec/ASSET_SPEC.md) | Asset catalog and pipeline |
| [ENGINE_CONTRACTS.md](docs/spec/ENGINE_CONTRACTS.md) | Runtime, asset, and package contracts |
| [EDITOR_TRANSACTIONS.md](docs/spec/EDITOR_TRANSACTIONS.md) | Atomic editor mutation model |
| [DIAGNOSTICS.md](docs/spec/DIAGNOSTICS.md) | Typed diagnostics and recovery |
