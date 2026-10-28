import {
  Rank,
  type MaturityCheckResult,
} from '@backstage-community/plugin-tech-insights-maturity-common';

export interface CheckProgress {
  passedChecks: number;
  totalChecks: number;
  percentage: number;
}

export function progressOf(checks: MaturityCheckResult[]): CheckProgress {
  const passedChecks = checks.filter(c => c.result).length;
  const totalChecks = checks.length;
  return {
    passedChecks,
    totalChecks,
    percentage:
      totalChecks === 0 ? 0 : Math.round((passedChecks / totalChecks) * 100),
  };
}

/**
 * The tier a set of check results reaches, computed the way the maturity
 * plugin's `ScoringDataFormatter` does: the highest tier any check carries,
 * lowered to just below the lowest tier with a failing check. That formatter
 * isn't exported, and combining several entities' results needs it.
 */
export function rankOf(checks: MaturityCheckResult[]): Rank {
  const maxRank = checks.reduce<Rank>(
    (max, c) => Math.max(max, c.check.metadata?.rank ?? Rank.Stone),
    Rank.Stone,
  );
  return checks.reduce<Rank>(
    (rank, c) =>
      !c.result && c.check.metadata?.rank <= rank
        ? c.check.metadata.rank - 1
        : rank,
    maxRank,
  );
}

export interface CategoryProgress extends CheckProgress {
  category: string;
}

export const UNCATEGORIZED = 'Uncategorized';

export function progressByCategory(
  checks: MaturityCheckResult[],
): CategoryProgress[] {
  const groups = new Map<string, MaturityCheckResult[]>();
  checks.forEach(c => {
    const category = c.check.metadata?.category || UNCATEGORIZED;
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category)!.push(c);
  });
  return Array.from(groups.entries())
    .map(([category, group]) => ({ category, ...progressOf(group) }))
    .sort((a, b) => a.category.localeCompare(b.category));
}
