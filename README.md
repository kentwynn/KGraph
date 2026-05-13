# KGraph

Persistent repository intelligence for AI coding tools.

KGraph gives Codex, GitHub Copilot, Cursor, Claude Code, Gemini CLI, Windsurf, and Cline a local knowledge layer for your repo: file maps, symbols, imports, relationships, and durable notes from previous AI sessions. The goal is simple: your assistant should not spend every session re-learning the same codebase.

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
3. Processes any Markdown notes waiting in `.kgraph/inbox/`.
4. Returns compact context for the topic you asked about.

You can also run just:

```bash
kgraph
```

That refreshes maps and cognition without printing topic-specific context.

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
- Which notes, decisions, debugging findings, and gotchas were captured from prior sessions.
- Which cognition references are current, mixed, stale, or unresolved after code moves.

Then an AI assistant can ask for focused context before broad exploration:

```bash
kgraph "blog admin token usage"
```

Instead of reading the whole repo, it gets a compact starting point: relevant files, symbols, relationships, domains, prior notes, and stale references to watch.
Each context item explains why it was returned, such as a path/name match, a matched cognition reference, a domain match, or a nearby import relationship.

When you need change impact instead of broad context:

```bash
kgraph impact Button
```

That shows matched files/symbols, files importing the target, known callers/callees, related cognition, and simple risk signals.

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
# if repo files changed, write an inbox note before the final refresh
kgraph
```

Use `kgraph doctor` after setup and before trusting a repo's saved intelligence. It checks initialization, maps, pending inbox notes, integration targets, and actionable quality problems. Use `kgraph doctor --quality` and `kgraph repair --dry-run` when stale or noisy cognition references start making context harder to trust.

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

The normal command. Scans the repo, updates cognition, and returns focused context for the topic.

```bash
kgraph
```

Refreshes maps and cognition without returning topic-specific context.

```bash
kgraph doctor
kgraph doctor --quality
```

Checks whether the workspace is initialized, maps exist, inbox notes are pending, and configured integrations point to real files. Use `--quality` when context shows stale/noisy cognition references, unresolved local imports, unresolved call edges, duplicate cognition titles, or generated files in the scan.

The default doctor result is the main quality gate. It fails on actionable hygiene issues such as stale/noisy cognition, duplicate cognition titles, generated integration files leaking into scans, missing maps, or broken integration targets. Scanner coverage counts such as unresolved local imports or unresolved call edges remain visible in `--quality`, but they do not fail the gate by themselves because they often reflect current parser limits.

```bash
kgraph repair --dry-run
kgraph repair
```

`repair --dry-run` previews cleanup for noisy cognition references, such as framework names recorded as files or local variables recorded as symbols. `repair` applies only the safe noisy-reference cleanup; broader quality findings stay report-only. Run repair intentionally when stale references make context noisy; it is not part of every normal workflow.

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

Show practical impact for a file, symbol, or topic: matched files/symbols, import users, callers, callees, ownership edges, related cognition, and risk hints.

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
The text report now includes next actions, such as using `kgraph context "<topic>"` before repeated broad file inspection. Add `--conclude` to store a durable session summary with touched files attached as related cognition.

```bash
kgraph conclude "auth refresh requires rotating the session cookie" \
  --type gotcha \
  --confidence high \
  --domain auth \
  --file src/auth.ts \
  --symbol refreshSession \
  --note "The refresh path must update both the access token and cookie expiry."
```

Store durable engineering memory directly. Cognition is typed as `finding`, `decision`, `gotcha`, `summary`, or `relationship`, and confidence is `high`, `medium`, or `low`. Keep conclusions concise: preserve expensive-to-rediscover knowledge, not raw chain-of-thought, speculative exploration, or temporary reasoning.

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

Build a budget-aware context pack from files, symbols, relationships, git changes, session history, and knowledge atoms. JSON output is the stable machine-readable contract for agents.

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

Return context from existing maps and cognition without scanning or updating first.
Markdown output includes the reason each file, symbol, cognition note, nearby symbol, or relationship was selected. Use `--json` when an agent or script needs the same explanation data programmatically.

Context output includes a **Recent Git Changes** section that surfaces files with staged edits, unstaged edits, or changes in recent commits. This lets AI agents know which files are actively in flux without running a separate `git status` or `git log`.

```bash
kgraph update
kgraph update --dry-run
```

Process Markdown notes from `.kgraph/inbox/` into durable cognition records.

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

Show processed cognition sessions. Add a query to find historical work by title, summary, file, symbol, or note body.

## AI Tool Integrations

KGraph integrations are local files. They do not start background agents, call AI providers, or send data anywhere.

```bash
kgraph integrate add codex copilot cursor claude-code gemini windsurf cline
kgraph integrate add copilot --mode always
kgraph integrate set copilot --mode manual
kgraph integrate list
kgraph integrate remove cursor
```

New integrations default to `smart` mode. Use `--mode always` to force KGraph on every chat, or `--mode manual` to run only when explicitly asked.

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

The graph shows files, symbols, imports, TypeScript/JavaScript call edges, ownership edges, cognition notes, and relationship edges. Cognition notes are colored by reference health:

- current
- mixed
- stale
- unresolved

Use it when you want to inspect what KGraph currently knows, find stale notes after refactors, or export a graph image for a report.

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
- Team-friendly shared cognition workflows that stay local-first.
