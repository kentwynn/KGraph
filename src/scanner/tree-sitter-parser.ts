import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Language, Parser, Tree } from 'web-tree-sitter';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

let initPromise: Promise<void> | null = null;
const languageCache = new Map<string, Language>();

export type GrammarKey =
  | 'python'
  | 'java'
  | 'kotlin'
  | 'go'
  | 'rust'
  | 'c'
  | 'cpp'
  | 'c_sharp'
  | 'php'
  | 'ruby'
  | 'bash'
  | 'yaml'
  | 'json'
  | 'html'
  | 'css'
  | 'lua'
  | 'dart'
  | 'elixir'
  | 'scala';

const GRAMMAR_PACKAGES: Record<GrammarKey, { pkg: string; wasm: string }> = {
  python: { pkg: 'tree-sitter-python', wasm: 'tree-sitter-python.wasm' },
  java: { pkg: 'tree-sitter-java', wasm: 'tree-sitter-java.wasm' },
  kotlin: {
    pkg: '@tree-sitter-grammars/tree-sitter-kotlin',
    wasm: 'tree-sitter-kotlin.wasm',
  },
  go: { pkg: 'tree-sitter-go', wasm: 'tree-sitter-go.wasm' },
  rust: { pkg: 'tree-sitter-rust', wasm: 'tree-sitter-rust.wasm' },
  c: { pkg: 'tree-sitter-c', wasm: 'tree-sitter-c.wasm' },
  cpp: { pkg: 'tree-sitter-cpp', wasm: 'tree-sitter-cpp.wasm' },
  c_sharp: {
    pkg: 'tree-sitter-c-sharp',
    wasm: 'tree-sitter-c_sharp.wasm',
  },
  php: { pkg: 'tree-sitter-php', wasm: 'tree-sitter-php.wasm' },
  ruby: { pkg: 'tree-sitter-ruby', wasm: 'tree-sitter-ruby.wasm' },
  bash: { pkg: 'tree-sitter-bash', wasm: 'tree-sitter-bash.wasm' },
  yaml: {
    pkg: '@tree-sitter-grammars/tree-sitter-yaml',
    wasm: 'tree-sitter-yaml.wasm',
  },
  json: { pkg: 'tree-sitter-json', wasm: 'tree-sitter-json.wasm' },
  html: { pkg: 'tree-sitter-html', wasm: 'tree-sitter-html.wasm' },
  css: { pkg: 'tree-sitter-css', wasm: 'tree-sitter-css.wasm' },
  lua: { pkg: 'tree-sitter-lua', wasm: 'tree-sitter-lua.wasm' },
  dart: { pkg: 'tree-sitter-dart', wasm: 'tree-sitter-dart.wasm' },
  elixir: { pkg: 'tree-sitter-elixir', wasm: 'tree-sitter-elixir.wasm' },
  scala: { pkg: 'tree-sitter-scala', wasm: 'tree-sitter-scala.wasm' },
};

async function ensureInit(): Promise<void> {
  if (!initPromise) {
    initPromise = Parser.init();
  }
  return initPromise;
}

function resolveWasmPath(grammarKey: GrammarKey): string {
  const { pkg, wasm } = GRAMMAR_PACKAGES[grammarKey];

  // Production: bundled in dist/grammars/
  const bundled = path.join(__dirname, '..', 'grammars', wasm);
  if (fs.existsSync(bundled)) return bundled;

  // Development: resolve from node_modules
  try {
    const pkgDir = path.dirname(require.resolve(`${pkg}/package.json`));
    const fromPkg = path.join(pkgDir, wasm);
    if (fs.existsSync(fromPkg)) return fromPkg;
  } catch {
    // package not installed
  }

  // Fallback: tree-sitter-wasms package
  try {
    const wasmsDir = path.join(
      path.dirname(require.resolve('tree-sitter-wasms/package.json')),
      'out',
    );
    const fromWasms = path.join(wasmsDir, wasm);
    if (fs.existsSync(fromWasms)) return fromWasms;
  } catch {
    // tree-sitter-wasms not installed
  }

  throw new Error(
    `Cannot find ${wasm} for grammar "${grammarKey}". Run "npm run build" or install dev dependencies.`,
  );
}

export async function loadLanguage(grammarKey: GrammarKey): Promise<Language> {
  const cached = languageCache.get(grammarKey);
  if (cached) return cached;

  await ensureInit();
  const wasmPath = resolveWasmPath(grammarKey);
  const language = await Language.load(wasmPath);
  languageCache.set(grammarKey, language);
  return language;
}

export async function parseSource(
  sourceText: string,
  grammarKey: GrammarKey,
): Promise<Tree> {
  await ensureInit();
  const language = await loadLanguage(grammarKey);
  const parser = new Parser();
  parser.setLanguage(language);
  const tree = parser.parse(sourceText);
  parser.delete();
  if (!tree) {
    throw new Error(`Failed to parse source with grammar ${grammarKey}`);
  }
  return tree;
}
