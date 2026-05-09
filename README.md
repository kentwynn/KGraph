# KGraph

Persistent repo intelligence for AI coding assistants.

KGraph is a local-first CLI for building an inspectable knowledge layer around a codebase. It helps AI coding sessions stop rediscovering the same repository structure, workflows, architecture decisions, and debugging history every time a new chat starts.

## Why KGraph

The biggest waste in AI-assisted coding is often not generation. It is repeated exploration:

- rereading the same files
- rediscovering the same architecture
- re-inferring the same workflows
- repeating prior debugging conclusions
- spending tokens just to find the right place to work

KGraph stores durable repository context in a local `.kgraph/` workspace so future AI sessions can navigate directly to relevant files, symbols, domains, and prior cognition.

## What KGraph Is

KGraph is:

- persistent repo cognition
- semantic navigation infrastructure
- a context engineering layer
- local filesystem-based project intelligence
- an inspectable map of structure, relationships, and durable notes

KGraph is not:

- an AI coding assistant
- a chatbot
- a vector database
- a simple RAG wrapper
- a cloud service
- an autonomous agent system

## Install And Run

KGraph is designed to feel like other developer-native CLI tools: one command to try it, optional global install if you use it often, and a quick version check before running commands.

Install and run a specific stable release:

```bash
npx @kentwynn/kgraph@0.1.0 init
```

Or run the latest published release:

```bash
npx @kentwynn/kgraph@latest init
```

Use the CLI directly after initialization:

```bash
npx @kentwynn/kgraph@latest scan
npx @kentwynn/kgraph@latest update
npx @kentwynn/kgraph@latest context "auth token refresh"
```

Optional global installation:

```bash
npm install -g @kentwynn/kgraph@latest
kgraph --version
kgraph init
kgraph scan
kgraph update
kgraph context "auth token refresh"
```

Current local development flow from a fresh clone:

```bash
npm install
npm run build
npm run kgraph -- --version
npm run kgraph -- init
npm run kgraph -- scan
npm run kgraph -- update
npm run kgraph -- context "auth token refresh"
```

For contributing or local development, clone the repo and use the local commands above.

## MVP CLI

The MVP command surface is intentionally small:

```bash
kgraph init
kgraph scan
kgraph update
kgraph context "auth token refresh"
```

`init` creates the local `.kgraph/` workspace. `scan` refreshes deterministic structure maps. `update` processes Markdown cognition notes. `context` returns compact repository context for a topic.

The MVP includes CI and release artifact packaging. New versions are published to npm automatically when a version tag is pushed.

## Local-First Privacy

KGraph writes project intelligence to local files in `.kgraph/`.

The MVP does not require:

- accounts
- telemetry
- cloud infrastructure
- hosted services
- databases
- LLM providers
- embeddings
- vector search
- background daemons

Generated KGraph data is meant to be human-readable and inspectable with normal text tools.

## MVP Scope

The first version focuses on:

- initializing `.kgraph/`
- scanning repository files
- extracting JavaScript and TypeScript symbols
- writing file, symbol, dependency, and relationship maps
- processing Markdown cognition notes
- returning compact context for a query
- keeping maps current as code changes

Out of scope for the MVP:

- npm publishing automation
- deployment
- cloud infrastructure
- hosted dashboards
- graph databases
- vector databases
- embeddings
- autonomous agents
- VS Code extension

## CI

The CI pipeline is intentionally small and practical. It runs on pushes to `main` and pull requests targeting `main`, and validates:

```bash
npm ci
npm run build
npm test
npm pack --dry-run
npm run check:artifacts
```

`check:artifacts` fails if local/generated Spec Kit or KGraph artifacts are committed by mistake, including:

- `.kgraph/`
- `.specify/`
- `.agents/`
- `AGENTS.md`
- `REQUIREMENTS.md`
- `specs/`

## CD

For a CLI package, CD means packaging an intentional release, not deploying infrastructure.

KGraph includes a release package workflow that runs only when a maintainer pushes a version tag such as `v0.1.0` or starts the workflow manually. It repeats the core gates, creates the npm tarball, and uploads the package as a GitHub Actions artifact:

```bash
npm ci
npm run build
npm test
npm run check:artifacts
npm pack
```

This gives maintainers an inspectable package artifact before public npm publishing is enabled.

## Roadmap

Near-term:

- stabilize the CLI contract
- improve JS/TS symbol extraction
- improve cognition note parsing
- validate context quality against real repositories
- make package publishing safe and intentional

Later:

- richer language scanners
- Git-aware history and rename detection
- optional MCP integration
- optional editor integrations
- visual graph exploration
- optional LLM-assisted cognition extraction
