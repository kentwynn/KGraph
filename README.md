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

When you need change impact instead of broad context:

```bash
kgraph impact Button
```

That shows matched files/symbols, files importing the target, known callers/callees, related cognition, and simple risk signals.

## Install

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

## Quick Start

From the root of a repository:

```bash
# 1. Create the local KGraph workspace
kgraph init

# 2. Optional: connect AI tools so they know the KGraph workflow
kgraph integrate add codex copilot cursor claude-code gemini windsurf cline

# 3. Optional: configure deep language extractors for non-TS repos
kgraph extractor add jvm python

# 4. Run the normal workflow for a topic
kgraph "auth token refresh"

# 5. Check health if something feels off
kgraph doctor
```

`kgraph init` now scans once, then prints relevant next steps. When KGraph can detect likely AI tools on the machine, it recommends matching integrations. When the repository contains languages that only have basic built-in extraction today, it recommends optional deep extractors and prints the exact install/configure commands.

After useful AI work, assistants save durable runtime-capture notes into `.kgraph/inbox/`. These notes are not project documentation; they are KGraph input files that the next `kgraph` run processes automatically. You can also process them directly with `kgraph update`.

Normal agent flow is intentionally small:

```bash
kgraph "topic"
# work normally
# if repo files changed, write an inbox note before the final refresh
kgraph
```

Use `kgraph doctor --quality` and `kgraph repair --dry-run` only when stale or noisy cognition references start making context harder to trust.

Agents can also report session activity so KGraph can estimate token waste:

```bash
kgraph session start --agent codex
kgraph session read src/auth.ts --agent codex
kgraph session write src/auth.ts --agent codex
kgraph session end --agent codex
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

```bash
kgraph repair --dry-run
kgraph repair
```

`repair --dry-run` previews cleanup for noisy cognition references, such as framework names recorded as files or local variables recorded as symbols. `repair` applies only the safe noisy-reference cleanup; broader quality findings stay report-only. Run repair intentionally when stale references make context noisy; it is not part of every normal workflow.

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
```

Track agent-reported read/write activity, repeated reads, and estimated token cost. Supported agents are `codex`, `claude-code`, `copilot`, `cursor`, `gemini`, `windsurf`, and `cline`.

## Optional Step Commands

These are useful for scripting, debugging, or when you want a single operation.

```bash
kgraph scan
```

Refresh only the structural maps in `.kgraph/map/`.

```bash
kgraph context "auth token refresh"
kgraph context "auth token refresh" --json
```

Return context from existing maps and cognition without scanning or updating first.

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

New integrations default to `always` mode because coding agents often under-classify small UI, route, button, and link changes as not needing repo context.

| Mode | Behavior |
| --- | --- |
| `always` | Every chat in the repository starts with `kgraph "<topic>"`, even simple or conversational requests. |
| `smart` | Runs KGraph automatically for repo-specific coding, debugging, architecture, refactor, review, or file-exploration requests. Skips simple conversational requests that do not depend on repo knowledge. |
| `manual` | Exposes KGraph commands and instructions, but the agent runs KGraph only when the user explicitly asks. |
| `off` | Disables that integration and removes generated KGraph instruction blocks/command files. |

| Tool | Files KGraph manages |
| --- | --- |
| Codex | `AGENTS.md`, `.agents/skills/kgraph/SKILL.md` |
| GitHub Copilot | `.github/copilot-instructions.md`, `.github/prompts/*` |
| Cursor | `.cursor/rules/kgraph.mdc` |

## Optional Deep Extractors

KGraph ships with built-in extractors for several languages, but TypeScript and JavaScript still have the deepest built-in analysis today. For languages such as Java, Kotlin, Python, Go, Rust, C/C++, and C#, `kgraph init` can recommend optional deep extractors when those languages are detected in the repository.

```bash
kgraph extractor list
kgraph extractor add jvm python
kgraph extractor remove jvm
```

`extractor add` writes extractor configuration into `.kgraph/config.yaml` and prints the exact `npm install -D ...` command for the matching optional packages. This is explicit on purpose: KGraph recommends install commands by default rather than silently changing package-manager state.
| Claude Code | `CLAUDE.md`, `.claude/commands/*` |
| Gemini CLI | `GEMINI.md` |
| Windsurf | `.windsurf/rules/kgraph.md` |
| Cline | `.clinerules/kgraph.md` |

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
└── context/
```

The files are local, inspectable, and human-readable. There is no database, telemetry, cloud service, account, API key, embedding service, or model provider.

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

Releases are tag-driven:

```bash
npm version patch
git push origin main --follow-tags
```

The release workflow builds, tests, packs, publishes the npm package on version tags, creates a GitHub Release, and uploads the tarball artifact.

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
- Optional MCP server for editor tool-call access.
- Team workflows for shared committed cognition.
