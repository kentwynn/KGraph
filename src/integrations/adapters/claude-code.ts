import type { IntegrationAdapter } from '../integration-registry.js';

export const claudeCodeAdapter: IntegrationAdapter = {
  name: 'claude-code',
  label: 'Claude Code',
  targetPath: 'CLAUDE.md',
  instructions: `## KGraph Workflow

Before exploring the repository, run \`kgraph "<topic>"\` to refresh repo intelligence and load focused context. Use /kgraph for the full automated workflow. Run \`kgraph doctor\` when setup or generated maps look wrong. Run \`kgraph scan\`, \`kgraph update\`, and \`kgraph context\` manually only when you need one specific step.
`,
  commandFiles: [
    {
      path: '.claude/commands/kgraph.md',
      content: `Use KGraph persistent repo intelligence for the current request.

1. Infer the topic from the user's request.
2. Run \`kgraph "<topic>"\`. This refreshes maps, processes pending inbox notes, and returns focused context in one command.
3. Use the returned files, symbols, relationships, and cognition before broad exploration.
4. Run \`kgraph doctor\` when setup, maps, inbox processing, or integrations look wrong. Run \`kgraph doctor --quality\` when context shows stale/noisy cognition references.
5. Track meaningful session activity with \`kgraph session start --agent claude-code\`, \`kgraph session read <path> --agent claude-code\`, \`kgraph session write <path> --agent claude-code\`, and \`kgraph session end --agent claude-code\` when native hooks are unavailable.
6. Run \`kgraph impact "<file-or-symbol>"\` when the user asks what a change may affect. Run \`kgraph history "<topic>"\` when prior work or decisions matter.
7. At the end of any session that changed repository files, check the KGraph capture workflow before finishing.
8. If the file change has future value, write one concise Markdown note to \`.kgraph/inbox/<slug>.md\`; otherwise explicitly skip capture as trivial.
9. Skip capture only for read-only work, trivial formatting, typo-only docs, dependency-only churn, mechanical cleanup with no future value, or sessions where no repo files changed.
10. Do not run KGraph repeatedly. Run it once at the start with \`kgraph "<topic>"\`. If repo files changed, write any needed inbox note first, then run \`kgraph\` once at the end.
11. Run \`kgraph repair --dry-run\` before cleanup when stale/noisy cognition needs fixing. Run \`kgraph repair\` only when the user asks to apply that cleanup.
12. Run \`kgraph visualize\` when the user wants to inspect the dependency graph — opens an interactive graph at http://localhost:4242 with PNG export.
13. Run \`kgraph history\` or \`kgraph history "<topic>"\` to review past cognition sessions with git author attribution.

The inbox note must use this structure:
\`\`\`markdown
# <Short Title>

## Summary
One or two sentences describing the durable change or finding.

## Key Files
- \`path/to/file.ts\` — what changed or why it matters

## Key Symbols
- \`FunctionName\` — what changed or why it matters

## Decisions
Any implementation or product decision future sessions should know.
\`\`\`
`,
    },
    {
      path: '.claude/commands/kgraph-doctor.md',
      content: `Run \`kgraph doctor\` to check whether the workspace is initialized, maps exist, inbox notes are pending, and configured integrations point to real files. Use \`kgraph doctor --quality\` when the user asks about stale or noisy cognition references. Summarize any failed checks and the next command to run.
`,
    },
    {
      path: '.claude/commands/kgraph-repair.md',
      content: `Run \`kgraph repair --dry-run\` first and summarize the proposed cognition cleanup. Run \`kgraph repair\` only when the user asks to apply the cleanup.
`,
    },
    {
      path: '.claude/commands/kgraph-scan.md',
      content: `Run \`kgraph scan\` to refresh the repository maps, then summarize what changed.
`,
    },
    {
      path: '.claude/commands/kgraph-update.md',
      content: `Run \`kgraph update\` to process any pending Markdown notes in \`.kgraph/inbox/\` into durable cognition.
`,
    },
    {
      path: '.claude/commands/kgraph-visualize.md',
      content: `Run \`kgraph visualize\` to start an interactive dependency graph at http://localhost:4242. Opens in browser automatically. Use \`--no-open\` to print URL only, \`--port <n>\` for a custom port.
`,
    },
    {
      path: '.claude/commands/kgraph-impact.md',
      content: `Run \`kgraph impact "$ARGUMENTS"\` to show matched files/symbols, import users, callers, callees, related cognition, and risk hints.
`,
    },
    {
      path: '.claude/commands/kgraph-session.md',
      content: `Use \`kgraph session\` to inspect session read/write/token estimates. Record meaningful events with \`kgraph session start --agent claude-code\`, \`kgraph session read <path> --agent claude-code\`, \`kgraph session write <path> --agent claude-code\`, and \`kgraph session end --agent claude-code\`.
`,
    },
    {
      path: '.claude/commands/kgraph-history.md',
      content: `Run \`kgraph history\` or \`kgraph history "$ARGUMENTS"\` to show processed cognition sessions. Includes git author attribution when available. Use \`--last <n>\` to limit entries, \`--json\` for machine-readable output.
`,
    },
    {
      path: '.claude/hooks/kgraph-session-start.cjs',
      content: hookScript('start'),
    },
    {
      path: '.claude/hooks/kgraph-session-pre-read.cjs',
      content: hookScript('read'),
    },
    {
      path: '.claude/hooks/kgraph-session-post-write.cjs',
      content: hookScript('write'),
    },
    {
      path: '.claude/hooks/kgraph-session-stop.cjs',
      content: hookScript('end'),
    },
  ],
  obsoleteCommandFiles: [],
};

function hookScript(event: 'start' | 'read' | 'write' | 'end'): string {
  const pathArg =
    event === 'read' || event === 'write'
      ? `const payload = readPayload();
const filePath = payload?.tool_input?.file_path || payload?.toolInput?.file_path || payload?.file_path;
if (!filePath) process.exit(0);
args.push(filePath);`
      : '';
  return `#!/usr/bin/env node
const { spawnSync } = require('node:child_process');

function readPayload() {
  try {
    const chunks = [];
    let chunk;
    while ((chunk = require('node:fs').readFileSync(0, { encoding: 'utf8' }))) {
      chunks.push(chunk);
      break;
    }
    return chunks.join('') ? JSON.parse(chunks.join('')) : {};
  } catch {
    return {};
  }
}

const args = ['session', '${event}', '--agent', 'claude-code', '--source', 'automatic'];
${pathArg}
const result = spawnSync('kgraph', args, { stdio: 'ignore' });
process.exit(result.status || 0);
`;
}
