<div align="center">

<img src="media/logo.svg" alt="KGraph Atom Core Logo" width="140" height="140">

# KGraph: Persistent repository intelligence for AI coding tools.

<strong>atoms · evidence · context packs</strong>

<p>
  <a href="https://www.npmjs.com/package/@kentwynn/kgraph">
    <img src="https://img.shields.io/npm/v/@kentwynn/kgraph?label=npm" alt="npm version">
  </a>
  <a href="https://github.com/kentwynn/KGraph/releases/latest">
    <img src="https://img.shields.io/github/v/release/kentwynn/KGraph?label=release" alt="Latest release">
  </a>
  <a href="https://github.com/kentwynn/KGraph/actions/workflows/ci.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/kentwynn/KGraph/ci.yml?branch=main&label=ci" alt="CI">
  </a>
  <a href="https://github.com/kentwynn/KGraph/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/kentwynn/KGraph" alt="License">
  </a>
  <a href="https://nodejs.org/">
    <img src="https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white" alt="Node.js >=20">
  </a>
  <a href="https://github.com/kentwynn/KGraph/security/policy">
    <img src="https://img.shields.io/badge/security-policy-0f766e" alt="Security policy">
  </a>
  <a href="https://github.com/kentwynn/KGraph/wiki">
    <img src="https://img.shields.io/badge/docs-wiki-blue" alt="Documentation">
  </a>
  <a href="https://github.com/kentwynn/KGraph/stargazers">
    <img src="https://img.shields.io/github/stars/kentwynn/KGraph?style=social" alt="GitHub stars">
  </a>
</p>

</div>

KGraph gives Codex, GitHub Copilot, Cursor, Claude Code, Gemini CLI, Windsurf, and Cline a local knowledge layer for your repo: file maps, symbols, imports, relationships, and durable knowledge atoms from previous AI sessions. The goal is simple: your assistant should not spend every session re-learning the same codebase.

The CLI presents this as **Atom Core**: lightweight local atoms plus deterministic repo maps, context packs, and session history that remain inspectable under `.kgraph/`.

## The Workflow

Use KGraph in two steps:

```bash
# Required once per repository
kgraph init --integrations codex,copilot,cursor,claude-code,gemini,windsurf,cline

# Normal daily command
kgraph "auth token refresh"
```

That second command runs the full practical workflow:

1. Refreshes the repository scan.
2. Updates file, symbol, import, and relationship maps.
3. Processes any Markdown capture notes waiting in `.kgraph/inbox/` into knowledge atoms.
4. Returns compact context for the topic you asked about.

You can also run just:

```bash
kgraph
```

That refreshes maps and durable memory without printing topic-specific context.

The smaller commands, such as `kgraph scan`, `kgraph update`, and `kgraph context`, still exist. They are useful when you want one specific step, but they are not the main workflow.

## Why It Exists

Most AI coding sessions start like this:

```text
Let me inspect package.json.
Let me search for auth routes.
Let me trace imports.
Let me understand where sessions are stored.
```

That exploration is useful once. It is wasteful the tenth time.

KGraph stores the reusable parts locally:

- What files exist and what language they use.
- What symbols each source file defines.
- Which files import each other.
- Which TypeScript/JavaScript functions and methods directly call each other when KGraph can infer it cheaply.
- Which decisions, debugging findings, gotchas, summaries, and relationships were captured as knowledge atoms.
- Which atoms are active, need review, stale, archived, or superseded after code moves.

Then an AI assistant can ask for focused context before broad exploration:

```bash
kgraph "blog admin token usage"
```

Instead of reading the whole repo, it gets a compact starting point: relevant files, symbols, relationships, domains, knowledge atoms, and stale references to watch.
Each context item explains why it was returned, such as a path/name match, a matched atom reference, a domain match, or a nearby import relationship.

When you need change impact instead of broad context:

```bash
kgraph impact Button
```

That shows matched files/symbols, files importing the target, known callers/callees, related knowledge atoms, and simple risk signals.

## Install

The official npm package is `@kentwynn/kgraph`; the official repository is `github.com/kentwynn/KGraph`.

Use the published CLI:

```bash
npm install -g @kentwynn/kgraph@latest
kgraph --version
```

Or run without installing:

```bash
npx @kentwynn/kgraph@latest init
npx @kentwynn/kgraph@latest "auth token refresh"
```

KGraph requires Node.js 20 or newer.

KGraph's core functionality is free and local-first. It does not require accounts, telemetry, cloud services, API keys, or source-code upload.

## Quick Start

From the root of a repository:

```bash
# 1. Create the local KGraph workspace
kgraph init

# 2. Optional: connect AI tools so they know the KGraph workflow
kgraph integrate add codex copilot cursor claude-code gemini windsurf cline

# 3. Run the normal workflow for a topic
kgraph "auth token refresh"

# 4. Verify the setup and use doctor as the quality gate
kgraph doctor
```

`kgraph init` now scans once, then prints relevant next steps. When KGraph can detect likely AI tools on the machine, it recommends matching integrations.

After useful AI work, assistants save durable runtime-capture notes into `.kgraph/inbox/`. These notes are not project documentation; they are KGraph input files that the next `kgraph` run processes automatically. You can also process them directly with `kgraph update`.

Normal agent flow is intentionally small:

```bash
kgraph "topic"
# work normally
kgraph "topic" --final
# if final check requires capture:
kgraph "topic" --capture "durable conclusion" --capture-file path/to/file.ts --capture-symbol SymbolName
```

`kgraph "<topic>"` is the smart root workflow: it refreshes maps, processes capture notes, reports memory health, and returns focused context. Agents can still use `kgraph pack "<topic>" --budget 8000 --json` when they need the stable machine-readable `ContextPack` contract with atoms, source ranges, git changes, omitted items, token estimates, and inclusion reasons.

Use `kgraph doctor` after setup and before trusting a repo's saved intelligence. It checks initialization, maps, pending inbox notes, integration targets, and actionable quality problems. Use `kgraph doctor --quality` and `kgraph repair --dry-run` when stale or noisy atom references start making context harder to trust.

Agents can also report session activity so KGraph can estimate token waste:

```bash
kgraph session start --agent codex
kgraph session read src/auth.ts --agent codex
kgraph session write src/auth.ts --agent codex
kgraph session end --agent codex --conclude --topic "auth session work"
kgraph session
```

This is optional. Claude Code can use generated hook scripts for automatic capture; other agents use the same commands through their managed instructions, rules, or prompts.

## Main Commands

```bash
kgraph init
```

Required once per repo. Creates `.kgraph/`, writes the local config, runs the first scan, and prints suggested next actions based on the detected repo languages and likely local AI tools.

```bash
kgraph init --integrations codex,copilot,cursor,claude-code,gemini,windsurf,cline
```

Initializes KGraph and writes local instruction files for supported AI tools.

```bash
kgraph "some topic"
```

The normal command. Scans the repo, updates durable memory, and returns focused context for the topic.

```bash
kgraph "some topic" --final
```

End-of-work check. Refreshes intelligence and fails with `capture-required` when mapped repo files changed but no recent durable atom references those files.

```bash
kgraph "some topic" --capture "durable conclusion" --capture-file src/auth.ts --capture-symbol refreshSession
```

Stores durable cognition through the root workflow. Use `--capture-confidence high` only with file or symbol evidence.

```bash
kgraph
```

Refreshes maps and durable memory without returning topic-specific context.

```bash
kgraph doctor
kgraph doctor --quality
```

Checks whether the workspace is initialized, maps exist, inbox notes are pending, knowledge storage is valid, and configured integrations point to real files. Use `--quality` when context shows stale/noisy atom references, unresolved local imports, unresolved call edges, duplicate atom topics, or generated files in the scan.

The default doctor result is the main quality gate. It fails on actionable hygiene issues such as stale/noisy atoms, duplicate atom topics, generated integration files leaking into scans, missing maps, invalid knowledge storage, or broken integration targets. Scanner coverage counts such as unresolved local imports or unresolved call edges remain visible in `--quality`, but they do not fail the gate by themselves because they often reflect current parser limits.

```bash
kgraph repair --dry-run
kgraph repair
```

`repair --dry-run` previews cleanup for noisy atom references, such as framework names recorded as files or local variables recorded as symbols. `repair` applies only the safe noisy-reference cleanup; broader quality findings stay report-only. Run repair intentionally when stale references make context noisy; it is not part of every normal workflow.

```bash
kgraph uninstall
kgraph uninstall --yes
kgraph uninstall --keep-integrations --yes
```

`uninstall` previews repo-local removal and does not delete anything unless `--yes` is passed. `uninstall --yes` removes `.kgraph/` and KGraph-managed integration blocks/files while preserving source files and user-authored text outside managed blocks. Use `--keep-integrations --yes` to remove only `.kgraph/` while leaving AI tool instruction files in place. After uninstalling, `kgraph init` can be run again for a fresh setup.

```bash
kgraph impact "Button"
kgraph impact "createSession" --json
```

Show practical impact for a file, symbol, or topic: matched files/symbols, import users, callers, callees, ownership edges, related knowledge atoms, and risk hints.

```bash
kgraph session
kgraph session --json
kgraph session reset
kgraph session start --agent codex
kgraph session read src/auth.ts --agent codex
kgraph session write src/auth.ts --agent codex
kgraph session end --agent codex
kgraph session end --agent codex --conclude --topic "auth token refresh"
```

Track agent-reported read/write activity, repeated reads, and estimated token cost. Supported agents are `codex`, `claude-code`, `copilot`, `cursor`, `gemini`, `windsurf`, and `cline`.
The text report includes next actions, such as using `kgraph context "<topic>"` before repeated broad file inspection. Add `--conclude` to store a durable session summary with touched files attached as atom evidence.

```bash
kgraph conclude "auth refresh requires rotating the session cookie" \
  --type gotcha \
  --confidence high \
  --domain auth \
  --file src/auth.ts \
  --symbol refreshSession \
  --note "The refresh path must update both the access token and cookie expiry."
```

Store durable engineering memory directly. Knowledge atoms are typed as `finding`, `decision`, `gotcha`, `summary`, or `relationship`, and confidence is `high`, `medium`, or `low`. Keep conclusions concise: preserve expensive-to-rediscover knowledge, not raw chain-of-thought, speculative exploration, or temporary reasoning.

KGraph stores these conclusions as canonical knowledge atoms under `.kgraph/knowledge/` while keeping existing Markdown cognition files readable for compatibility.

```bash
kgraph knowledge list
kgraph knowledge list --type finding --topic auth --json
kgraph knowledge get <atom-id>
kgraph knowledge archive <atom-id>
kgraph knowledge supersede <old-id> <new-id>
```

Inspect and manage canonical knowledge atoms. Archive and supersede update lifecycle metadata; they do not delete history.

```bash
kgraph stale
kgraph stale --json
kgraph blame <atom-id>
```

Refresh atom lifecycle status against the current scan and inspect atom provenance. Changed file hashes move atoms to `needs-review`; deleted files or missing symbols move atoms to `stale`; `blame` shows the source command, agent/session/commit, evidence refs, and lifecycle links.

```bash
kgraph pack "auth token refresh" --budget 8000
kgraph pack "auth token refresh" --budget 8000 --json
```

Build a budget-aware context pack from files, source ranges, symbols, relationships, git changes, session history, and knowledge atoms. JSON output is the stable machine-readable contract for agents; text output is an Atom Core briefing for humans.

```bash
kgraph compact --dry-run
kgraph compact
```

Merge duplicate knowledge atoms and archive low-confidence stale entries. Compaction operates on `.kgraph/knowledge/atoms.jsonl` first, then regenerates indexes and compatibility domain records so future context responses use the atom lifecycle as the source of truth.

## Optional Step Commands

These are useful for scripting, debugging, or when you want a single operation.

```bash
kgraph scan
```

Refresh only the structural maps in `.kgraph/map/`.

If the repository is a git repo, KGraph stores the HEAD commit hash with the scan result. On the next scan it computes which files changed since that commit using `git diff --name-only` and skips unchanged files without any filesystem `stat()` calls. In large repos this is measurably faster than the mtime+size fallback, which still runs automatically in non-git directories.

```bash
kgraph context "auth token refresh"
kgraph context "auth token refresh" --json
```

Return context from existing maps and knowledge atoms without scanning or updating first.
Markdown output includes the reason each file, symbol, knowledge atom, nearby symbol, or relationship was selected. Use `--json` when an agent or script needs the same explanation data programmatically.

Context output includes a **Recent Git Changes** section that surfaces files with staged edits, unstaged edits, or changes in recent commits. This lets AI agents know which files are actively in flux without running a separate `git status` or `git log`.

```bash
kgraph update
kgraph update --dry-run
```

Process Markdown capture notes from `.kgraph/inbox/` into durable knowledge atoms and compatibility Markdown.

```bash
kgraph visualize
kgraph visualize --port 3000
kgraph visualize --no-open
```

Open the local interactive dependency graph at `http://localhost:4242`.

```bash
kgraph history
kgraph history --last 10
kgraph history "blog button"
kgraph history --json
```

Show processed capture history. Add a query to find historical work by title, summary, file, symbol, or note body.

## AI Tool Integrations

KGraph integrations are local files. They do not start background agents, call AI providers, or send data anywhere.

```bash
kgraph integrate add codex copilot cursor claude-code gemini windsurf cline
kgraph integrate add copilot --mode smart
kgraph integrate set copilot --mode manual
kgraph integrate list
kgraph integrate remove cursor
```

New integrations default to `always` mode, so every chat in the repository starts with `kgraph "<topic>"`. Use `--mode smart` to run KGraph only for repo-specific work, or `--mode manual` to run only when explicitly asked.

| Mode     | Behavior                                                                                                                                                                                                |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `always` | Every chat in the repository starts with `kgraph "<topic>"`, even simple or conversational requests.                                                                                                    |
| `smart`  | Runs KGraph automatically for repo-specific coding, debugging, architecture, refactor, review, or file-exploration requests. Skips simple conversational requests that do not depend on repo knowledge. |
| `manual` | Exposes KGraph commands and instructions, but the agent runs KGraph only when the user explicitly asks.                                                                                                 |
| `off`    | Disables that integration and removes generated KGraph instruction blocks/command files.                                                                                                                |

| Tool           | Files KGraph manages                                   |
| -------------- | ------------------------------------------------------ |
| Codex          | `AGENTS.md`, `.agents/skills/kgraph/SKILL.md`          |
| GitHub Copilot | `.github/copilot-instructions.md`, `.github/prompts/*` |
| Cursor         | `.cursor/rules/kgraph.mdc`                             |
| Claude Code    | `CLAUDE.md`, `.claude/commands/*`                      |
| Gemini CLI     | `GEMINI.md`                                            |
| Windsurf       | `.windsurf/rules/kgraph.md`                            |
| Cline          | `.clinerules/kgraph.md`                                |

Antigravity is supported through the existing agent instruction surfaces it can read, especially `AGENTS.md` and `GEMINI.md`; it does not need a separate KGraph adapter yet.

KGraph preserves existing user-authored content and updates only its marked instruction blocks or generated command files.

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
├── knowledge/
│   ├── atoms.jsonl
│   ├── schema.json
│   └── indexes/
└── context/
```

The files are local, inspectable, and human-readable. `knowledge/atoms.jsonl` is the canonical durable-memory store; Markdown cognition remains a compatibility and input layer. Core KGraph functionality is free. There is no database, telemetry, cloud service, account, API key, embedding service, model provider, or source-code upload.

## Language Support

KGraph deeply scans:

- TypeScript and JavaScript, including lightweight function/method call relationships
- Python
- Go
- Rust
- Java and Kotlin
- C and C++
- C#

Other languages keep practical file, import, and symbol depth without full call graph analysis. Common file types still appear in the file map with generic metadata, so context queries can still point to docs, config, SQL, CSS, HTML, YAML, and similar files.

## Visualization

```bash
kgraph visualize
```

The graph shows files, imports, TypeScript/JavaScript call edges, ownership edges, relationship edges, and canonical knowledge atoms. Symbols are kept out of the main rendered graph for performance and shown in the file detail panel instead. Atom nodes are capped in large memory sets and colored by lifecycle status:

- active
- needs-review
- stale

Use it when you want to inspect what KGraph currently knows, find stale atoms after refactors, or export a graph image for a report.

## Development

```bash
npm install
npm run build
npm test
```

Run the local TypeScript CLI without installing globally:

```bash
npm run kgraph -- init
npm run kgraph -- "auth token refresh"
npm run kgraph -- doctor
npm run kgraph -- doctor --quality
npm run kgraph -- repair --dry-run
```

Test the built package as a global local install:

```bash
npm run build
npm install -g .
kgraph --version
kgraph doctor
kgraph "auth token refresh"
kgraph repair --dry-run
```

Package checks:

```bash
npm run pack:dry
npm run release:pack
```

## Release

Releases are PR-first because `main` is protected. Use the Makefile helper to bump the version on a release branch, push it, and open a pull request when the GitHub CLI is available:

```bash
make release
```

Use `RELEASE=minor` or `RELEASE=major` when needed:

```bash
make release RELEASE=minor
```

After the PR is merged, tag the merged commit from an up-to-date `main`:

```bash
make release-tag VERSION=v0.2.2
```

The release workflow builds, tests, packs, publishes the npm package on version tags, creates a GitHub Release, and uploads the tarball artifact. Do not push directly to `main` for releases.

## Design Principles

- Local-first: the repo intelligence stays in your repo.
- Explicit: no daemon and no hidden background process.
- Inspectable: generated knowledge is JSON, YAML, and Markdown.
- Deterministic first: useful ranking without requiring embeddings or a model.
- Practical impact: context, history, quality, and impact commands should answer coding questions directly from local maps.
- Assistant-friendly: one normal command, with lower-level commands available when needed.

## Roadmap

- Smarter cross-file symbol and call relationship inference.
- Stronger TypeScript path alias and package export resolution.
- Richer graph filtering for large repositories.
- Optional MCP and editor integration.
- Team-friendly shared knowledge workflows that stay local-first.
