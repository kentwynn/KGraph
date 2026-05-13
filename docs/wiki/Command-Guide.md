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

The workflow refreshes maps, processes pending capture notes into knowledge atoms, and returns compact context.

## `kgraph doctor`

Checks whether the repo-local KGraph setup is usable.

```bash
kgraph doctor
kgraph doctor --quality
```

Use `--quality` when atom references feel stale, noisy, or incomplete.

## `kgraph impact`

Shows practical impact for a file, symbol, or topic.

```bash
kgraph impact "Button"
kgraph impact "createSession" --json
```

Impact output includes matched files, symbols, imports, callers, callees, related knowledge atoms, and risk hints.

## `kgraph knowledge`

Inspects and manages canonical knowledge atoms.

```bash
kgraph knowledge list
kgraph knowledge list --type finding --topic auth --json
kgraph knowledge get <atom-id>
kgraph knowledge archive <atom-id>
kgraph knowledge supersede <old-id> <new-id>
```

Archive and supersede update lifecycle metadata; they do not delete history.

## `kgraph stale` and `kgraph blame`

Refresh atom lifecycle status against the current scan and inspect provenance.

```bash
kgraph stale
kgraph stale --json
kgraph blame <atom-id>
kgraph blame <atom-id> --json
```

Changed file hashes move atoms to `needs-review`; deleted files or missing symbols move atoms to `stale`.

## `kgraph pack`

Builds a budget-aware context pack for agents and scripts.

```bash
kgraph pack "auth token refresh" --budget 8000
kgraph pack "auth token refresh" --budget 8000 --json
```

JSON output is the stable machine-readable context-pack contract.

## `kgraph compact` and `kgraph repair`

Keeps durable memory low-noise.

```bash
kgraph compact --dry-run
kgraph compact
kgraph repair --dry-run
kgraph repair
```

`compact` merges duplicate atoms and archives low-confidence stale atoms. `repair` cleans noisy atom references, such as framework names recorded as files or local variables recorded as symbols.

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

The graph shows files, imports, relationship edges, and canonical knowledge atoms. Symbols are shown in the file detail panel for performance.
