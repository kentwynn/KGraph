import { describe, expect, it } from 'vitest';
import { extractJvmSymbols } from '../../src/scanner/jvm-symbol-extractor.js';

describe('jvm symbol extractor — Java', () => {
  it('extracts classes and methods', () => {
    const result = extractJvmSymbols(
      `package com.example;\n\npublic class AuthService {\n    public boolean login(String user) {\n        return true;\n    }\n    private void helper() {}\n}\n`,
      'src/AuthService.java',
    );
    expect(result.symbols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'AuthService',
          kind: 'class',
          exported: true,
        }),
        expect.objectContaining({
          name: 'login',
          kind: 'method',
          parentName: 'AuthService',
          exported: true,
        }),
        expect.objectContaining({
          name: 'helper',
          kind: 'method',
          parentName: 'AuthService',
          exported: false,
        }),
      ]),
    );
  });

  it('extracts import statements', () => {
    const result = extractJvmSymbols(
      `import java.util.List;\nimport java.util.Map;\n`,
      'src/Foo.java',
    );
    expect(result.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          specifier: 'java.util.List',
          kind: 'package',
        }),
        expect.objectContaining({
          specifier: 'java.util.Map',
          kind: 'package',
        }),
      ]),
    );
  });

  it('extracts interface', () => {
    const result = extractJvmSymbols(
      `public interface Repository {\n    void save(Object o);\n}\n`,
      'src/Repository.java',
    );
    expect(result.symbols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Repository', kind: 'class' }),
      ]),
    );
  });
});

describe('jvm symbol extractor — Kotlin', () => {
  it('extracts class and fun', () => {
    const result = extractJvmSymbols(
      `class SessionManager {\n    fun login(user: String): Boolean = true\n    private fun hash(): String = ""\n}\n`,
      'src/SessionManager.kt',
    );
    expect(result.symbols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'SessionManager', kind: 'class' }),
        expect.objectContaining({
          name: 'login',
          kind: 'method',
          parentName: 'SessionManager',
        }),
        expect.objectContaining({
          name: 'hash',
          kind: 'method',
          parentName: 'SessionManager',
        }),
      ]),
    );
  });

  it('extracts top-level functions', () => {
    const result = extractJvmSymbols(
      `fun greet(name: String): String = "Hello $name"\n`,
      'src/greet.kt',
    );
    expect(result.symbols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'greet', kind: 'function' }),
      ]),
    );
  });

  it('extracts data class', () => {
    const result = extractJvmSymbols(
      `data class User(val id: Long, val name: String)\n`,
      'src/User.kt',
    );
    expect(result.symbols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'User', kind: 'class' }),
      ]),
    );
  });
});
