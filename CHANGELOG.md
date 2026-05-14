# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [0.2.18](https://github.com/kentwynn/KGraph/compare/v0.2.17...v0.2.18) (2026-05-14)

### ### Added

* replace copilot prompts with shared .agents/skills/ SKILL.md files ([58ff3ea](https://github.com/kentwynn/KGraph/commit/58ff3eafd008d81c51f39e638204312d7ab1e1ce))

## [0.2.17](https://github.com/kentwynn/KGraph/compare/v0.2.16...v0.2.17) (2026-05-13)

### ### Added

* expand pack command, context pack and instruction block updates ([ea32e53](https://github.com/kentwynn/KGraph/commit/ea32e5396de2a6bcafbebd757eb6722b49c1b806))

## [0.2.16](https://github.com/kentwynn/KGraph/compare/v0.2.15...v0.2.16) (2026-05-13)

### ### Added

* expand context command and help system improvements ([883e4b5](https://github.com/kentwynn/KGraph/commit/883e4b5694835ea28f71e7d8f53143326c0dd622))

## [0.2.15](https://github.com/kentwynn/KGraph/compare/v0.2.14...v0.2.15) (2026-05-13)

### ### Added

* expand context pack with knowledge types and extended test coverage ([5137d9d](https://github.com/kentwynn/KGraph/commit/5137d9d787c7a44390c78e16d097cbd8ab870ee8))

## [0.2.14](https://github.com/kentwynn/KGraph/compare/v0.2.13...v0.2.14) (2026-05-13)

### ### Added

* enhance context query, cognition quality, conclusion and context pack with expanded test coverage ([40c434a](https://github.com/kentwynn/KGraph/commit/40c434a569658107ddf944e88f79b542aecff24b))

## [0.2.13](https://github.com/kentwynn/KGraph/compare/v0.2.12...v0.2.13) (2026-05-13)

### ### Added

* refactor integration system - uninstall, instruction blocks, workflow steps and test coverage ([3fc0dce](https://github.com/kentwynn/KGraph/commit/3fc0dce2efa982d8b7a92d467d07b3147fb6cf99))

## [0.2.12](https://github.com/kentwynn/KGraph/compare/v0.2.11...v0.2.12) (2026-05-13)

### ### Added

* expand cognition quality, doctor and repair command improvements ([dff1a76](https://github.com/kentwynn/KGraph/commit/dff1a769ba9abb48fbc01c2337f66446f8f3b5b3))
* improve visualization - graph builder and HTML template enhancements ([5a18e22](https://github.com/kentwynn/KGraph/commit/5a18e22d77e88cc981af5ebf2d0a60b779cdd41a))
* update documentation to reflect knowledge atom terminology and improve clarity ([bf1a9c8](https://github.com/kentwynn/KGraph/commit/bf1a9c8fb146958ff4a3d80bab0a50d8428b4457))

## [0.2.11](https://github.com/kentwynn/KGraph/compare/v0.2.10...v0.2.11) (2026-05-13)

### ### Added

* add atom core - knowledge system, context pack, new CLI commands and integration updates ([0f33dde](https://github.com/kentwynn/KGraph/commit/0f33dde738ba515832cd871cb68081b2e0f8e7b6))
* expand atom core - blame/stale commands, compact upgrades, context and knowledge enhancements ([2efb16b](https://github.com/kentwynn/KGraph/commit/2efb16b47b9f9441bdc6d8e03bc620d51c3d7259))

## [0.2.10](https://github.com/kentwynn/KGraph/compare/v0.2.9...v0.2.10) (2026-05-13)

### ### Fixed

* remove duplicate GitHub Release step from CI (release-it handles it) ([19aba61](https://github.com/kentwynn/KGraph/commit/19aba610e8fda8c96fd09ba604140112214b8105))

## [0.2.9](https://github.com/kentwynn/KGraph/compare/v0.2.8...v0.2.9) (2026-05-13)

## [0.2.8](https://github.com/kentwynn/KGraph/compare/v0.2.7...v0.2.8) (2026-05-13)

### ### Fixed

* pass changelog notes to GitHub Release body ([47c9a0e](https://github.com/kentwynn/KGraph/commit/47c9a0e78a91589f119218a434ad1c7e0558e8cf))

## [0.2.7](https://github.com/kentwynn/KGraph/compare/v0.2.6...v0.2.7) (2026-05-13)

### ### Added

* add release-it with conventional changelog automation ([495d40e](https://github.com/kentwynn/KGraph/commit/495d40edfee08fbe05a40c45a88d0523ab13026c))
* enable GitHub Releases in release-it config ([8746832](https://github.com/kentwynn/KGraph/commit/8746832e14853fb9a6f589ecf60f306ff2dd6aef))

s
---

## [0.2.6] - 2026-05-13

### Added

- `compact` and `conclude` commands for cognition lifecycle management — summarize and close out active cognition sessions

---

## [0.2.5] - 2026-05-12

### Fixed

- Addressed 9 business-logic gaps across context, session, cognition, and doctor modules
- Addressed 4 additional business-logic gaps in the updater, repair, parser, and context modules

---

## [0.2.4] - 2026-05-12

### Changed

- Refactored shared workflow module with smart default integration mode selection

---

## [0.2.3] - 2026-05-12

### Added

- Git-aware incremental scan — only rescans files changed since the last run
- Context command now surfaces git change information

### Fixed

- Release Makefile compatibility with BSD `make` (removed `.ONESHELL` dependency)
- Simplified release version shell commands to improve portability
- Branch cleanup deletion reliability

### Changed

- Added Makefile targets for branch cleanup

---

## [0.2.2] - 2026-05-12

### Added

- Release automation via Makefile (`make release`)
- Dependabot configuration for automated dependency updates
- CodeQL analysis workflow for security scanning
- Wiki synchronization workflow using `KGRAPH_WIKI_TOKEN`
- Issue templates and documentation improvements

### Fixed

- Release tag version check in Makefile

---

## [0.2.1] - 2026-05-11

### Added

- `uninstall` command with preview mode and options for removing KGraph from a project
- Help options for `integrate` and `session` commands
- Enhanced context and doctor command output with detailed explanations and actionable guidance

---

## [0.2.0] - 2026-05-11

### Added

- Enhanced `context` command output with richer formatting
- Extractor management and initialization summary on `kgraph init`

### Changed

- Refactored symbol extraction — removed extractor configuration in favour of auto-detection
- Integration mode defaults updated to `always` across CLI commands and help documentation

---

## [0.1.27] - 2026-05-11

### Changed

- Refactored symbol extraction to remove extractor configuration overhead

---

## [0.1.26] - 2026-05-11

### Added

- Extractor management and initialization summary

---

## [0.1.25] - 2026-05-11

### Added

- Integration mode set to `always` as the new default
- Enhanced graph rendering performance and improved symbol handling
- CLI command improvements and integration management fixes

---

## [0.1.24] - 2026-05-11

### Changed

- Updated capture policy and documentation across integration adapters

---

## [0.1.23] - 2026-05-10

### Added

- Session tracking for agent activity and token estimates
- Integration management modes and per-integration context policies

---

## [0.1.22] - 2026-05-10

### Added

- `impact` command — shows file and symbol dependency graph for any given file

---

## [0.1.21] - 2026-05-10

### Added

- TypeScript symbol extraction now captures function call relationships

---

## [0.1.20] - 2026-05-10

### Added

- Support for Gemini, Windsurf, and Cline integrations

---

## [0.1.19] - 2026-05-10

### Added

- Cognition quality analysis (`kgraph repair`) to detect and fix low-quality notes

---

## [0.1.18] - 2026-05-10

### Changed

- Updated integration instruction blocks and capture workflow guidance

---

## [0.1.17] - 2026-05-10

### Added

- `kgraph doctor` command for health checks
- Updated workflow instructions to use `kgraph "<topic>"` syntax

---

## [0.1.16] - 2026-05-10

### Added

- Default workflow on bare `kgraph` invocation
- Health check command foundation

---

## [0.1.15] - 2026-05-09

### Changed

- Refactored cognition updater for improved readability and maintainability
- Symbol extraction now prioritises the Key Symbols section in notes

---

## [0.1.14] - 2026-05-09

### Changed

- Refined Markdown note capture guidelines in workflow instructions

---

## [0.1.12] - 2026-05-09

## [0.1.13] - 2026-05-09

Minor internal patches and stability improvements.

---

## [0.1.10] - 2026-05-09

## [0.1.11] - 2026-05-09

Minor internal patches.

---

## [0.1.9] - 2026-05-09

### Changed

- Improved Copilot and Cursor instruction clarity
- Added tests for command file presence

---

## [0.1.8] - 2026-05-09

### Added

- `history` command to track cognition sessions over time
- Interactive dependency graph visualization (`kgraph graph`)

### Fixed

- Corrected `mode` to `agent` in command file prompts for consistency

### Changed

- Improved code formatting in `markdown-note-parser` and `context-query`
- Clarified README problem/solution framing

---

## [0.1.7] - 2026-05-09

### Fixed

- `postbuild` script to ensure CLI binary has executable permissions after build

### Changed

- Streamlined workflow instructions across all integration adapters
- Removed obsolete command files

---

## [0.1.6] - 2026-05-09

### Added

- Version retrieval now reads from `package.json` at runtime

### Changed

- Standardised import formatting and configuration handling

---

## [0.1.5] - 2026-05-09

### Changed

- Removed obsolete command files and updated integration logic

---

## [0.1.4] - 2026-05-09

### Added

- Enhanced integration command files and updated exclusion patterns in config

---

## [0.1.3] - 2026-05-09

### Added

- Help rendering with KGraph branding and tests for all CLI commands

---

## [0.1.2] - 2026-05-09

### Changed

- Updated TypeScript to 5.9.3
- Fixed CLI entry point check

---

## [0.1.1] - 2026-05-09

### Added

- AI tool integration management commands (`kgraph integrate`, `kgraph unintegrate`)
- CI/CD workflow with artifact checks, Node.js 24, and latest action versions
- Release workflow with tag and npm version verification before publish
- Scoped npm package (`@kentwynn/kgraph`)
- Context query and ranking engine
- Initial repo intelligence scanner

[0.2.6]: https://github.com/kentwynn/KGraph/compare/v0.2.5...v0.2.6
[0.2.5]: https://github.com/kentwynn/KGraph/compare/v0.2.4...v0.2.5
[0.2.4]: https://github.com/kentwynn/KGraph/compare/v0.2.3...v0.2.4
[0.2.3]: https://github.com/kentwynn/KGraph/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/kentwynn/KGraph/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/kentwynn/KGraph/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/kentwynn/KGraph/compare/v0.1.27...v0.2.0
[0.1.27]: https://github.com/kentwynn/KGraph/compare/v0.1.26...v0.1.27
[0.1.26]: https://github.com/kentwynn/KGraph/compare/v0.1.25...v0.1.26
[0.1.25]: https://github.com/kentwynn/KGraph/compare/v0.1.24...v0.1.25
[0.1.24]: https://github.com/kentwynn/KGraph/compare/v0.1.23...v0.1.24
[0.1.23]: https://github.com/kentwynn/KGraph/compare/v0.1.22...v0.1.23
[0.1.22]: https://github.com/kentwynn/KGraph/compare/v0.1.21...v0.1.22
[0.1.21]: https://github.com/kentwynn/KGraph/compare/v0.1.20...v0.1.21
[0.1.20]: https://github.com/kentwynn/KGraph/compare/v0.1.19...v0.1.20
[0.1.19]: https://github.com/kentwynn/KGraph/compare/v0.1.18...v0.1.19
[0.1.18]: https://github.com/kentwynn/KGraph/compare/v0.1.17...v0.1.18
[0.1.17]: https://github.com/kentwynn/KGraph/compare/v0.1.16...v0.1.17
[0.1.16]: https://github.com/kentwynn/KGraph/compare/v0.1.15...v0.1.16
[0.1.15]: https://github.com/kentwynn/KGraph/compare/v0.1.14...v0.1.15
[0.1.14]: https://github.com/kentwynn/KGraph/compare/v0.1.13...v0.1.14
[0.1.13]: https://github.com/kentwynn/KGraph/compare/v0.1.12...v0.1.13
[0.1.12]: https://github.com/kentwynn/KGraph/compare/v0.1.11...v0.1.12
[0.1.11]: https://github.com/kentwynn/KGraph/compare/v0.1.10...v0.1.11
[0.1.10]: https://github.com/kentwynn/KGraph/compare/v0.1.9...v0.1.10
[0.1.9]: https://github.com/kentwynn/KGraph/compare/v0.1.8...v0.1.9
[0.1.8]: https://github.com/kentwynn/KGraph/compare/v0.1.7...v0.1.8
[0.1.7]: https://github.com/kentwynn/KGraph/compare/v0.1.6...v0.1.7
[0.1.6]: https://github.com/kentwynn/KGraph/compare/v0.1.5...v0.1.6
[0.1.5]: https://github.com/kentwynn/KGraph/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/kentwynn/KGraph/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/kentwynn/KGraph/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/kentwynn/KGraph/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/kentwynn/KGraph/releases/tag/v0.1.1
