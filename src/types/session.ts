import type { IntegrationName } from './config.js';

export type SessionAgent = IntegrationName;
export type SessionEventType = 'start' | 'read' | 'write' | 'end';
export type SessionCaptureSource = 'automatic' | 'agent-reported' | 'manual';

export interface SessionEvent {
  id: string;
  agent: SessionAgent;
  type: SessionEventType;
  path?: string;
  tokenEstimate?: number;
  repeated?: boolean;
  captureSource: SessionCaptureSource;
  timestamp: string;
}

export interface AgentSession {
  agent: SessionAgent;
  sessionId: string;
  startedAt: string;
  lastEventAt: string;
}

export interface SessionState {
  active: Record<string, AgentSession>;
  events: SessionEvent[];
  updatedAt: string;
}

export interface SessionLedgerEntry {
  sessionId: string;
  agent: SessionAgent;
  startedAt: string;
  endedAt: string;
  readCount: number;
  writeCount: number;
  repeatedReadCount: number;
  estimatedReadTokens: number;
  estimatedRepeatedReadTokens: number;
}

export interface SessionReport {
  activeAgents: AgentSession[];
  readCount: number;
  writeCount: number;
  repeatedReadCount: number;
  estimatedReadTokens: number;
  estimatedRepeatedReadTokens: number;
  topRepeatedReads: Array<{ path: string; count: number; estimatedTokens: number }>;
  recentEvents: SessionEvent[];
  ledger: SessionLedgerEntry[];
}
