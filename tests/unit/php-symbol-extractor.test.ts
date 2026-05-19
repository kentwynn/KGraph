import { describe, expect, it } from 'vitest';
import { extractPhpSymbols } from '../../src/scanner/php-symbol-extractor.js';

describe('php symbol extractor', () => {
  it('extracts namespaces, imports, classes, interfaces, and functions', async () => {
    const result = await extractPhpSymbols(
      `<?php
namespace App\\Http;

use Vendor\\Package;

interface HandlesRequest {}

class Controller {
    public function index() {}
}

function route_helper() {}
`,
      'app/Controller.php',
    );

    expect(result.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          specifier: 'Vendor\\Package',
          kind: 'package',
        }),
      ]),
    );
    expect(result.symbols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'App\\Http', kind: 'type' }),
        expect.objectContaining({ name: 'HandlesRequest', kind: 'interface' }),
        expect.objectContaining({ name: 'Controller', kind: 'class' }),
        expect.objectContaining({
          name: 'index',
          kind: 'method',
          parentName: 'Controller',
        }),
        expect.objectContaining({ name: 'route_helper', kind: 'function' }),
      ]),
    );
  });

  it('returns empty results for empty files', async () => {
    const result = await extractPhpSymbols('', 'empty.php');
    expect(result.symbols).toHaveLength(0);
    expect(result.dependencies).toHaveLength(0);
  });
});
