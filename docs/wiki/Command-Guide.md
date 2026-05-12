# Command Guide

KGraph's main workflow is intentionally small:

```bash
kgraph init
kgraph "auth token refresh"
kgraph doctor
```

## `kgraph init`

Creates the local `.kgraph/` workspace, writes config, and runs the first scan.

```bash
kgraph init
kgraph init --integrations codex,copilot,cursor,claude-code,gemini,windsurf,cline
```

## `kgraph "topic"`

Runs the normal refresh workflow and returns focused context for a topic.

```bash
kgraph "blog admin token usage"
```

The workflow refreshes maps, processes pending cognition notes, and returns compact context.

## `kgraph doctor`

Checks whether the repo-local KGraph setup is usable.

```bash
kgraph doctor
kgraph doctor --quality
```

Use `--quality` when context feels stale, noisy, or incomplete.

## `kgraph impact`

Shows practical impact for a file, symbol, or topic.

```bash
kgraph impact "Button"
kgraph impact "createSession" --json
```

Impact output includes matched files, symbols, imports, callers, callees, cognition, and risk hints.

## `kgraph session`

Tracks agent-reported read/write activity and repeated reads.

```bash
kgraph session
kgraph session start --agent codex
kgraph session read src/auth.ts --agent codex
kgraph session write src/auth.ts --agent codex
kgraph session end --agent codex
```

Session capture is optional, but it helps show where repeated repo exploration wastes tokens.

## `kgraph visualize`

Starts the local interactive dependency graph.

```bash
kgraph visualize
kgraph visualize --port 3000
kgraph visualize --no-open
```
