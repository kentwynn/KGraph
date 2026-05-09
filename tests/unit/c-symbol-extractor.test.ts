import { describe, expect, it } from 'vitest';
import { extractCSymbols } from '../../src/scanner/c-symbol-extractor.js';

describe('c symbol extractor', () => {
  it('extracts top-level functions from C', () => {
    const result = extractCSymbols(
      `#include <stdio.h>\n\nint add(int a, int b) {\n    return a + b;\n}\n\nvoid greet(const char* name) {\n    printf("Hello %s\\n", name);\n}\n`,
      'src/math.c',
    );
    expect(result.symbols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'add', kind: 'function' }),
        expect.objectContaining({ name: 'greet', kind: 'function' }),
      ]),
    );
  });

  it('extracts class and methods from C++', () => {
    const result = extractCSymbols(
      `class AuthService {\npublic:\n    bool login(std::string user) {\n        return true;\n    }\n};\n`,
      'src/auth.cpp',
    );
    expect(result.symbols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'AuthService', kind: 'class' }),
        expect.objectContaining({
          name: 'login',
          kind: 'method',
          parentName: 'AuthService',
        }),
      ]),
    );
  });

  it('extracts #include as dependencies', () => {
    const result = extractCSymbols(
      `#include <vector>\n#include "auth.h"\n`,
      'src/main.cpp',
    );
    expect(result.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ specifier: 'vector', kind: 'package' }),
        expect.objectContaining({ specifier: 'auth.h', kind: 'local' }),
      ]),
    );
  });

  it('skips comment lines', () => {
    const result = extractCSymbols(
      `// int not_a_func() {\nint real(int x) {\n    return x;\n}\n`,
      'src/real.c',
    );
    const funcs = result.symbols.filter((s) => s.kind === 'function');
    expect(funcs).toHaveLength(1);
    expect(funcs[0].name).toBe('real');
  });

  it('returns empty for empty file', () => {
    const result = extractCSymbols('', 'src/empty.c');
    expect(result.symbols).toHaveLength(0);
    expect(result.dependencies).toHaveLength(0);
  });
});
