import path from "node:path";
import ts from "typescript";
import type { CodeSymbol, Dependency, Relationship } from "../types/maps.js";

export interface SymbolExtractionResult {
  symbols: CodeSymbol[];
  dependencies: Dependency[];
  relationships: Relationship[];
  warnings: string[];
}

export function extractTsSymbols(sourceText: string, filePath: string): SymbolExtractionResult {
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);
  const symbols: CodeSymbol[] = [];
  const dependencies: Dependency[] = [];
  const relationships: Relationship[] = [];
  const warnings: string[] = [];

  const addSymbol = (
    name: string,
    kind: CodeSymbol["kind"],
    node: ts.Node,
    exported = false,
    parentName?: string
  ): void => {
    const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
    const id = [filePath, kind, parentName, name, start.line + 1, end.line + 1].filter(Boolean).join("#");
    symbols.push({
      id,
      name,
      kind,
      filePath,
      startLine: start.line + 1,
      endLine: end.line + 1,
      exported,
      parentName
    });
    relationships.push({
      sourceType: "file",
      sourceId: filePath,
      targetType: "symbol",
      targetId: id,
      relationshipType: "contains",
      confidence: "high"
    });
  };

  const visit = (node: ts.Node, parentName?: string): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const specifier = node.moduleSpecifier.text;
      const dependency: Dependency = {
        fromFile: filePath,
        specifier,
        resolvedFile: resolveLocalImport(filePath, specifier),
        kind: specifier.startsWith(".") ? "local" : "package"
      };
      dependencies.push(dependency);
      addSymbol(specifier, "import", node);
      relationships.push({
        sourceType: "file",
        sourceId: filePath,
        targetType: dependency.kind === "local" ? "file" : "package",
        targetId: dependency.resolvedFile ?? specifier,
        relationshipType: "import",
        confidence: dependency.resolvedFile ? "high" : "medium"
      });
    }

    if (ts.isExportDeclaration(node)) {
      const name = node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : "export";
      addSymbol(name, "export", node, true);
    }

    if (ts.isFunctionDeclaration(node) && node.name) {
      addSymbol(node.name.text, "function", node, isExported(node), parentName);
    }

    if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.initializer &&
          (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer))
        ) {
          addSymbol(declaration.name.text, "function", declaration, isExported(node), parentName);
        }
      }
    }

    if (ts.isClassDeclaration(node) && node.name) {
      addSymbol(node.name.text, "class", node, isExported(node), parentName);
      node.members.forEach((member) => {
        if (ts.isMethodDeclaration(member) && member.name && ts.isIdentifier(member.name)) {
          addSymbol(member.name.text, "method", member, false, node.name?.text);
        }
      });
    }

    if (ts.isInterfaceDeclaration(node)) {
      addSymbol(node.name.text, "interface", node, isExported(node), parentName);
    }

    if (ts.isTypeAliasDeclaration(node)) {
      addSymbol(node.name.text, "type", node, isExported(node), parentName);
    }

    ts.forEachChild(node, (child) => visit(child, parentName));
  };

  try {
    visit(sourceFile);
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : String(error));
  }

  return { symbols, dependencies, relationships, warnings };
}

function isExported(node: ts.Node): boolean {
  return ts.canHaveModifiers(node) && Boolean(ts.getModifiers(node)?.some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword));
}

function resolveLocalImport(fromFile: string, specifier: string): string | undefined {
  if (!specifier.startsWith(".")) {
    return undefined;
  }

  const joined = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), specifier));
  const ext = path.posix.extname(joined);
  if (ext) {
    return joined;
  }
  return `${joined}.ts`;
}
