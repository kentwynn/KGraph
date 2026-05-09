import { describe, expect, it } from 'vitest';
import { extractRustSymbols } from '../../src/scanner/rust-symbol-extractor.js';

describe('rust symbol extractor', () => {
  it('extracts top-level functions', () => {
    const result = extractRustSymbols(
      `pub fn greet(name: &str) -> String {\n    format!("Hello {}", name)\n}\n\nfn helper() {}\n`,
      'src/greet.rs',
    );
    expect(result.symbols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'greet',
          kind: 'function',
          exported: true,
        }),
        expect.objectContaining({
          name: 'helper',
          kind: 'function',
          exported: false,
        }),
      ]),
    );
  });

  it('extracts structs, enums, and traits', () => {
    const result = extractRustSymbols(
      `pub struct AuthService {}\n\npub enum Status { Active, Inactive }\n\npub trait Repository {}\n`,
      'src/auth.rs',
    );
    expect(result.symbols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'AuthService',
          kind: 'class',
          exported: true,
        }),
        expect.objectContaining({
          name: 'Status',
          kind: 'class',
          exported: true,
        }),
        expect.objectContaining({
          name: 'Repository',
          kind: 'class',
          exported: true,
        }),
      ]),
    );
  });

  it('extracts methods from impl blocks', () => {
    const result = extractRustSymbols(
      `struct User {}\n\nimpl User {\n    pub fn login(&self) -> bool {\n        true\n    }\n\n    fn internal(&self) {}\n}\n`,
      'src/user.rs',
    );
    expect(result.symbols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'login',
          kind: 'method',
          parentName: 'User',
          exported: true,
        }),
        expect.objectContaining({
          name: 'internal',
          kind: 'method',
          parentName: 'User',
          exported: false,
        }),
      ]),
    );
  });

  it('extracts async functions', () => {
    const result = extractRustSymbols(
      `pub async fn fetch(url: &str) -> String {\n    String::new()\n}\n`,
      'src/fetch.rs',
    );
    expect(result.symbols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'fetch',
          kind: 'function',
          exported: true,
        }),
      ]),
    );
  });

  it('extracts use statements as dependencies', () => {
    const result = extractRustSymbols(
      `use std::collections::HashMap;\nuse crate::auth::login;\nuse serde::Serialize;\n`,
      'src/main.rs',
    );
    expect(result.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          specifier: 'std::collections::HashMap',
          kind: 'package',
        }),
        expect.objectContaining({
          specifier: 'crate::auth::login',
          kind: 'local',
        }),
        expect.objectContaining({
          specifier: 'serde::Serialize',
          kind: 'package',
        }),
      ]),
    );
  });

  it('extracts impl Trait for Type methods', () => {
    const result = extractRustSymbols(
      `struct Repo {}\n\nimpl Repository for Repo {\n    fn find(&self, id: u64) -> Option<String> {\n        None\n    }\n}\n`,
      'src/repo.rs',
    );
    expect(result.symbols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'find',
          kind: 'method',
          parentName: 'Repo',
        }),
      ]),
    );
  });

  it('skips comment lines', () => {
    const result = extractRustSymbols(
      `// fn not_real() {}\nfn real() {}\n`,
      'src/real.rs',
    );
    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0].name).toBe('real');
  });

  it('returns empty results for empty file', () => {
    const result = extractRustSymbols('', 'src/empty.rs');
    expect(result.symbols).toHaveLength(0);
    expect(result.dependencies).toHaveLength(0);
  });
});
