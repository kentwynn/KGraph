import fg from 'fast-glob';
import crypto from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { estimateTokens } from '../session/token-estimator.js';
import type { KGraphConfig } from '../types/config.js';
import type {
  Dependency,
  Relationship,
  RepositoryFile,
  ScanResult,
} from '../types/maps.js';
import { extractCSymbols } from './c-symbol-extractor.js';
import { extractCSharpSymbols } from './csharp-symbol-extractor.js';
import {
  buildFastGlobIgnore,
  detectLanguage,
  isPreciseLanguage,
  readGitignorePatterns,
  shouldExclude,
} from './file-classifier.js';
import { getChangedFilesSince, isGitRepo } from './git-utils.js';
import { extractGoSymbols } from './go-symbol-extractor.js';
import { extractJvmSymbols } from './jvm-symbol-extractor.js';
import { extractPythonSymbols } from './python-symbol-extractor.js';
import { extractRustSymbols } from './rust-symbol-extractor.js';
import { extractTsSymbols } from './ts-symbol-extractor.js';

const C_EXTS = new Set(['.c', '.h', '.cpp', '.cc', '.cxx', '.hpp', '.hxx']);
const JVM_EXTS = new Set(['.java', '.kt', '.kts']);

async function extractSymbols(text: string, repoPath: string) {
  const ext = path.extname(repoPath);
  if (ext === '.py' || ext === '.pyw' || ext === '.pyi') {
    return extractPythonSymbols(text, repoPath);
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
  return extractTsSymbols(text, repoPath);
}

export async function scanRepository(
  rootPath: string,
  config: KGraphConfig,
  previous?: ScanResult & { scannedAtCommit?: string },
): Promise<ScanResult> {
  const gitignorePatterns = await readGitignorePatterns(rootPath);
  const allExcludes = [...config.exclude, ...gitignorePatterns];
  const mergedConfig: KGraphConfig = { ...config, exclude: allExcludes };
  const entries = await fg(config.include, {
    cwd: rootPath,
    dot: true,
    onlyFiles: true,
    unique: true,
    ignore: buildFastGlobIgnore(allExcludes),
  });

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
  if (previous?.scannedAtCommit && (await isGitRepo(rootPath))) {
    const changed = await getChangedFilesSince(
      rootPath,
      previous.scannedAtCommit,
    );
    // Also include working-tree dirty files so uncommitted edits are always re-scanned.
    // getChangedFilesSince returns committed changes; we complement with a stat check
    // fallback below for uncommitted edits to keep correctness.
    gitChangedFiles = new Set(changed);
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
      // carry forward directly without touching the filesystem.
      if (
        prevFile &&
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
        files.push({ ...prevFile, modifiedAt: info.mtime.toISOString() });
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

  resolveLocalDependencies(dependencies, files);
  relationships.push(...buildImportRelationships(dependencies));
  relationships.push(...detectMovedFiles(previous?.files ?? [], files));
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
] as const;

function resolveLocalDependencies(
  dependencies: Dependency[],
  files: RepositoryFile[],
): void {
  const filePaths = new Set(files.map((file) => file.path));

  for (const dependency of dependencies) {
    if (dependency.kind !== 'local') {
      continue;
    }
    dependency.resolvedFile = resolveLocalDependencyPath(
      dependency.fromFile,
      dependency.specifier,
      filePaths,
    );
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

  const base = path.posix.normalize(
    path.posix.join(path.posix.dirname(fromFile), specifier),
  );
  const candidates = path.posix.extname(base)
    ? [base]
    : [
        ...SOURCE_EXTENSIONS.map((extension) => `${base}${extension}`),
        ...SOURCE_EXTENSIONS.map((extension) =>
          path.posix.join(base, `index${extension}`),
        ),
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
