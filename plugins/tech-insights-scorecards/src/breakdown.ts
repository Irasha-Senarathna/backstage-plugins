import {
  Rank,
  type MaturityCheckResult,
} from '@backstage-community/plugin-tech-insights-maturity-common';
import type { RollupNode } from './rollup';
import { progressOf, type CheckProgress } from './scoring';

/**
 * Checks passing across the catalog. Each entity's own results count once:
 * a node's combined `checks` would count a component again in its System and
 * its Domain.
 */
export function catalogProgress(nodes: RollupNode[]): CheckProgress & {
  scoredEntities: number;
} {
  return {
    ...progressOf(nodes.flatMap(node => node.ownChecks)),
    scoredEntities: nodes.filter(node => node.ownChecks.length > 0).length,
  };
}

export type TierCounts = Record<Rank, number>;

/** How many scored entities reached each tier. Unscored ones aren't counted. */
export function tierCounts(nodes: RollupNode[]): TierCounts {
  const counts: TierCounts = {
    [Rank.Stone]: 0,
    [Rank.Bronze]: 0,
    [Rank.Silver]: 0,
    [Rank.Gold]: 0,
  };
  nodes.filter(node => node.scored).forEach(node => (counts[node.rank] += 1));
  return counts;
}

export interface KindSummary {
  kind: string;
  entities: number;
  notScored: number;
  tiers: TierCounts;
}

export function kindSummaries(
  nodes: RollupNode[],
  kinds: string[],
): KindSummary[] {
  return kinds.map(kind => {
    const ofKind = nodes.filter(node => node.entity.kind === kind);
    return {
      kind,
      entities: ofKind.length,
      notScored: ofKind.filter(node => !node.scored).length,
      tiers: tierCounts(ofKind),
    };
  });
}

export interface CheckSummary {
  check: MaturityCheckResult['check'];
  passing: RollupNode[];
  failing: RollupNode[];
}

/**
 * Each check with the entities it passed and failed on, most failures
 * first. Only entities a check ran against are counted.
 */
export function checkSummaries(nodes: RollupNode[]): CheckSummary[] {
  const byId = new Map<string, CheckSummary>();
  nodes.forEach(node =>
    node.ownChecks.forEach(result => {
      let summary = byId.get(result.check.id);
      if (!summary) {
        summary = { check: result.check, passing: [], failing: [] };
        byId.set(result.check.id, summary);
      }
      (result.result ? summary.passing : summary.failing).push(node);
    }),
  );
  return Array.from(byId.values()).sort(
    (a, b) =>
      b.failing.length - a.failing.length ||
      a.check.name.localeCompare(b.check.name),
  );
}
