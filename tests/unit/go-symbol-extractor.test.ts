import { describe, expect, it } from 'vitest';
import { extractGoSymbols } from '../../src/scanner/go-symbol-extractor.js';

describe('go symbol extractor', () => {
  it('extracts top-level functions', () => {
    const result = extractGoSymbols(
      `package main\n\nfunc Greet(name string) string {\n\treturn "Hello " + name\n}\n\nfunc init() {}\n`,
      'src/greet.go',
    );
    expect(result.symbols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Greet',
          kind: 'function',
          exported: true,
        }),
        expect.objectContaining({
          name: 'init',
          kind: 'function',
          exported: false,
        }),
      ]),
    );
  });

  it('extracts struct and interface types', () => {
    const result = extractGoSymbols(
      `package main\n\ntype AuthService struct{}\n\ntype Repository interface {\n\tFind(id int) error\n}\n`,
      'src/auth.go',
    );
    expect(result.symbols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'AuthService', kind: 'class' }),
        expect.objectContaining({ name: 'Repository', kind: 'class' }),
      ]),
    );
  });

  it('extracts methods with receivers', () => {
    const result = extractGoSymbols(
      `package main\n\ntype User struct{}\n\nfunc (u *User) Login(pass string) error {\n\treturn nil\n}\n`,
      'src/user.go',
    );
    expect(result.symbols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Login',
          kind: 'method',
          parentName: 'User',
        }),
      ]),
    );
  });

  it('extracts single-line imports', () => {
    const result = extractGoSymbols(
      `package main\n\nimport "fmt"\nimport "net/http"\n`,
      'src/main.go',
    );
    expect(result.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ specifier: 'fmt', kind: 'package' }),
        expect.objectContaining({ specifier: 'net/http', kind: 'package' }),
      ]),
    );
  });

  it('extracts grouped import blocks', () => {
    const result = extractGoSymbols(
      `package main\n\nimport (\n\t"fmt"\n\t"os"\n\tlog "log/slog"\n)\n`,
      'src/main.go',
    );
    expect(result.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ specifier: 'fmt' }),
        expect.objectContaining({ specifier: 'os' }),
        expect.objectContaining({ specifier: 'log/slog' }),
      ]),
    );
  });

  it('skips comment lines', () => {
    const result = extractGoSymbols(
      `// func NotAFunc() {}\nfunc Real() {}\n`,
      'src/real.go',
    );
    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0].name).toBe('Real');
  });

  it('returns empty results for empty file', () => {
    const result = extractGoSymbols('', 'src/empty.go');
    expect(result.symbols).toHaveLength(0);
    expect(result.dependencies).toHaveLength(0);
  });
});
