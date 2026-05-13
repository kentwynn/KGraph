# AI Tool Integrations

KGraph integrations are local instruction files. They do not start background agents, call AI providers, or send data anywhere.

## Add Integrations

```bash
kgraph integrate add codex copilot cursor claude-code gemini windsurf cline
kgraph integrate add copilot --mode smart
kgraph integrate list
```

## Integration Modes

| Mode     | Behavior                                                                                                       |
| -------- | -------------------------------------------------------------------------------------------------------------- |
| `always` | Every chat in the repository starts with `kgraph "<topic>"`.                                                   |
| `smart`  | Runs KGraph for repo-specific coding, debugging, architecture, refactor, review, or file-exploration requests. |
| `manual` | Exposes KGraph instructions, but the agent runs KGraph only when explicitly requested.                         |
| `off`    | Disables that integration and removes KGraph-managed instruction blocks or files.                              |

New integrations default to `always` mode, so every chat in the repository starts with `kgraph "<topic>"`. Use `--mode smart` to run KGraph only for repo-specific work, or `--mode manual` to run only when explicitly asked.

Generated instructions teach agents to use the atom-native workflow: `context`, `pack`, `knowledge`, `stale`, `blame`, `conclude`, `compact`, `repair`, `impact`, `history`, and `session` where supported.

## Managed Files

| Tool           | Files KGraph manages                                   |
| -------------- | ------------------------------------------------------ |
| Codex          | `AGENTS.md`, `.agents/skills/kgraph/SKILL.md`          |
| GitHub Copilot | `.github/copilot-instructions.md`, `.github/prompts/*` |
| Cursor         | `.cursor/rules/kgraph.mdc`                             |
| Claude Code    | `CLAUDE.md`, `.claude/commands/*`                      |
| Gemini CLI     | `GEMINI.md`                                            |
| Windsurf       | `.windsurf/rules/kgraph.md`                            |
| Cline          | `.clinerules/kgraph.md`                                |

KGraph preserves existing user-authored content and updates only its marked instruction blocks or generated command files.
