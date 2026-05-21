/**
 * Copies tree-sitter .wasm grammar files into dist/grammars/ for bundling.
 * Prefers individual tree-sitter-* packages; falls back to tree-sitter-wasms.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);

const GRAMMARS = {
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
  c_sharp: { pkg: 'tree-sitter-c-sharp', wasm: 'tree-sitter-c_sharp.wasm' },
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

const outDir = path.resolve('dist/grammars');
fs.mkdirSync(outDir, { recursive: true });

let fallbackDir = null;
try {
  fallbackDir = path.join(
    path.dirname(require.resolve('tree-sitter-wasms/package.json')),
    'out',
  );
} catch {
  // tree-sitter-wasms not installed, that's okay if all individual packages have .wasm
}

let copied = 0;
let failed = [];

for (const [key, { pkg, wasm }] of Object.entries(GRAMMARS)) {
  const dest = path.join(outDir, wasm);
  let src = null;

  // Try individual package first
  try {
    const pkgDir = path.dirname(require.resolve(`${pkg}/package.json`));
    const candidate = path.join(pkgDir, wasm);
    if (fs.existsSync(candidate)) {
      src = candidate;
    }
  } catch {
    // package not found
  }

  // Fallback to tree-sitter-wasms
  if (!src && fallbackDir) {
    const candidate = path.join(fallbackDir, wasm);
    if (fs.existsSync(candidate)) {
      src = candidate;
    }
  }

  if (src) {
    fs.copyFileSync(src, dest);
    copied++;
  } else {
    failed.push(key);
  }
}

console.log(
  `Bundled ${copied}/${Object.keys(GRAMMARS).length} grammar .wasm files into dist/grammars/`,
);
if (failed.length > 0) {
  console.error(`ERROR: Missing .wasm files for: ${failed.join(', ')}`);
  process.exit(1);
}
