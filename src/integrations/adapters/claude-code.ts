import type { IntegrationAdapter } from '../integration-registry.js';
import { numberedWorkflow } from '../workflow-steps.js';

export const claudeCodeAdapter: IntegrationAdapter = {
  name: 'claude-code',
  label: 'Claude Code',
  targetPath: 'CLAUDE.md',
  instructions: `## KGraph Workflow

${numberedWorkflow('claude-code', {
  sessionQualifier: 'native hooks also report session activity when configured',
})}
`,
  commandFiles: [
    {
      path: '.claude/commands/kgraph.md',
      content: `## KGraph Workflow

${numberedWorkflow('claude-code')}
`,
    },
    {
      path: '.claude/commands/kgraph-doctor.md',
      content: `Run \`kgraph doctor\` to check whether the workspace is initialized, maps exist, inbox notes are pending, and configured integrations point to real files. Use \`kgraph doctor --quality\` when the user asks about stale or noisy cognition references. Summarize any failed checks and the next command to run.
`,
    },
    {
      path: '.claude/commands/kgraph-repair.md',
      content: `Run \`kgraph repair --dry-run\` first and summarize the proposed atom-reference cleanup. Run \`kgraph repair\` only when the user asks to apply the cleanup.
`,
    },
    {
      path: '.claude/commands/kgraph-compact.md',
      content: `Run \`kgraph compact --dry-run\` first and summarize duplicate cognition groups and stale low-confidence notes. Run \`kgraph compact\` only when the user asks to apply compaction.
`,
    },
    {
      path: '.claude/commands/kgraph-pack.md',
      content: `Run \`kgraph pack "$ARGUMENTS" --budget 8000 --json --agent claude-code\` to build a machine-readable context pack and record lightweight session context. Summarize token use, included files, symbols, relationships, git changes, session history, atoms, and omitted items with the inclusion reasons.
`,
    },
    {
      path: '.claude/commands/kgraph-knowledge.md',
      content: `Use \`kgraph knowledge list\` and \`kgraph knowledge get <atom-id>\` to inspect durable atoms, evidence, provenance, and lifecycle. Run \`kgraph knowledge archive <atom-id>\` or \`kgraph knowledge supersede <old-id> <new-id>\` only when the user explicitly asks to mutate atom lifecycle.
`,
    },
    {
      path: '.claude/commands/kgraph-stale.md',
      content: `Run \`kgraph stale\` to refresh atom status against the current scan and summarize stale or needs-review atoms with invalidation reasons.
`,
    },
    {
      path: '.claude/commands/kgraph-blame.md',
      content: `Run \`kgraph blame "$ARGUMENTS"\` to show who or what created a knowledge atom, the source command/session/commit, evidence refs, and lifecycle links.
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
      content: `Run \`kgraph impact "$ARGUMENTS"\` to show matched files/symbols, import users, callers, callees, related knowledge atoms, and risk hints.
`,
    },
    {
      path: '.claude/commands/kgraph-session.md',
      content: `Use \`kgraph session\` to inspect session read/write/token estimates. Record meaningful events with \`kgraph session start --agent claude-code\`, \`kgraph session read <path> --agent claude-code\`, \`kgraph session write <path> --agent claude-code\`, and \`kgraph session end --agent claude-code --conclude --topic "<topic>"\` when durable session memory is useful.
`,
    },
    {
      path: '.claude/commands/kgraph-conclude.md',
      content: `Prefer \`kgraph "<topic>" --capture "$ARGUMENTS" --capture-file <path> --capture-symbol <name>\` when the session produced reusable engineering knowledge. Use \`kgraph conclude "$ARGUMENTS"\` only when the user explicitly asks for the conclude command. Choose one type from finding, decision, gotcha, summary, relationship, and one confidence from high, medium, low. Add file or symbol evidence whenever possible; high-confidence conclusions require evidence. Store only durable conclusions, not raw chain-of-thought, temporary reasoning, speculative exploration, or low-value observations.
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
