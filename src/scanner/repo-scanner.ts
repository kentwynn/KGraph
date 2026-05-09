import fg from 'fast-glob';
import crypto from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { KGraphConfig } from '../types/config.js';
import type {
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
import { extractGoSymbols } from './go-symbol-extractor.js';
import { extractJvmSymbols } from './jvm-symbol-extractor.js';
import { extractPythonSymbols } from './python-symbol-extractor.js';
import { extractRustSymbols } from './rust-symbol-extractor.js';
import { extractTsSymbols } from './ts-symbol-extractor.js';

const C_EXTS = new Set(['.c', '.h', '.cpp', '.cc', '.cxx', '.hpp', '.hxx']);
const JVM_EXTS = new Set(['.java', '.kt', '.kts']);

function extractSymbols(text: string, repoPath: string) {
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
  previous?: ScanResult,
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

  const files: RepositoryFile[] = [];
  const symbols: ScanResult['symbols'] = [];
  const dependencies: ScanResult['dependencies'] = [];
  const relationships: Relationship[] = [];
  const warnings: string[] = [];

  for (const repoPath of entries.sort()) {
    if (shouldExclude(repoPath, mergedConfig)) {
      continue;
    }

    const absolutePath = path.join(rootPath, repoPath);
    try {
      const [info, content] = await Promise.all([
        stat(absolutePath),
        readFile(absolutePath),
      ]);
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
        scanStatus: isPreciseLanguage(repoPath, config) ? 'mapped' : 'generic',
        warnings: [],
      };

      if (isPreciseLanguage(repoPath, config)) {
        const extracted = extractSymbols(text, repoPath);
        symbols.push(...extracted.symbols);
        dependencies.push(...extracted.dependencies);
        relationships.push(...extracted.relationships);
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

  relationships.push(...detectMovedFiles(previous?.files ?? [], files));
  return { files, symbols, dependencies, relationships, warnings };
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
