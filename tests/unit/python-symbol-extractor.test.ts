import { describe, expect, it } from 'vitest';
import { extractPythonSymbols } from '../../src/scanner/python-symbol-extractor.js';

describe('python symbol extractor', () => {
  it('extracts top-level functions', () => {
    const result = extractPythonSymbols(
      `def greet(name):\n    return f"Hello {name}"\n\nasync def fetch(url):\n    pass\n`,
      'src/greet.py',
    );
    expect(result.symbols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'greet', kind: 'function' }),
        expect.objectContaining({ name: 'fetch', kind: 'function' }),
      ]),
    );
    expect(
      result.symbols.every(
        (s) => s.parentName === undefined || s.kind === 'method',
      ),
    ).toBe(true);
  });

  it('extracts classes and their methods', () => {
    const result = extractPythonSymbols(
      `class AuthService:\n    def login(self, user):\n        pass\n\n    async def logout(self):\n        pass\n`,
      'src/auth.py',
    );
    expect(result.symbols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'AuthService', kind: 'class' }),
        expect.objectContaining({
          name: 'login',
          kind: 'method',
          parentName: 'AuthService',
        }),
        expect.objectContaining({
          name: 'logout',
          kind: 'method',
          parentName: 'AuthService',
        }),
      ]),
    );
  });

  it('treats functions after a class block as top-level, not methods', () => {
    const result = extractPythonSymbols(
      `class Foo:\n    def inside(self):\n        pass\n\ndef outside():\n    pass\n`,
      'src/foo.py',
    );
    const outside = result.symbols.find((s) => s.name === 'outside');
    expect(outside?.kind).toBe('function');
    expect(outside?.parentName).toBeUndefined();
  });

  it('extracts import statements as dependencies', () => {
    const result = extractPythonSymbols(
      `import os\nimport json\n`,
      'src/utils.py',
    );
    expect(result.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ specifier: 'os', kind: 'package' }),
        expect.objectContaining({ specifier: 'json', kind: 'package' }),
      ]),
    );
  });

  it('extracts from-import as local or package dependency', () => {
    const result = extractPythonSymbols(
      `from .auth import login\nfrom flask import request\n`,
      'src/views.py',
    );
    expect(result.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ specifier: '.auth', kind: 'local' }),
        expect.objectContaining({ specifier: 'flask', kind: 'package' }),
      ]),
    );
  });

  it('records file-contains relationships for every symbol', () => {
    const result = extractPythonSymbols(
      `class Foo:\n    def bar(self):\n        pass\n`,
      'src/foo.py',
    );
    const containsRels = result.relationships.filter(
      (r) => r.relationshipType === 'contains',
    );
    expect(containsRels.length).toBeGreaterThanOrEqual(2);
  });

  it('returns empty results for an empty file', () => {
    const result = extractPythonSymbols('', 'src/empty.py');
    expect(result.symbols).toHaveLength(0);
    expect(result.dependencies).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('skips comment lines', () => {
    const result = extractPythonSymbols(
      `# def not_a_function():\n# class NotAClass:\ndef real():\n    pass\n`,
      'src/commented.py',
    );
    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0].name).toBe('real');
  });
});
