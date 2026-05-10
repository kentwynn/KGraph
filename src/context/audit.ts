import type { FileMap, SymbolMap } from '../types/maps.js';

export interface AuditFinding {
  filePath: string;
  matchedSymbols: string[];
  reasons: string[];
}

export interface AuditCategory {
  name: string;
  description: string;
  findings: AuditFinding[];
}

export interface AuditResponse {
  categories: AuditCategory[];
  totalFlaggedFiles: number;
  totalFlaggedSymbols: number;
}

interface CategoryDefinition {
  name: string;
  description: string;
  keywords: string[];
}

const AUDIT_CATEGORIES: CategoryDefinition[] = [
  {
    name: 'Authentication & Authorization',
    description: 'Login flows, tokens, sessions, and access control',
    keywords: [
      'auth', 'login', 'logout', 'token', 'jwt', 'oauth', 'session',
      'password', 'credential', 'permission', 'role', 'acl', 'authorize',
      'authenticate', 'identity', 'bearer', 'refresh',
    ],
  },
  {
    name: 'Input Handling',
    description: 'Routes, handlers, and user input entry points',
    keywords: [
      'route', 'handler', 'endpoint', 'controller', 'middleware', 'request',
      'param', 'upload', 'webhook', 'validate', 'sanitize',
    ],
  },
  {
    name: 'Cryptography',
    description: 'Hashing, encryption, signing, and key management',
    keywords: [
      'crypto', 'hash', 'encrypt', 'decrypt', 'cipher', 'sign', 'verify',
      'salt', 'bcrypt', 'hmac', 'digest', 'pbkdf',
    ],
  },
  {
    name: 'Data Access',
    description: 'Database queries, ORM calls, and external storage',
    keywords: [
      'sql', 'database', 'mongo', 'postgres', 'mysql', 'redis',
      'orm', 'repository', 'migration', 'schema',
    ],
  },
  {
    name: 'External Connections',
    description: 'HTTP clients, sockets, and third-party service calls',
    keywords: ['http', 'fetch', 'axios', 'socket', 'websocket', 'client', 'webhook'],
  },
  {
    name: 'Dangerous Patterns',
    description: 'Code execution, deserialization, and shell access',
    keywords: [
      'eval', 'exec', 'spawn', 'shell', 'deserialize', 'subprocess',
      'child_process', 'pickle', 'marshal', 'unserialize',
    ],
  },
];

const MAX_FINDINGS_PER_CATEGORY = 20;

export function analyzeAudit(maps: { fileMap: FileMap; symbolMap: SymbolMap }): AuditResponse {
  const allFlaggedFiles = new Set<string>();
  const allFlaggedSymbols = new Set<string>();
  const categories: AuditCategory[] = [];

  for (const def of AUDIT_CATEGORIES) {
    const findingMap = new Map<string, { reasons: Set<string>; symbols: Set<string> }>();

    const ensure = (path: string) => {
      if (!findingMap.has(path)) findingMap.set(path, { reasons: new Set(), symbols: new Set() });
      return findingMap.get(path)!;
    };

    for (const file of maps.fileMap.files) {
      const tokens = tokenizePath(file.path);
      for (const kw of def.keywords) {
        if (tokens.includes(kw)) {
          ensure(file.path).reasons.add(`path contains "${kw}"`);
        }
      }
    }

    for (const symbol of maps.symbolMap.symbols) {
      const tokens = tokenizeIdentifier(symbol.name);
      for (const kw of def.keywords) {
        if (tokens.includes(kw)) {
          const entry = ensure(symbol.filePath);
          entry.symbols.add(symbol.name);
          entry.reasons.add(`symbol "${symbol.name}" matches "${kw}"`);
        }
      }
    }

    if (findingMap.size === 0) continue;

    const findings: AuditFinding[] = [...findingMap.entries()]
      .map(([filePath, data]) => ({
        filePath,
        matchedSymbols: [...data.symbols],
        reasons: [...data.reasons],
      }))
      .sort((a, b) => b.matchedSymbols.length - a.matchedSymbols.length)
      .slice(0, MAX_FINDINGS_PER_CATEGORY);

    for (const finding of findings) {
      allFlaggedFiles.add(finding.filePath);
      for (const sym of finding.matchedSymbols) allFlaggedSymbols.add(sym);
    }

    categories.push({ name: def.name, description: def.description, findings });
  }

  return {
    categories,
    totalFlaggedFiles: allFlaggedFiles.size,
    totalFlaggedSymbols: allFlaggedSymbols.size,
  };
}

function tokenizePath(filePath: string): string[] {
  return filePath.toLowerCase().split(/[/\\._-]+/).filter(Boolean);
}

function tokenizeIdentifier(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}
