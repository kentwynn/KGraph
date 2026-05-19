import type { CodeSymbol, Dependency, Relationship } from '../types/maps.js';
import { parseSource, type GrammarKey } from './tree-sitter-parser.js';
import type { SymbolExtractionResult } from './ts-symbol-extractor.js';

type BroadLanguage =
  | 'swift'
  | 'terraform'
  | 'graphql'
  | 'protobuf'
  | 'lua'
  | 'dart'
  | 'elixir'
  | 'scala'
  | 'r'
  | 'yaml'
  | 'json'
  | 'toml'
  | 'dockerfile'
  | 'markdown'
  | 'html'
  | 'css'
  | 'scss'
  | 'sass'
  | 'less'
  | 'xml';

const TREE_SITTER_GRAMMAR_BY_LANGUAGE: Partial<Record<BroadLanguage, GrammarKey>> = {
  yaml: 'yaml',
  json: 'json',
  html: 'html',
  css: 'css',
  lua: 'lua',
  dart: 'dart',
  elixir: 'elixir',
  scala: 'scala',
};

export async function extractBroadSymbols(
  sourceText: string,
  filePath: string,
  language: string,
): Promise<SymbolExtractionResult> {
  const result = createExtractionResult();
  if (!sourceText.trim()) {
    return result;
  }

  const broadLanguage = language as BroadLanguage;
  const grammar = TREE_SITTER_GRAMMAR_BY_LANGUAGE[broadLanguage];
  if (grammar) {
    try {
      const tree = await parseSource(sourceText, grammar);
      tree.delete();
    } catch (error) {
      result.warnings.push(
        `tree-sitter ${grammar} parse failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const lines = sourceText.split(/\r?\n/);
  switch (broadLanguage) {
    case 'swift':
      collectSwift(lines, filePath, result);
      break;
    case 'terraform':
      collectTerraform(lines, filePath, result);
      break;
    case 'graphql':
      collectGraphql(lines, filePath, result);
      break;
    case 'protobuf':
      collectProtobuf(lines, filePath, result);
      break;
    case 'lua':
      collectLua(lines, filePath, result);
      break;
    case 'dart':
      collectDart(lines, filePath, result);
      break;
    case 'elixir':
      collectElixir(lines, filePath, result);
      break;
    case 'scala':
      collectScala(lines, filePath, result);
      break;
    case 'r':
      collectR(lines, filePath, result);
      break;
    case 'yaml':
    case 'json':
    case 'toml':
    case 'dockerfile':
      collectConfig(lines, filePath, result, broadLanguage);
      break;
    case 'markdown':
      collectMarkdown(lines, filePath, result);
      break;
    case 'html':
    case 'xml':
      collectMarkup(lines, filePath, result);
      break;
    case 'css':
    case 'scss':
    case 'sass':
    case 'less':
      collectStylesheet(lines, filePath, result);
      break;
  }

  return result;
}

export function supportsBroadExtraction(language: string): boolean {
  return [
    'swift',
    'terraform',
    'graphql',
    'protobuf',
    'lua',
    'dart',
    'elixir',
    'scala',
    'r',
    'yaml',
    'json',
    'toml',
    'dockerfile',
    'markdown',
    'html',
    'css',
    'scss',
    'sass',
    'less',
    'xml',
  ].includes(language);
}

function createExtractionResult(): SymbolExtractionResult {
  return { symbols: [], dependencies: [], relationships: [], warnings: [] };
}

function addSymbol(
  result: SymbolExtractionResult,
  filePath: string,
  name: string,
  kind: CodeSymbol['kind'],
  line: number,
  exported = false,
  parentName?: string,
): CodeSymbol {
  const id = [filePath, kind, parentName, name, line].filter(Boolean).join('#');
  const symbol: CodeSymbol = {
    id,
    name,
    kind,
    filePath,
    startLine: line,
    endLine: line,
    exported,
    parentName,
  };
  result.symbols.push(symbol);
  result.relationships.push({
    sourceType: 'file',
    sourceId: filePath,
    targetType: 'symbol',
    targetId: id,
    relationshipType: 'contains',
    confidence: 'high',
  });
  return symbol;
}

function addDependency(
  result: SymbolExtractionResult,
  filePath: string,
  specifier: string,
  kind: Dependency['kind'] = specifier.startsWith('.') ? 'local' : 'package',
): void {
  result.dependencies.push({ fromFile: filePath, specifier, kind });
}

function collectSwift(
  lines: string[],
  filePath: string,
  result: SymbolExtractionResult,
): void {
  forEachLine(lines, (line, lineNumber) => {
    const importMatch = line.match(/^\s*import\s+([A-Za-z_][\w.]*)/);
    if (importMatch?.[1]) addDependency(result, filePath, importMatch[1]);

    const typeMatch = line.match(/^\s*(?:public|private|internal|open|final|\s)*(class|struct|enum|protocol)\s+([A-Za-z_][\w]*)/);
    if (typeMatch?.[2]) {
      addSymbol(
        result,
        filePath,
        typeMatch[2],
        typeMatch[1] === 'protocol' ? 'interface' : 'class',
        lineNumber,
        true,
      );
    }

    const functionMatch = line.match(/^\s*(?:public|private|internal|open|static|\s)*func\s+([A-Za-z_][\w]*)/);
    if (functionMatch?.[1]) {
      addSymbol(result, filePath, functionMatch[1], 'function', lineNumber, true);
    }
  });
}

function collectTerraform(
  lines: string[],
  filePath: string,
  result: SymbolExtractionResult,
): void {
  forEachLine(lines, (line, lineNumber) => {
    const blockMatch = line.match(/^\s*(resource|data|module|variable|output|provider)\s+"([^"]+)"(?:\s+"([^"]+)")?/);
    if (blockMatch?.[1] && blockMatch[2]) {
      addSymbol(
        result,
        filePath,
        [blockMatch[1], blockMatch[2], blockMatch[3]].filter(Boolean).join('.'),
        'type',
        lineNumber,
        true,
      );
    }
  });
}

function collectGraphql(
  lines: string[],
  filePath: string,
  result: SymbolExtractionResult,
): void {
  forEachLine(lines, (line, lineNumber) => {
    const typeMatch = line.match(/^\s*(type|interface|enum|input|union|scalar)\s+([A-Za-z_][\w]*)/);
    if (typeMatch?.[2]) {
      addSymbol(
        result,
        filePath,
        typeMatch[2],
        typeMatch[1] === 'interface' ? 'interface' : 'type',
        lineNumber,
        true,
      );
    }
  });
}

function collectProtobuf(
  lines: string[],
  filePath: string,
  result: SymbolExtractionResult,
): void {
  forEachLine(lines, (line, lineNumber) => {
    const importMatch = line.match(/^\s*import\s+"([^"]+)"/);
    if (importMatch?.[1]) addDependency(result, filePath, importMatch[1], 'local');

    const typeMatch = line.match(/^\s*(message|service|enum)\s+([A-Za-z_][\w]*)/);
    if (typeMatch?.[2]) {
      addSymbol(result, filePath, typeMatch[2], 'type', lineNumber, true);
    }
  });
}

function collectLua(
  lines: string[],
  filePath: string,
  result: SymbolExtractionResult,
): void {
  forEachLine(lines, (line, lineNumber) => {
    const requireMatch = line.match(/require\s*\(?\s*['"]([^'"]+)['"]/);
    if (requireMatch?.[1]) addDependency(result, filePath, requireMatch[1]);

    const functionMatch = line.match(/^\s*(?:local\s+)?function\s+([A-Za-z_][\w.:]*)/);
    if (functionMatch?.[1]) {
      addSymbol(result, filePath, functionMatch[1], 'function', lineNumber, true);
    }
  });
}

function collectDart(
  lines: string[],
  filePath: string,
  result: SymbolExtractionResult,
): void {
  forEachLine(lines, (line, lineNumber) => {
    const importMatch = line.match(/^\s*import\s+['"]([^'"]+)['"]/);
    if (importMatch?.[1]) addDependency(result, filePath, importMatch[1]);

    const classMatch = line.match(/^\s*(?:abstract\s+)?class\s+([A-Za-z_][\w]*)/);
    if (classMatch?.[1]) addSymbol(result, filePath, classMatch[1], 'class', lineNumber, true);

    const functionMatch = line.match(/^\s*(?:[A-Za-z_<>,?]+\s+)+([A-Za-z_][\w]*)\s*\([^;]*\)\s*(?:async\s*)?\{/);
    if (functionMatch?.[1] && !['if', 'for', 'while', 'switch'].includes(functionMatch[1])) {
      addSymbol(result, filePath, functionMatch[1], 'function', lineNumber, true);
    }
  });
}

function collectElixir(
  lines: string[],
  filePath: string,
  result: SymbolExtractionResult,
): void {
  forEachLine(lines, (line, lineNumber) => {
    const moduleMatch = line.match(/^\s*defmodule\s+([A-Z][\w.]+)/);
    if (moduleMatch?.[1]) addSymbol(result, filePath, moduleMatch[1], 'class', lineNumber, true);

    const functionMatch = line.match(/^\s*defp?\s+([a-z_][\w!?]*)/);
    if (functionMatch?.[1]) addSymbol(result, filePath, functionMatch[1], 'function', lineNumber, true);
  });
}

function collectScala(
  lines: string[],
  filePath: string,
  result: SymbolExtractionResult,
): void {
  forEachLine(lines, (line, lineNumber) => {
    const importMatch = line.match(/^\s*import\s+(.+)/);
    if (importMatch?.[1]) addDependency(result, filePath, importMatch[1].trim());

    const typeMatch = line.match(/^\s*(?:case\s+)?(class|object|trait|enum)\s+([A-Za-z_][\w]*)/);
    if (typeMatch?.[2]) {
      addSymbol(
        result,
        filePath,
        typeMatch[2],
        typeMatch[1] === 'trait' ? 'interface' : 'class',
        lineNumber,
        true,
      );
    }

    const functionMatch = line.match(/^\s*def\s+([A-Za-z_][\w]*)/);
    if (functionMatch?.[1]) addSymbol(result, filePath, functionMatch[1], 'function', lineNumber, true);
  });
}

function collectR(
  lines: string[],
  filePath: string,
  result: SymbolExtractionResult,
): void {
  forEachLine(lines, (line, lineNumber) => {
    const libraryMatch = line.match(/^\s*(?:library|require)\s*\(\s*([A-Za-z.][\w.]*)/);
    if (libraryMatch?.[1]) addDependency(result, filePath, libraryMatch[1]);

    const functionMatch = line.match(/^\s*([A-Za-z.][\w.]*)\s*(?:<-|=)\s*function\s*\(/);
    if (functionMatch?.[1]) addSymbol(result, filePath, functionMatch[1], 'function', lineNumber, true);
  });
}

function collectConfig(
  lines: string[],
  filePath: string,
  result: SymbolExtractionResult,
  language: BroadLanguage,
): void {
  forEachLine(lines, (line, lineNumber) => {
    if (language === 'dockerfile') {
      const stageMatch = line.match(/^\s*FROM\s+\S+(?:\s+AS\s+([A-Za-z_][\w-]*))?/i);
      if (stageMatch?.[1]) addSymbol(result, filePath, stageMatch[1], 'type', lineNumber, true);
      return;
    }

    const keyMatch =
      language === 'json'
        ? line.match(/^\s*"([^"]+)"\s*:/)
        : line.match(/^\s*([A-Za-z_][\w.-]*)\s*[:=]/);
    if (keyMatch?.[1]) {
      addSymbol(result, filePath, keyMatch[1], 'type', lineNumber);
    }
  });
}

function collectMarkdown(
  lines: string[],
  filePath: string,
  result: SymbolExtractionResult,
): void {
  forEachLine(lines, (line, lineNumber) => {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch?.[2]) {
      addSymbol(result, filePath, headingMatch[2].trim(), 'type', lineNumber);
    }
  });
}

function collectMarkup(
  lines: string[],
  filePath: string,
  result: SymbolExtractionResult,
): void {
  forEachLine(lines, (line, lineNumber) => {
    for (const idMatch of line.matchAll(/\bid=["']([^"']+)["']/g)) {
      if (idMatch[1]) addSymbol(result, filePath, `#${idMatch[1]}`, 'type', lineNumber);
    }
    for (const classMatch of line.matchAll(/\bclass=["']([^"']+)["']/g)) {
      for (const className of classMatch[1]?.split(/\s+/) ?? []) {
        if (className) addSymbol(result, filePath, `.${className}`, 'type', lineNumber);
      }
    }
  });
}

function collectStylesheet(
  lines: string[],
  filePath: string,
  result: SymbolExtractionResult,
): void {
  forEachLine(lines, (line, lineNumber) => {
    const importMatch = line.match(/^\s*@(import|use|forward)\s+["']([^"']+)["']/);
    if (importMatch?.[2]) addDependency(result, filePath, importMatch[2]);

    for (const variableMatch of line.matchAll(/(--[A-Za-z_][\w-]*|\$[A-Za-z_][\w-]*)\s*:/g)) {
      if (variableMatch[1]) addSymbol(result, filePath, variableMatch[1], 'type', lineNumber);
    }

    const mixinMatch = line.match(/^\s*@(mixin|function|keyframes)\s+([A-Za-z_][\w-]*)/);
    if (mixinMatch?.[2]) {
      addSymbol(
        result,
        filePath,
        mixinMatch[2],
        mixinMatch[1] === 'function' ? 'function' : 'type',
        lineNumber,
      );
    }

    for (const selectorMatch of line.matchAll(/([.#][A-Za-z_][\w-]*)/g)) {
      if (selectorMatch[1]) addSymbol(result, filePath, selectorMatch[1], 'type', lineNumber);
    }
  });
}

function forEachLine(
  lines: string[],
  callback: (line: string, lineNumber: number) => void,
): void {
  lines.forEach((line, index) => callback(line, index + 1));
}
