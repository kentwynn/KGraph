# KGraph

Persistent repo intelligence for AI coding assistants.

KGraph is a local-first CLI that helps AI coding sessions avoid rediscovering the same repository structure, architecture notes, debugging conclusions, and workflows. It stores inspectable repo knowledge in `.kgraph/` so future sessions can navigate directly to relevant files, symbols, domains, and prior cognition.

## MVP CLI

```bash
npm install
npm run build
npm run kgraph -- init
npm run kgraph -- scan
npm run kgraph -- update
npm run kgraph -- context "auth token refresh"
```

## Scope

KGraph is:

- persistent repo cognition
- semantic navigation infrastructure
- a context engineering layer
- local filesystem-based project intelligence

KGraph is not:

- an AI coding assistant
- a chatbot
- a vector database
- a cloud service
- an autonomous agent system
