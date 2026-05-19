import {
  emptyExtractionResult,
  ExtractionContext,
} from './extraction-context.js';
import type { SymbolExtractionResult } from './ts-symbol-extractor.js';

type SqlObjectKind = 'table' | 'view' | 'index' | 'function' | 'procedure' | 'trigger' | 'type';

export async function extractSqlSymbols(
  sourceText: string,
  filePath: string,
): Promise<SymbolExtractionResult> {
  if (!sourceText.trim()) {
    return emptyExtractionResult();
  }

  const context = new ExtractionContext(filePath);
  const withoutComments = stripLineComments(sourceText);
  const statements = splitStatements(withoutComments);

  for (const statement of statements) {
    collectCreateStatement(statement, context);
    collectAlterStatement(statement, context);
    collectQueryReferences(statement, context);
  }

  return context.toResult();
}

function collectCreateStatement(
  statement: SqlStatement,
  context: ExtractionContext,
): void {
  const normalized = compact(statement.text);
  const createMatch = normalized.match(
    /^CREATE\s+(?:OR\s+REPLACE\s+)?(?:(?:UNIQUE|MATERIALIZED|TEMP|TEMPORARY)\s+)*(TABLE|VIEW|INDEX|FUNCTION|PROCEDURE|TRIGGER|TYPE)\s+(?:IF\s+NOT\s+EXISTS\s+)?("?[\w.]+"?)/i,
  );
  if (!createMatch?.[1] || !createMatch[2]) {
    return;
  }

  const objectKind = createMatch[1].toLowerCase() as SqlObjectKind;
  const name = normalizeSqlIdentifier(createMatch[2]);
  const symbol = context.addSymbol({
    name,
    kind:
      objectKind === 'function' || objectKind === 'procedure'
        ? 'function'
        : 'type',
    startLine: statement.startLine,
    endLine: statement.endLine,
    exported: true,
    parentName: objectKind,
  });

  const tableForTrigger = normalized.match(/\bON\s+("?[\w.]+"?)/i)?.[1];
  if (objectKind === 'trigger' && tableForTrigger) {
    context.relationships.push({
      sourceType: 'symbol',
      sourceId: symbol.id,
      targetType: 'symbol',
      targetId: normalizeSqlIdentifier(tableForTrigger),
      relationshipType: 'mentions',
      confidence: 'high',
    });
  }

  for (const referencedTable of referencedTables(normalized)) {
    context.relationships.push({
      sourceType: 'symbol',
      sourceId: symbol.id,
      targetType: 'symbol',
      targetId: referencedTable,
      relationshipType: 'mentions',
      confidence: 'medium',
    });
  }
}

function collectAlterStatement(
  statement: SqlStatement,
  context: ExtractionContext,
): void {
  const normalized = compact(statement.text);
  const alterMatch = normalized.match(
    /^ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?("?[\w.]+"?)/i,
  );
  if (!alterMatch?.[1]) {
    return;
  }

  const tableName = normalizeSqlIdentifier(alterMatch[1]);
  const symbol = context.addSymbol({
    name: `alter ${tableName}`,
    kind: 'type',
    startLine: statement.startLine,
    endLine: statement.endLine,
    exported: true,
    parentName: 'table',
  });
  context.relationships.push({
    sourceType: 'symbol',
    sourceId: symbol.id,
    targetType: 'symbol',
    targetId: tableName,
    relationshipType: 'mentions',
    confidence: 'high',
  });

  for (const referencedTable of referencedTables(normalized)) {
    context.relationships.push({
      sourceType: 'symbol',
      sourceId: symbol.id,
      targetType: 'symbol',
      targetId: referencedTable,
      relationshipType: 'mentions',
      confidence: 'medium',
    });
  }
}

function collectQueryReferences(
  statement: SqlStatement,
  context: ExtractionContext,
): void {
  const normalized = compact(statement.text);
  const queryMatch = normalized.match(/^(SELECT|INSERT|UPDATE|DELETE)\b/i);
  if (!queryMatch?.[1]) {
    return;
  }

  const symbol = context.addSymbol({
    name: `${queryMatch[1].toLowerCase()} statement ${statement.startLine}`,
    kind: 'type',
    startLine: statement.startLine,
    endLine: statement.endLine,
  });
  for (const table of referencedTables(normalized)) {
    context.relationships.push({
      sourceType: 'symbol',
      sourceId: symbol.id,
      targetType: 'symbol',
      targetId: table,
      relationshipType: 'mentions',
      confidence: 'medium',
    });
  }
}

interface SqlStatement {
  text: string;
  startLine: number;
  endLine: number;
}

function stripLineComments(sourceText: string): string {
  return sourceText
    .split(/\r?\n/)
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');
}

function splitStatements(sourceText: string): SqlStatement[] {
  const statements: SqlStatement[] = [];
  let current = '';
  let startLine = 1;
  let lineNumber = 1;

  for (const line of sourceText.split(/\r?\n/)) {
    if (!current.trim()) {
      startLine = lineNumber;
    }
    current += `${line}\n`;
    if (line.includes(';')) {
      statements.push({
        text: current,
        startLine,
        endLine: lineNumber,
      });
      current = '';
    }
    lineNumber += 1;
  }

  if (current.trim()) {
    statements.push({ text: current, startLine, endLine: lineNumber - 1 });
  }

  return statements;
}

function compact(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeSqlIdentifier(value: string): string {
  return value.replace(/^"+|"+$/g, '').replace(/[;,)]$/, '');
}

function referencedTables(statement: string): string[] {
  const names = new Set<string>();
  const patterns = [
    /\bREFERENCES\s+("?[\w.]+"?)/gi,
    /\bFROM\s+("?[\w.]+"?)/gi,
    /\bJOIN\s+("?[\w.]+"?)/gi,
    /\bUPDATE\s+("?[\w.]+"?)/gi,
    /\bINTO\s+("?[\w.]+"?)/gi,
  ];

  for (const pattern of patterns) {
    for (const match of statement.matchAll(pattern)) {
      if (match[1]) names.add(normalizeSqlIdentifier(match[1]));
    }
  }

  return [...names];
}
