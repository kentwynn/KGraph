import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  cleanupTempRepo,
  createTempRepo,
  runCli,
  writeText,
} from '../fixtures/helpers.js';

describe('kgraph init', () => {
  it('creates workspace and preserves existing cognition', async () => {
    const repo = await createTempRepo();
    try {
      const first = await runCli(repo, ['init']);
      expect(first.code).toBe(0);
      await access(path.join(repo, '.kgraph', 'config.yaml'));
      await mkdir(path.join(repo, '.kgraph', 'cognition'), { recursive: true });
      await writeFile(
        path.join(repo, '.kgraph', 'cognition', 'note.md'),
        'keep',
        'utf8',
      );
      const second = await runCli(repo, ['init']);
      expect(second.code).toBe(0);
      await access(path.join(repo, '.kgraph', 'cognition', 'note.md'));
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('reports repo language coverage and next steps after init', async () => {
    const repo = await createTempRepo();
    try {
      await writeText(
        repo,
        'src/index.ts',
        'export function boot() {\n  return 1;\n}\n',
      );
      await writeText(
        repo,
        'src/App.java',
        'public class App {\n  public void run() {}\n}\n',
      );
      await writeText(repo, 'config/app.yml', 'server:\n  port: 3000\n');
      await writeText(repo, 'styles/app.scss', '.button {\n  color: red;\n}\n');
      await writeText(repo, 'app/Controller.php', '<?php\nclass Controller {}\n');
      await writeText(repo, 'lib/task.rb', 'class Task\nend\n');
      await writeText(repo, 'scripts/deploy.sh', 'deploy_app() {\n  echo deploy\n}\n');
      await writeText(repo, 'db/schema.sql', 'CREATE TABLE users (id uuid);\n');

      const result = await runCli(repo, ['init']);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('KGraph Init Summary');
      expect(result.stdout).toContain('AI integrations');
      expect(result.stdout).toContain('configured: none');
      expect(result.stdout).toContain(
        'TypeScript: 1 file, deep built-in extraction',
      );
      expect(result.stdout).toContain('Java: 1 file, deep built-in extraction');
      expect(result.stdout).toContain('PHP: 1 file, deep built-in extraction');
      expect(result.stdout).toContain('Ruby: 1 file, deep built-in extraction');
      expect(result.stdout).toContain('Shell: 1 file, deep built-in extraction');
      expect(result.stdout).toContain('SQL: 1 file, deep built-in extraction');
      expect(result.stdout).toContain('YAML: 1 file, structured file extraction');
      expect(result.stdout).toContain('SCSS: 1 file, structured file extraction');
      expect(result.stdout).toContain(
        'kgraph "topic"  Run the normal refresh and context workflow',
      );
      expect(result.stdout).toContain(
        'kgraph integrate add <agent>  Optional: connect an AI tool',
      );
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('shows configured integrations in the init summary', async () => {
    const repo = await createTempRepo();
    try {
      await writeText(
        repo,
        'src/index.ts',
        'export function boot() {\n  return 1;\n}\n',
      );

      const result = await runCli(repo, ['init', '--integration', 'copilot']);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Configured integrations: copilot:always');
      expect(result.stdout).toContain('AI integrations');
      expect(result.stdout).toContain('copilot: always');
      expect(result.stdout).not.toContain('none configured');
    } finally {
      await cleanupTempRepo(repo);
    }
  });

});
