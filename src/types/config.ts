export interface KGraphConfig {
  include: string[];
  exclude: string[];
  languages: {
    precise: string[];
  };
  maxContextItems: number;
  domainHints: Record<string, DomainHint>;
}

export interface DomainHint {
  paths?: string[];
  tags?: string[];
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
