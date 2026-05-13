export interface KGraphConfig {
  include: string[];
  exclude: string[];
  languages: {
    precise: string[];
  };
  maxContextItems: number;
  domainHints: Record<string, DomainHint>;
  integrations: IntegrationConfig[];
}

export interface DomainHint {
  paths?: string[];
  tags?: string[];
}

export type IntegrationName =
  | 'claude-code'
  | 'cline'
  | 'codex'
  | 'copilot'
  | 'cursor'
  | 'gemini'
  | 'windsurf';

export type IntegrationMode = 'smart' | 'always' | 'manual' | 'off';

export interface IntegrationConfig {
  name: IntegrationName;
  enabled: boolean;
  mode: IntegrationMode;
  targetPath: string;
}

export interface KGraphWorkspace {
  rootPath: string;
  kgraphPath: string;
  configPath: string;
  mapPath: string;
  cognitionPath: string;
  domainsPath: string;
  inboxPath: string;
  processedInteractionsPath: string;
  contextPath: string;
  sessionsPath: string;
  knowledgePath: string;
}
