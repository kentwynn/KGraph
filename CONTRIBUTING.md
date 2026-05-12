# Contributing to KGraph

KGraph is a local-first TypeScript CLI for persistent repository intelligence. Contributions are welcome when they keep the tool practical, inspectable, and safe for developers to run on real codebases.

## Setup

```bash
npm install
npm run build
npm test
npm run pack:dry
```

Use the local CLI during development:

```bash
npm run kgraph -- --version
npm run kgraph -- doctor
npm run kgraph -- "auth token refresh"
```

## Contribution Flow

1. Fork the repository.
2. Create a focused branch for one fix or feature.
3. Make the smallest practical change that solves the problem.
4. Add or update tests when behavior changes.
5. Run `npm run build`, `npm test`, and `npm run pack:dry`.
6. Open a pull request with a clear summary, validation notes, and any tradeoffs.

Docs-only pull requests should still be specific and should not update generated files unless the documentation change requires it.

## Expectations

- Use TypeScript and the existing CLI/module style.
- Keep KGraph local-first: no required cloud service, account, telemetry, API key, or source-code upload.
- Preserve human-readable local artifacts such as JSON, YAML, and Markdown.
- Keep command output concise and useful for both humans and coding agents.
- Avoid broad refactors when a targeted fix is enough.
- Keep the free core workflow intact.

## Pull Request Types

- Bug fixes: include the failing command or scenario, the expected behavior, and the validation run.
- Features: explain the developer workflow, the command or API shape, and how it fits the local-first model.
- Docs: explain what was confusing or missing and where the new text is intended to guide users.

## Tests

Run these before opening a pull request:

```bash
npm run build
npm test
npm run pack:dry
```

If a check cannot be run, note that in the pull request with the reason.
