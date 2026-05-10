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
  | "claude-code"
  | "cline"
  | "codex"
  | "copilot"
  | "cursor"
  | "gemini"
  | "windsurf";

export interface IntegrationConfig {
  name: IntegrationName;
  enabled: boolean;
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
}
