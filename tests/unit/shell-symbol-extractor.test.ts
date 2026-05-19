import { describe, expect, it } from 'vitest';
import { extractShellSymbols } from '../../src/scanner/shell-symbol-extractor.js';

describe('shell symbol extractor', () => {
  it('extracts functions, sourced files, and local script calls', async () => {
    const result = await extractShellSymbols(
      `#!/usr/bin/env bash
source ./env.sh

deploy_app() {
  ./scripts/build.sh
}

function restart_service {
  echo restart
}
`,
      'scripts/deploy.sh',
    );

    expect(result.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ specifier: './env.sh', kind: 'local' }),
      ]),
    );
    expect(result.symbols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'deploy_app', kind: 'function' }),
        expect.objectContaining({
          name: 'restart_service',
          kind: 'function',
        }),
      ]),
    );
    expect(result.relationships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetId: './scripts/build.sh',
          relationshipType: 'calls',
        }),
      ]),
    );
  });
});
