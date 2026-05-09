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

KGraph writes local instruction files and command/prompt packs so AI tools can use the repository knowledge layer during normal coding chats.

| Integration    | Always-on guidance                | KGraph command assets              |
| -------------- | --------------------------------- | ---------------------------------- |
| Codex          | `AGENTS.md`                       | `.agents/skills/kgraph/SKILL.md`   |
| GitHub Copilot | `.github/copilot-instructions.md` | `.github/prompts/kgraph.prompt.md` |
| Cursor         | `.cursor/rules/kgraph.mdc`        | Built into the KGraph Cursor rule  |
| Claude Code    | `CLAUDE.md`                       | `.claude/commands/kgraph.md`       |

Example:

```bash
kgraph integrate add codex copilot cursor claude-code
kgraph integrate list
```

This gives each supported tool one reusable KGraph entry point similar to a Spec Kit-style command:

- KGraph context: query `kgraph context "<topic>"` before broad repo exploration
- KGraph update: save durable chat/debugging/workflow discoveries to `.kgraph/inbox/`, then run `kgraph update`
- KGraph scan: run `kgraph scan` after refactors, file moves, renamed functions, or dependency changes

The exact invocation depends on the host tool. Copilot uses one prompt file, Codex uses one skill, Cursor uses one rule, and Claude Code uses one command file. Scan and update are workflows inside that single KGraph entry point, not separate duplicated commands.

KGraph-managed instruction blocks preserve existing user-authored content.

## Features

- Local `.kgraph/` workspace for repository intelligence
- JavaScript and TypeScript file, import, export, function, class, and method maps
- Deterministic relationship maps between files and symbols
- Markdown cognition inbox for AI chat summaries, decisions, gotchas, and debugging notes
- Compact context output for AI assistants and scripts
- JSON output for tool-friendly context retrieval
- Integration management and command packs for Codex, Copilot, Cursor, and Claude Code
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
```

Test a command without installing:

```bash
npm run kgraph -- init --integrations codex,cursor
npm run kgraph -- context "auth token refresh"
```

Install the local build globally to test the `kgraph` binary end-to-end:

```bash
npm install -g .
kgraph --version
kgraph init --integrations codex,copilot
```

## Release

CI runs build, tests, package checks, and generated-artifact hygiene on pushes and pull requests.

Releases are tag-driven. Bump the package version, push the commit, then push the matching tag:

```bash
npm version patch
git push origin main --follow-tags
```

The release workflow verifies that the tag matches `package.json`, checks that the npm version has not already been published, publishes the package to npm, creates a GitHub Release, and attaches the packed tarball. Manual workflow runs package the project for inspection but do not publish to npm.

## Roadmap

- richer language scanners
- better cognition extraction
- graph visualization
- Git-aware history and rename detection
- optional editor and MCP integrations
