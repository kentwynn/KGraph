import { estimateTokens } from '../session/token-estimator.js';
import type { ContextResponse } from '../types/cognition.js';
import type { ContextPack, ContextPackItem } from '../types/knowledge.js';

export function buildContextPack(
  response: ContextResponse,
  budget: number,
): ContextPack {
  const candidates: ContextPackItem[] = [
    ...response.relevantFiles.map((ranked) => ({
      kind: 'file' as const,
      id: ranked.item.path,
      title: ranked.item.path,
      tokenEstimate: ranked.item.tokenEstimate ?? 0,
      reasons: ranked.reasons,
      data: ranked.item,
    })),
    ...response.relevantSymbols.map((ranked) => ({
      kind: 'symbol' as const,
      id: ranked.item.id,
      title: ranked.item.name,
      tokenEstimate: 20,
      reasons: ranked.reasons,
      data: ranked.item,
    })),
    ...response.relevantCognition.map((ranked) => ({
      kind: 'atom' as const,
      id: ranked.item.id,
      title: ranked.item.title,
      tokenEstimate: estimateTokens(
        [ranked.item.title, ranked.item.summary ?? ''].join('\n'),
        `${ranked.item.id}.md`,
      ),
      reasons: ranked.reasons,
      data: ranked.item,
    })),
    ...response.relationships.map((relationship) => ({
      kind: 'relationship' as const,
      id: [
        relationship.sourceId,
        relationship.relationshipType,
        relationship.targetId,
      ].join(' -> '),
      title: `${relationship.sourceId} ${relationship.relationshipType} ${relationship.targetId}`,
      tokenEstimate: 16,
      reasons:
        response.relationshipExplanations?.find(
          (item) =>
            item.relationship.sourceId === relationship.sourceId &&
            item.relationship.targetId === relationship.targetId &&
            item.relationship.relationshipType === relationship.relationshipType,
        )?.reasons ?? ['related graph edge'],
      data: relationship,
    })),
    ...(response.gitChanges ?? []).map((change) => ({
      kind: 'git-change' as const,
      id: change.path,
      title: `${change.status}: ${change.path}`,
      tokenEstimate: 12,
      reasons: [change.reason],
      data: change,
    })),
  ];

  const items: ContextPackItem[] = [];
  const omitted: ContextPackItem[] = [];
  let usedTokens = 0;
  for (const candidate of candidates) {
    if (usedTokens + candidate.tokenEstimate <= budget) {
      items.push(candidate);
      usedTokens += candidate.tokenEstimate;
    } else {
      omitted.push(candidate);
    }
  }

  return {
    task: response.query,
    budget,
    usedTokens,
    items,
    omitted,
    warnings: response.warnings,
  };
}
