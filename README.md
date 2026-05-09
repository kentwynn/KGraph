# KGraph

Persistent repository intelligence for AI coding tools.

KGraph is a local-first CLI that builds an inspectable knowledge layer for a codebase. It helps tools like Codex, GitHub Copilot, Cursor, and Claude Code reuse repository structure, workflow knowledge, debugging history, and architecture decisions instead of rediscovering them in every chat.

## Why It Matters

AI coding sessions spend a large part of their budget finding context: reading files, tracing imports, locating the right functions, and re-learning decisions that were already discovered in previous work.

KGraph turns that repeated exploration into durable repository intelligence:

```text
AI chat or developer note
-> KGraph cognition inbox
-> structured repo knowledge
-> compact context for future AI sessions
```

The result is faster navigation, lower token waste, and more consistent understanding across coding sessions.

## Install

Run the latest published package:

```bash
npx @kentwynn/kgraph@latest init
```

Run a specific stable version:

```bash
npx @kentwynn/kgraph@0.1.0 init
```

Install globally if you use KGraph often:

```bash
npm install -g @kentwynn/kgraph@latest
kgraph --version
```

## Quick Start

Initialize KGraph in a repository and connect your AI tools:

```bash
kgraph init --integrations codex,copilot,cursor
```

Scan the codebase:

```bash
kgraph scan
```

Ask for compact context before working on an area:

```bash
kgraph context "auth token refresh"
```

Process saved chat notes and debugging conclusions:

```bash
kgraph update
```

## CLI

```bash
kgraph init
kgraph init --integrations codex,cursor
kgraph integrate list
kgraph integrate add codex copilot cursor claude-code
kgraph integrate remove cursor
kgraph scan
kgraph update
kgraph context "auth token refresh"
kgraph context "auth token refresh" --json
```

## AI Tool Integrations

KGraph writes local instruction files so AI tools know how to use the repository knowledge layer during normal coding chats.

| Integration | Instruction file |
| --- | --- |
| Codex | `AGENTS.md` |
| GitHub Copilot | `.github/copilot-instructions.md` |
| Cursor | `.cursor/rules/kgraph.mdc` |
| Claude Code | `CLAUDE.md` |

Example:

```bash
kgraph integrate add codex cursor
kgraph integrate list
```

Generated instructions teach AI tools to:

- query `kgraph context "<topic>"` before broad repo exploration
- save useful architecture, workflow, and debugging discoveries to `.kgraph/inbox/`
- run `kgraph update` to turn notes into durable cognition
- run `kgraph scan` after refactors, file moves, or renamed functions

KGraph-managed instruction blocks preserve existing user-authored content.

## Features

- Local `.kgraph/` workspace for repository intelligence
- JavaScript and TypeScript file, import, export, function, class, and method maps
- Deterministic relationship maps between files and symbols
- Markdown cognition inbox for AI chat summaries, decisions, gotchas, and debugging notes
- Compact context output for AI assistants and scripts
- JSON output for tool-friendly context retrieval
- Integration management for Codex, Copilot, Cursor, and Claude Code
- Stale-reference handling when code changes over time
- Local-first storage with human-readable JSON, YAML, and Markdown

## How KGraph Grows

KGraph is designed to improve as the project changes:

```text
kgraph scan
  refreshes current structure

AI chat or developer note
  captures useful reasoning in .kgraph/inbox/

kgraph update
  converts notes into durable cognition

kgraph context "<topic>"
  returns focused repository context for future work
```

This creates a feedback loop where normal development and AI-assisted debugging gradually improve the repository knowledge map.

## Local-First

KGraph stores project intelligence in local files inside `.kgraph/`. The MVP does not require accounts, telemetry, hosted services, databases, model providers, embeddings, or background daemons.

## Development

```bash
npm install
npm run build
npm test
npm run kgraph -- init --integrations codex,cursor
```

## Release

CI runs build, tests, package checks, and generated-artifact hygiene on pushes and pull requests. Tagged releases publish the npm package and upload the packed artifact through GitHub Actions.

## Roadmap

- richer language scanners
- better cognition extraction
- graph visualization
- Git-aware history and rename detection
- optional editor and MCP integrations
