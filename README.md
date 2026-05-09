# KGraph

> **Persistent repository intelligence for AI coding tools.**
> Stop paying the context tax on every session. KGraph gives your AI assistant a memory.

---

## The Problem

Every AI coding session starts with the same expensive ritual:

```
"Let me read your package.json..."
"Let me trace the imports in auth.ts..."
"Let me find where sessions are created..."
"Let me understand the database layer..."
```

On a medium-sized codebase, this exploration burns **3,000–8,000 tokens** before the AI writes a single line of code. Multiply that across 10 sessions per day and you're spending the majority of your context budget re-learning things you already know.

Worse: AI tools forget. The debugging insight from Tuesday, the architecture decision from last sprint, the "don't touch this or it breaks payments" gotcha — gone after every session.

---

## The Solution

KGraph builds a local knowledge layer that grows with your project. It maps your codebase once, captures reasoning from your AI sessions, and serves compact, targeted context on demand.

```
Without KGraph                     With KGraph
─────────────────────────────────  ──────────────────────────────────
Session start: ~5,000 tokens       Session start: ~300 tokens
exploring files and structure      kgraph context "auth token refresh"

Re-learns same architecture        Recalls prior decisions instantly
every single session               from cognition store

Context limit hit mid-task         Full context budget for actual work

Debugging insight lost forever     Captured in .kgraph/inbox/
                                   available in every future session
```

---

## Token Savings — What This Looks Like in Practice

A typical `kgraph context` response for a focused topic:

```
topic: auth token refresh

files:
  src/lib/auth.ts           (createSession, validateToken, refreshToken)
  app/api/auth/route.ts     (POST handler → createSession)
  middleware.ts             (reads session cookie, calls validateToken)

key relationships:
  POST /api/auth → createSession → writes JWT to cookie
  middleware → validateToken → redirects on expiry

cognition:
  refreshToken has a race condition under concurrent requests — see issue #47
  JWT secret must come from env, never hardcoded — broke staging in March
  token TTL is 15 min by design, not a bug
```

**~280 tokens.** The equivalent file-by-file exploration: **4,200+ tokens.**  
That's a **15x reduction** in context cost for navigation alone.

The gap widens every week as cognition accumulates — past decisions, debugging discoveries, and architectural gotchas that would otherwise cost the AI thousands of tokens to re-derive.

---

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                        Your Codebase                        │
└──────────────────────────────┬──────────────────────────────┘
                               │  kgraph scan
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  .kgraph/                                                   │
│  ├── maps/          file graph, symbol index, imports       │
│  ├── cognition.md   decisions, gotchas, debugging history   │
│  └── config.yaml    include/exclude rules                   │
└──────────────────────────────┬──────────────────────────────┘
                               │  kgraph context "topic"
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  AI Tool  (Copilot / Codex / Cursor / Claude Code)          │
│  Reads compact context → navigates directly → works faster  │
└─────────────────────────────────────────────────────────────┘
                               │  session ends
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  .kgraph/inbox/     AI drops a note: what it learned        │
│                     kgraph update → distilled into          │
│                     cognition.md for the next session       │
└─────────────────────────────────────────────────────────────┘
```

This creates a **compounding feedback loop**: the more you use KGraph, the richer the cognition store, the less exploration the AI needs to do.

---

## Install

```bash
npm install -g @kentwynn/kgraph@latest
kgraph --version
```

Or run without installing:

```bash
npx @kentwynn/kgraph@latest init
```

---

## Quick Start

```bash
# 1. Initialize and connect your AI tools
kgraph init --integrations codex,copilot,cursor,claude-code

# 2. Scan the codebase
kgraph scan

# 3. Ask for context before exploring (your AI does this automatically)
kgraph context "auth token refresh"

# 4. After an AI session, save what was learned
kgraph update
```

That's the entire loop. From session 2 onward, your AI tool loads existing intelligence before touching a single file.

---

## AI Tool Integrations

`kgraph integrate` writes instruction files and command/skill packs directly into your repo so each tool knows how to use the knowledge layer — no manual setup.

```bash
kgraph integrate add codex copilot cursor claude-code
kgraph integrate list
```

| Tool           | Always-on instruction             | Skills / commands                                                   |
| -------------- | --------------------------------- | ------------------------------------------------------------------- |
| GitHub Copilot | `.github/copilot-instructions.md` | `/kgraph-scan` · `/kgraph-update` · `/kgraph-visualize`             |
| Codex          | `AGENTS.md`                       | `.agents/skills/kgraph/SKILL.md` (VS Code Agent Skills standard)    |
| Cursor         | `.cursor/rules/kgraph.mdc`        | Built into the rule                                                 |
| Claude Code    | `CLAUDE.md`                       | `/kgraph` · `/kgraph-scan` · `/kgraph-update` · `/kgraph-visualize` |

Each integration installs a `/kgraph` skill or command that handles the full workflow automatically: load context → work → capture findings → update cognition. `/kgraph-scan`, `/kgraph-update`, and `/kgraph-visualize` are available for manual maintenance.

Existing user content in `AGENTS.md`, `CLAUDE.md`, etc. is preserved — KGraph manages only its own clearly-marked blocks.

---

## CLI Reference

```bash
kgraph init                                     # initialize .kgraph/ workspace
kgraph init --integrations codex,copilot        # init + configure integrations

kgraph scan                                     # scan codebase, update maps
kgraph context "auth token refresh"             # get compact context for a topic
kgraph context "auth token refresh" --json      # machine-readable output
kgraph update                                   # process inbox notes into cognition

kgraph integrate list                           # show integration status
kgraph integrate add codex copilot cursor       # add integrations
kgraph integrate remove cursor                  # remove an integration

kgraph visualize                                # interactive graph at http://localhost:4242
kgraph visualize --port 3000                    # custom port
kgraph visualize --no-open                      # print URL, don't open browser

kgraph history                                  # timeline of processed cognition sessions
kgraph history --last 10                        # show last 10 entries
kgraph history --json                           # machine-readable output
```

---

## What KGraph Tracks

| Category          | Examples                                                               |
| ----------------- | ---------------------------------------------------------------------- |
| **File map**      | every source file, language, size                                      |
| **Symbol index**  | functions, classes, methods, exports per file                          |
| **Import graph**  | which files import which, dependency chains                            |
| **Relationships** | call sites, re-exports, shared types                                   |
| **Cognition**     | past decisions, architectural constraints, debugging insights, gotchas |

Supported languages: TypeScript, JavaScript, Python, Go, Rust, Java, Kotlin, C/C++, C#, Ruby, PHP, Swift, and 30+ more — detected by file extension, no configuration needed.

---

## Local-First, Zero Dependencies

KGraph requires nothing beyond Node.js ≥ 20:

- No accounts or API keys
- No embeddings or vector databases
- No cloud services or telemetry
- No background daemons
- No model provider

All data lives in `.kgraph/` as human-readable JSON, YAML, and Markdown. Commit it, diff it, inspect it anytime.

---

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

---

## Release

Releases are tag-driven. Bump the version, push the commit and tag:

```bash
npm version patch
git push origin main --follow-tags
```

CI verifies the tag matches `package.json`, checks the version is unpublished, publishes to npm, creates a GitHub Release, and attaches the tarball.

---

## Visualization

```bash
kgraph visualize
```

Starts a local server at `http://localhost:4242` and opens an interactive dependency graph in your browser. No install required — two CDN scripts (Cytoscape.js + dagre layout) are loaded at view time.

**What you see:**

- File nodes colored by language (TypeScript, JavaScript, Markdown, YAML, …)
- Cognition notes as diamonds, colored by health (green = current, amber = mixed, red = stale)
- Import edges showing real dependency flow
- Dashed blue edges linking cognition notes to the files they describe
- Click any node for a metadata panel (path, size, domain, related symbols)
- Toggle cognition overlay on/off
- Switch layout: Hierarchical (default), Force-directed, Grid, Concentric
- **Export PNG** — 2× resolution, dark background, ready for reports or slides

---

## Roadmap

- Git-aware history and rename tracking
- richer language scanners (deeper AST, cross-file type resolution)
- MCP server for editor tool-call access
- team-shared cognition via committed `.kgraph/`
