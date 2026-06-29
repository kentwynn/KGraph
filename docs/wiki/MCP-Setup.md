# MCP Setup

KGraph can run as a local MCP server so AI clients can call structured `kgraph_*` tools instead of shelling out to CLI commands.

## Mental Model

- `kgraph mcp` starts a stdio MCP server.
- You normally do not run `kgraph mcp` manually in a terminal.
- The AI client starts `kgraph mcp` automatically after KGraph is registered in that client's MCP config.
- MCP changes the transport only. It does not change KGraph's local-first storage, integration modes, or capture policy.

If MCP tools are available in the client, prefer them. If MCP is not available, use the normal CLI commands.

## VS Code and Copilot

For first-time setup in a repository:

```bash
kgraph init --integrations copilot --mcp
```

For an existing KGraph repository:

```bash
kgraph integrate add copilot --mcp
```

KGraph writes a `KGraph` server entry to VS Code's MCP config for the current repository and prints the config path. Reload VS Code after this command so Copilot can start the server.

On macOS, VS Code's user MCP config is usually:

```text
~/Library/Application Support/Code/User/mcp.json
```

The generated server entry is equivalent to:

```json
{
  "command": "kgraph",
  "args": ["mcp", "--root", "/path/to/repo"],
  "type": "stdio"
}
```

## Why `--mcp` Is Explicit

Plain `kgraph init` stays repo-local:

- creates `.kgraph/`
- writes KGraph config
- scans the repository
- optionally writes repo-local integration instruction files

MCP setup edits editor/client configuration outside the repository, so KGraph only does it when you pass `--mcp`.

## Other Clients

Codex, Cursor, Claude Code, VS Code, and other MCP clients each have their own MCP config location. The current `--mcp` setup targets VS Code/Copilot. For other clients, point the client at:

```bash
kgraph mcp --root /path/to/repo
```

Future KGraph releases can add first-class MCP setup targets for more clients.

## Available Tools

KGraph exposes typed tools for common workflows, including:

- `kgraph_orchestrate`
- `kgraph_context_pack`
- `kgraph_impact`
- `kgraph_capture`
- `kgraph_health`
- `kgraph_command`

It also exposes command-specific tools for scan, update, context, pack, history, stale, blame, doctor, repair, compact, knowledge, session, integrations, init, uninstall, and visualize workflows.

Tools are labeled by mutability:

- `read-only`
- `repo-write`
- `destructive`
