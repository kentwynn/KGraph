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
- Which notes, decisions, debugging findings, and gotchas were captured from prior sessions.
- Which cognition references are current, mixed, stale, or unresolved after code moves.

Then an AI assistant can ask for focused context before broad exploration:

```bash
kgraph "blog admin token usage"
```

Instead of reading the whole repo, it gets a compact starting point: relevant files, symbols, relationships, domains, prior notes, and stale references to watch.

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

# 3. Run the normal workflow for a topic
kgraph "auth token refresh"

# 4. Check health if something feels off
kgraph doctor
```

After useful AI work, assistants can save durable notes into `.kgraph/inbox/`. The next `kgraph` run processes those notes automatically. You can also process them directly with `kgraph update`.

Normal agent flow is intentionally small:

```bash
kgraph "topic"
# work normally
# if repo files changed, write an inbox note when the change has future value
kgraph
```

Use `kgraph doctor --quality` and `kgraph repair --dry-run` only when stale or noisy cognition references start making context harder to trust.

## Main Commands

```bash
kgraph init
```

Required once per repo. Creates `.kgraph/` and the local config.

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

Checks whether the workspace is initialized, maps exist, inbox notes are pending, and configured integrations point to real files. Use `--quality` when context shows stale/noisy cognition references.

```bash
kgraph repair --dry-run
kgraph repair
```

`repair --dry-run` previews cleanup for noisy cognition references, such as framework names recorded as files or local variables recorded as symbols. `repair` applies that cleanup. Run repair intentionally when stale references make context noisy; it is not part of every normal workflow.

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
kgraph history --json
```

Show processed cognition sessions.

## AI Tool Integrations

KGraph integrations are local files. They do not start background agents, call AI providers, or send data anywhere.

```bash
kgraph integrate add codex copilot cursor claude-code gemini windsurf cline
kgraph integrate list
kgraph integrate remove cursor
```

| Tool | Files KGraph manages |
| --- | --- |
| Codex | `AGENTS.md`, `.agents/skills/kgraph/SKILL.md` |
| GitHub Copilot | `.github/copilot-instructions.md`, `.github/prompts/*` |
| Cursor | `.cursor/rules/kgraph.mdc` |
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
└── context/
```

The files are local, inspectable, and human-readable. There is no database, telemetry, cloud service, account, API key, embedding service, or model provider.

## Language Support

KGraph deeply scans:

- TypeScript and JavaScript
- Python
- Go
- Rust
- Java and Kotlin
- C and C++
- C#

Other common file types still appear in the file map with generic metadata, so context queries can still point to docs, config, SQL, CSS, HTML, YAML, and similar files.

## Visualization

```bash
kgraph visualize
```

The graph shows files, symbols, imports, cognition notes, and relationship edges. Cognition notes are colored by reference health:

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
- Assistant-friendly: one normal command, with lower-level commands available when needed.

## Roadmap

- Smarter cross-file symbol and call relationship inference.
- Stronger TypeScript path alias and package export resolution.
- Richer graph filtering for large repositories.
- Optional MCP server for editor tool-call access.
- Team workflows for shared committed cognition.
