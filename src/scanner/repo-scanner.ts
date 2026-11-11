import fg from 'fast-glob';
import crypto from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { estimateTokens } from '../session/token-estimator.js';
import type { KGraphConfig } from '../types/config.js';
import type {
  Dependency,
  Relationship,
  RepositoryFile,
  ScanResult,
} from '../types/maps.js';
import {
  extractBroadSymbols,
  supportsBroadExtraction,
} from './broad-symbol-extractor.js';
import { extractCSymbols } from './c-symbol-extractor.js';
import { extractCSharpSymbols } from './csharp-symbol-extractor.js';
import {
  buildFastGlobIgnore,
  detectLanguage,
  isPreciseLanguage,
  readGitignorePatterns,
  shouldExclude,
} from './file-classifier.js';
import {
  getChangedFilesSince,
  getGitIgnoredFiles,
  getUncommittedFiles,
  isGitRepo,
} from './git-utils.js';
import { extractGoSymbols } from './go-symbol-extractor.js';
import { extractJvmSymbols } from './jvm-symbol-extractor.js';
import { extractPhpSymbols } from './php-symbol-extractor.js';
import { extractPythonSymbols } from './python-symbol-extractor.js';
import { extractRubySymbols } from './ruby-symbol-extractor.js';
import { extractRustSymbols } from './rust-symbol-extractor.js';
import { extractShellSymbols } from './shell-symbol-extractor.js';
import { extractSqlSymbols } from './sql-symbol-extractor.js';
import { extractTsSymbols, resolveLocalImport } from './ts-symbol-extractor.js';

const C_EXTS = new Set(['.c', '.h', '.cpp', '.cc', '.cxx', '.hpp', '.hxx']);
const JVM_EXTS = new Set(['.java', '.kt', '.kts']);
const TS_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts']);

async function extractSymbols(text: string, repoPath: string) {
  const ext = path.extname(repoPath);
  const language = detectLanguage(repoPath);
  if (supportsBroadExtraction(language)) {
    return extractBroadSymbols(text, repoPath, language);
  }
  if (ext === '.py' || ext === '.pyw' || ext === '.pyi') {
    return extractPythonSymbols(text, repoPath);
  }
  if (ext === '.php') {
    return extractPhpSymbols(text, repoPath);
  }
  if (ext === '.rb' || ext === '.rake' || language === 'ruby') {
    return extractRubySymbols(text, repoPath);
  }
  if (['.sh', '.bash', '.zsh', '.fish'].includes(ext) || language === 'shell') {
    return extractShellSymbols(text, repoPath);
  }
  if (ext === '.sql') {
    return extractSqlSymbols(text, repoPath);
  }
  if (ext === '.go') {
    return extractGoSymbols(text, repoPath);
  }
  if (ext === '.rs') {
    return extractRustSymbols(text, repoPath);
  }
  if (JVM_EXTS.has(ext)) {
    return extractJvmSymbols(text, repoPath);
  }
  if (C_EXTS.has(ext)) {
    return extractCSymbols(text, repoPath);
  }
  if (ext === '.cs') {
    return extractCSharpSymbols(text, repoPath);
  }
  if (TS_EXTS.has(ext)) {
    return extractTsSymbols(text, repoPath);
  }
  return { symbols: [], dependencies: [], relationships: [], warnings: [] };
}

export async function scanRepository(
  rootPath: string,
  config: KGraphConfig,
  previous?: ScanResult & { scannedAtCommit?: string },
): Promise<ScanResult> {
  const gitignorePatterns = await readGitignorePatterns(rootPath);
  const allExcludes = [...config.exclude, ...gitignorePatterns];
  const mergedConfig: KGraphConfig = { ...config, exclude: allExcludes };
  const rawEntries = await fg(config.include, {
    cwd: rootPath,
    dot: true,
    onlyFiles: true,
    unique: true,
    ignore: buildFastGlobIgnore(allExcludes),
  });
  const gitIgnored = (await isGitRepo(rootPath))
    ? await getGitIgnoredFiles(rootPath, rawEntries)
    : new Set<string>();
  const entries = rawEntries.filter((entry) => !gitIgnored.has(entry));

  // Build lookup maps from previous scan for incremental skip
  const prevFileByPath = new Map(
    (previous?.files ?? []).map((f) => [f.path, f]),
  );
  const prevSymbolsByFile = new Map<string, ScanResult['symbols']>();
  const prevDepsByFile = new Map<string, ScanResult['dependencies']>();
  const prevRelsBySource = new Map<string, Relationship[]>();
  if (previous) {
    for (const sym of previous.symbols) {
      const arr = prevSymbolsByFile.get(sym.filePath) ?? [];
      arr.push(sym);
      prevSymbolsByFile.set(sym.filePath, arr);
    }
    for (const dep of previous.dependencies) {
      const arr = prevDepsByFile.get(dep.fromFile) ?? [];
      arr.push(dep);
      prevDepsByFile.set(dep.fromFile, arr);
    }
    for (const rel of previous.relationships) {
      if (
        rel.relationshipType !== 'import' &&
        rel.relationshipType !== 'moved-from'
      ) {
        const arr = prevRelsBySource.get(rel.sourceId) ?? [];
        arr.push(rel);
        prevRelsBySource.set(rel.sourceId, arr);
      }
    }
  }

  // Build git-changed-file set for fast incremental skip bypassing stat() calls.
  // Only used when the previous scan stored a commit hash and we are in a git repo.
  let gitChangedFiles: Set<string> | null = null;
  let uncommittedFiles = new Set<string>();
  if (await isGitRepo(rootPath)) {
    const uncommitted = await getUncommittedFiles(rootPath);
    uncommittedFiles = new Set(uncommitted ?? []);
    if (previous?.scannedAtCommit && uncommitted) {
      const changed = await getChangedFilesSince(
        rootPath,
        previous.scannedAtCommit,
      );
      gitChangedFiles = new Set([...changed, ...uncommitted]);
    }
  }

  const files: RepositoryFile[] = [];
  const symbols: ScanResult['symbols'] = [];
  const dependencies: ScanResult['dependencies'] = [];
  const relationships: Relationship[] = [];
  const warnings: string[] = [];
  let skippedFiles = 0;

  for (const repoPath of entries.sort()) {
    if (shouldExclude(repoPath, mergedConfig)) {
      continue;
    }

    const absolutePath = path.join(rootPath, repoPath);
    try {
      const prevFile = prevFileByPath.get(repoPath);

      // Fast git-based skip: if we have a git-changed set and this file is NOT in it,
      // carry forward directly without touching the filesystem. A file that was dirty
      // at the last scan may since have been reverted, so it is always re-checked.
      if (
        prevFile &&
        !prevFile.uncommitted &&
        gitChangedFiles !== null &&
        !gitChangedFiles.has(repoPath)
      ) {
        files.push(prevFile);
        const prevSyms = prevSymbolsByFile.get(repoPath);
        if (prevSyms) symbols.push(...prevSyms);
        const prevDeps = prevDepsByFile.get(repoPath);
        if (prevDeps) dependencies.push(...prevDeps);
        const prevRels = prevRelsBySource.get(repoPath);
        if (prevRels) relationships.push(...prevRels);
        if (prevSyms) {
          for (const sym of prevSyms) {
            const symRels = prevRelsBySource.get(sym.id);
            if (symRels) relationships.push(...symRels);
          }
        }
        skippedFiles++;
        continue;
      }

      const info = await stat(absolutePath);

      // Fallback incremental skip: if mtime and size match previous, carry forward
      if (
        prevFile &&
        prevFile.sizeBytes === info.size &&
        prevFile.modifiedAt === info.mtime.toISOString()
      ) {
        files.push({
          ...prevFile,
          modifiedAt: info.mtime.toISOString(),
          uncommitted: uncommittedFiles.has(repoPath) || undefined,
        });
        const prevSyms = prevSymbolsByFile.get(repoPath);
        if (prevSyms) symbols.push(...prevSyms);
        const prevDeps = prevDepsByFile.get(repoPath);
        if (prevDeps) dependencies.push(...prevDeps);
        const prevRels = prevRelsBySource.get(repoPath);
        if (prevRels) relationships.push(...prevRels);
        // Also carry forward symbol-sourced relationships
        if (prevSyms) {
          for (const sym of prevSyms) {
            const symRels = prevRelsBySource.get(sym.id);
            if (symRels) relationships.push(...symRels);
          }
        }
        skippedFiles++;
        continue;
      }

      const content = await readFile(absolutePath);
      const text = content.toString('utf8');
      const contentHash = crypto
        .createHash('sha256')
        .update(content)
        .digest('hex');
      const file: RepositoryFile = {
        id: repoPath,
        path: repoPath,
        extension: path.extname(repoPath),
        language: detectLanguage(repoPath),
        sizeBytes: info.size,
        modifiedAt: info.mtime.toISOString(),
        contentHash,
        tokenEstimate: estimateTokens(text, repoPath),
        scanStatus: isPreciseLanguage(repoPath, config) ? 'mapped' : 'generic',
        warnings: [],
      };
      if (uncommittedFiles.has(repoPath)) file.uncommitted = true;

      if (isPreciseLanguage(repoPath, config)) {
        const extracted = await extractSymbols(text, repoPath);
        symbols.push(...extracted.symbols);
        dependencies.push(...extracted.dependencies);
        relationships.push(
          ...extracted.relationships.filter(
            (relationship) => relationship.relationshipType !== 'import',
          ),
        );
        file.warnings.push(...extracted.warnings);
      }

      files.push(file);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`${repoPath}: ${message}`);
      files.push({
        id: repoPath,
        path: repoPath,
        extension: path.extname(repoPath),
        language: detectLanguage(repoPath),
        sizeBytes: 0,
        contentHash: '',
        scanStatus: 'failed',
        warnings: [message],
      });
    }
  }

  resolveLocalDependencies(dependencies, files, await readTsPathAliases(rootPath));
  correctGuessedCallTargets(dependencies, relationships);
  relationships.push(...buildImportRelationships(dependencies));
  relationships.push(
    ...detectMovedFiles(
      (previous?.files ?? []).filter(
        (file) => !shouldExclude(file.path, mergedConfig),
      ),
      files,
    ),
  );
  return {
    files,
    symbols,
    dependencies,
    relationships,
    warnings,
    skippedFiles,
  };
}

const SOURCE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.mts',
  '.cts',
  '.py',
  '.go',
  '.rs',
  '.java',
  '.kt',
  '.kts',
  '.c',
  '.h',
  '.cpp',
  '.cc',
  '.cxx',
  '.hpp',
  '.hxx',
  '.cs',
  '.php',
  '.swift',
  '.rb',
  '.rake',
  '.lua',
  '.dart',
  '.ex',
  '.exs',
  '.scala',
] as const;

export interface TsPathAlias {
  /** Alias without a trailing `*`, for example `@app/common` or `@app/elf/`. */
  prefix: string;
  wildcard: boolean;
  /** Repository-relative targets, `*` still in place. */
  targets: string[];
}

/** `compilerOptions.paths` from the root `tsconfig.base.json` and `tsconfig.json`. */
export async function readTsPathAliases(rootPath: string): Promise<TsPathAlias[]> {
  const aliases: TsPathAlias[] = [];
  for (const name of ['tsconfig.base.json', 'tsconfig.json']) {
    let text: string;
    try {
      text = await readFile(path.join(rootPath, name), 'utf8');
    } catch {
      continue;
    }
    const parsed = ts.parseConfigFileTextToJson(name, text);
    const options = parsed.config?.compilerOptions ?? {};
    const paths: Record<string, string[]> = options.paths ?? {};
    const baseUrl = path.posix.normalize(String(options.baseUrl ?? '.'));
    for (const [pattern, targets] of Object.entries(paths)) {
      if (!Array.isArray(targets)) continue;
      const wildcard = pattern.endsWith('*');
      aliases.push({
        prefix: wildcard ? pattern.slice(0, -1) : pattern,
        wildcard,
        targets: targets.map((target) => path.posix.normalize(path.posix.join(baseUrl, target))),
      });
    }
  }
  // Longest prefix first, so `@app/elf/*` wins over `@app/elf`.
  return aliases.sort((a, b) => b.prefix.length - a.prefix.length);
}

function resolveLocalDependencies(
  dependencies: Dependency[],
  files: RepositoryFile[],
  aliases: TsPathAlias[] = [],
): void {
  const filePaths = new Set(files.map((file) => file.path));

  for (const dependency of dependencies) {
    if (dependency.specifier.startsWith('.')) {
      if (dependency.kind === 'local') {
        dependency.resolvedFile = resolveLocalDependencyPath(
          dependency.fromFile,
          dependency.specifier,
          filePaths,
        );
      }
      continue;
    }
    const aliased = resolveAliasPath(dependency.specifier, aliases, filePaths);
    if (aliased) {
      dependency.kind = 'local';
      dependency.resolvedFile = aliased;
    } else if (dependency.kind === 'local') {
      dependency.resolvedFile = undefined;
    }
  }
}

function resolveAliasPath(
  specifier: string,
  aliases: TsPathAlias[],
  filePaths: Set<string>,
): string | undefined {
  for (const alias of aliases) {
    const matches = alias.wildcard
      ? specifier.startsWith(alias.prefix)
      : specifier === alias.prefix;
    if (!matches) continue;
    const rest = alias.wildcard ? specifier.slice(alias.prefix.length) : '';
    for (const target of alias.targets) {
      const resolved = resolveCandidates(target.replace('*', rest), filePaths);
      if (resolved) return resolved;
    }
  }
  return undefined;
}

/**
 * The extractor guesses import paths before the file list is known (`./user.model` becomes
 * `user.model`, `./Header` becomes `Header.ts`); point call targets at the resolved file.
 */
function correctGuessedCallTargets(
  dependencies: Dependency[],
  relationships: Relationship[],
): void {
  const resolved = new Map<string, string>();
  for (const dependency of dependencies) {
    if (!dependency.resolvedFile) continue;
    const guess = resolveLocalImport(dependency.fromFile, dependency.specifier);
    if (guess && guess !== dependency.resolvedFile) {
      resolved.set(`${dependency.fromFile}|${guess}`, dependency.resolvedFile);
    }
  }
  if (resolved.size === 0) return;
  for (const relationship of relationships) {
    if (relationship.relationshipType !== 'calls') continue;
    const hash = relationship.targetId.lastIndexOf('#');
    if (hash < 0) continue;
    const fromFile = relationship.sourceId.split('#')[0];
    const target = resolved.get(`${fromFile}|${relationship.targetId.slice(0, hash)}`);
    if (target) {
      relationship.targetId = `${target}${relationship.targetId.slice(hash)}`;
    }
  }
}

function resolveLocalDependencyPath(
  fromFile: string,
  specifier: string,
  filePaths: Set<string>,
): string | undefined {
  if (!specifier.startsWith('.')) {
    return undefined;
  }

  if (path.posix.extname(fromFile) === '.py') {
    return resolvePythonRelativeImportPath(fromFile, specifier, filePaths);
  }

  const base = path.posix.normalize(
    path.posix.join(path.posix.dirname(fromFile), specifier),
  );
  return resolveCandidates(base, filePaths);
}

/** The file an import path names: as written, with a source extension, or as a folder index. */
function resolveCandidates(
  base: string,
  filePaths: Set<string>,
): string | undefined {
  // Always try added extensions: `user.model` and `useX.hook` name `user.model.ts`.
  const candidates = [
    base,
    ...SOURCE_EXTENSIONS.map((extension) => `${base}${extension}`),
    ...SOURCE_EXTENSIONS.map((extension) =>
      path.posix.join(base, `index${extension}`),
    ),
  ];

  return candidates.find((candidate) => filePaths.has(candidate));
}

function resolvePythonRelativeImportPath(
  fromFile: string,
  specifier: string,
  filePaths: Set<string>,
): string | undefined {
  const match = specifier.match(/^(\.+)(.*)$/);
  if (!match) {
    return undefined;
  }

  const [, dots, moduleName] = match;
  const packageParts = path.posix.dirname(fromFile).split('/');
  const levelsUp = Math.max(0, dots.length - 1);
  const baseParts =
    levelsUp > 0 ? packageParts.slice(0, -levelsUp) : packageParts;
  const modulePath = moduleName
    .split('.')
    .filter(Boolean)
    .join('/');
  const base = path.posix.normalize(
    path.posix.join(...baseParts, modulePath),
  );
  const candidates = [
    `${base}.py`,
    path.posix.join(base, '__init__.py'),
  ];

  return candidates.find((candidate) => filePaths.has(candidate));
}

function buildImportRelationships(dependencies: Dependency[]): Relationship[] {
  return dependencies.map((dependency) => ({
    sourceType: 'file',
    sourceId: dependency.fromFile,
    targetType: dependency.kind === 'local' ? 'file' : 'package',
    targetId: dependency.resolvedFile ?? dependency.specifier,
    relationshipType: 'import',
    confidence: dependency.resolvedFile
      ? 'high'
      : dependency.kind === 'local'
        ? 'low'
        : 'medium',
  }));
}

function detectMovedFiles(
  previousFiles: RepositoryFile[],
  currentFiles: RepositoryFile[],
): Relationship[] {
  const currentPaths = new Set(currentFiles.map((file) => file.path));
  const previousByHash = new Map(
    previousFiles
      .filter((file) => file.contentHash)
      .map((file) => [file.contentHash, file]),
  );
  const relationships: Relationship[] = [];

  for (const file of currentFiles) {
    const previous = previousByHash.get(file.contentHash);
    if (
      previous &&
      previous.path !== file.path &&
      !currentPaths.has(previous.path)
    ) {
      relationships.push({
        sourceType: 'file',
        sourceId: file.path,
        targetType: 'file',
        targetId: previous.path,
        relationshipType: 'moved-from',
        confidence: 'high',
      });
    }
  }

  return relationships;
}
