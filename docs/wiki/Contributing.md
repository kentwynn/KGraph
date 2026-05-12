# Contributing

KGraph welcomes focused contributions that improve local repo intelligence for AI coding tools.

Start with the repository files:

- `CONTRIBUTING.md`
- `SECURITY.md`
- `.github/ISSUE_TEMPLATE/`

## Setup

```bash
npm install
npm run build
npm test
npm run pack:dry
```

## Pull Request Guidance

- Keep pull requests focused.
- Preserve KGraph's local-first behavior.
- Add tests for behavior changes.
- Update README or wiki docs when user-facing behavior changes.
- Avoid telemetry, account requirements, cloud dependencies, and source-code upload.

## Good First Areas

- Documentation clarity
- CLI output polish
- Scanner language improvements
- Context ranking improvements
- Git-aware token-saving workflows
