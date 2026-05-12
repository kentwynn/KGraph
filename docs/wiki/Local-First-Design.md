# Local-First Design

KGraph stores repo intelligence locally and keeps it inspectable.

## What Gets Stored

All runtime data lives under `.kgraph/`:

```text
.kgraph/
├── config.yaml
├── map/
│   ├── files.json
│   ├── symbols.json
│   ├── dependencies.json
│   └── relationships.json
├── inbox/
├── cognition/
├── domains/
├── interactions/processed/
├── sessions/
└── context/
```

These files are local, human-readable, and safe to inspect.

## What KGraph Avoids

KGraph does not require:

- telemetry
- accounts
- cloud services
- API keys
- source-code upload
- a database
- an embedding service
- a model provider
- a background daemon

## Why Local-First Matters

AI coding tools repeatedly inspect the same package files, routes, symbols, imports, and prior decisions. KGraph keeps the reusable context in the repo so agents can start with focused context instead of broad rediscovery.
