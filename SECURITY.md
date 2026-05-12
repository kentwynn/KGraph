# Security Policy

KGraph is a local-first CLI. It should not require accounts, telemetry, API keys, cloud services, or source-code upload to operate.

## Supported Versions

Security fixes target the latest published npm release of `@kentwynn/kgraph` and the current `main` branch.

## Reporting a Vulnerability

If GitHub Security Advisories are enabled for this repository, please report vulnerabilities privately through the repository security advisory flow.

If private advisories are not available, open a GitHub issue with minimal public detail and avoid posting exploit code, private repository contents, secrets, or sensitive logs. The maintainer can then coordinate follow-up privately if needed.

Helpful report details include:

- KGraph version from `kgraph --version`
- Node.js version
- Operating system
- The command or workflow involved
- Whether the issue exposes local files, writes unexpected files, executes unexpected commands, or leaks data
- The smallest safe reproduction you can provide

## Security Expectations

KGraph should:

- keep repo intelligence local and inspectable
- avoid telemetry and hidden network calls
- avoid requiring secrets for normal operation
- preserve user-authored files outside KGraph-managed blocks
- fail clearly when local configuration is invalid

Please do not include real secrets, private source code, or sensitive company logs in public issues.
