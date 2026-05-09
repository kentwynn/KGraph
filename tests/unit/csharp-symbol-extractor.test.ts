import { describe, expect, it } from 'vitest';
import { extractCSharpSymbols } from '../../src/scanner/csharp-symbol-extractor.js';

describe('c# symbol extractor', () => {
  it('extracts classes and methods', () => {
    const result = extractCSharpSymbols(
      `namespace App;\n\npublic class AuthService {\n    public bool Login(string user) {\n        return true;\n    }\n\n    private void Helper() {}\n}\n`,
      'src/AuthService.cs',
    );
    expect(result.symbols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'AuthService',
          kind: 'class',
          exported: true,
        }),
        expect.objectContaining({
          name: 'Login',
          kind: 'method',
          parentName: 'AuthService',
          exported: true,
        }),
        expect.objectContaining({
          name: 'Helper',
          kind: 'method',
          parentName: 'AuthService',
          exported: false,
        }),
      ]),
    );
  });

  it('extracts interface, struct, enum, record', () => {
    const result = extractCSharpSymbols(
      `public interface IRepo {}\npublic struct Point {}\npublic enum Status { Active }\npublic record User(int Id);\n`,
      'src/Types.cs',
    );
    expect(result.symbols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'IRepo', kind: 'class' }),
        expect.objectContaining({ name: 'Point', kind: 'class' }),
        expect.objectContaining({ name: 'Status', kind: 'class' }),
        expect.objectContaining({ name: 'User', kind: 'class' }),
      ]),
    );
  });

  it('extracts using statements as dependencies', () => {
    const result = extractCSharpSymbols(
      `using System;\nusing System.Collections.Generic;\n`,
      'src/Foo.cs',
    );
    expect(result.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ specifier: 'System', kind: 'package' }),
        expect.objectContaining({
          specifier: 'System.Collections.Generic',
          kind: 'package',
        }),
      ]),
    );
  });

  it('extracts async methods', () => {
    const result = extractCSharpSymbols(
      `public class Controller {\n    public async Task<string> FetchAsync(string url) {\n        return "";\n    }\n}\n`,
      'src/Controller.cs',
    );
    expect(result.symbols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'FetchAsync', kind: 'method' }),
      ]),
    );
  });

  it('skips comment lines', () => {
    const result = extractCSharpSymbols(
      `// public class NotReal {}\npublic class Real {}\n`,
      'src/Real.cs',
    );
    const classes = result.symbols.filter((s) => s.kind === 'class');
    expect(classes).toHaveLength(1);
    expect(classes[0].name).toBe('Real');
  });

  it('returns empty for empty file', () => {
    const result = extractCSharpSymbols('', 'src/Empty.cs');
    expect(result.symbols).toHaveLength(0);
    expect(result.dependencies).toHaveLength(0);
  });
});
