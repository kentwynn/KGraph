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

## MVP CLI

During local development:

```bash
npm install
npm run build
npm run kgraph -- init
npm run kgraph -- scan
npm run kgraph -- update
npm run kgraph -- context "auth token refresh"
```

The intended public package flow is:

```bash
npx kgraph init
npx kgraph scan
npx kgraph update
npx kgraph context "auth token refresh"
```

Optional global installation may be supported later:

```bash
npm install -g kgraph
kgraph init
```

The package is prepared for npm-style CLI distribution, but publishing and release automation are not part of the MVP.

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
- release automation
- deployment
- cloud infrastructure
- hosted dashboards
- graph databases
- vector databases
- embeddings
- autonomous agents
- VS Code extension

## CI

The first CI pipeline is intentionally small and practical. It validates:

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
