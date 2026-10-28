import type { MaturityCheckResult } from '@backstage-community/plugin-tech-insights-maturity-common';
import { progressByCategory, progressOf, rankOf } from './scoring';

function result(
  rank: number,
  passed: boolean,
  category = 'Security',
): MaturityCheckResult {
  return {
    result: passed,
    facts: {},
    check: {
      id: `${category}-${rank}-${passed}`,
      type: 'json-rules-engine',
      name: 'check',
      description: '',
      factIds: [],
      metadata: { rank, category, solution: '', exp: 0 },
    },
  } as MaturityCheckResult;
}

describe('rankOf', () => {
  it('is the highest tier when every check passes', () => {
    expect(rankOf([result(1, true), result(3, true)])).toBe(3);
  });

  it('stops just below the lowest failing tier', () => {
    expect(rankOf([result(1, true), result(2, false), result(3, true)])).toBe(
      1,
    );
    expect(rankOf([result(1, false), result(3, true)])).toBe(0);
  });

  it('is Stone with no checks', () => {
    expect(rankOf([])).toBe(0);
  });
});

describe('progress', () => {
  it('counts passing checks overall and per category', () => {
    const checks = [
      result(1, true, 'Security'),
      result(2, false, 'Security'),
      result(1, true, 'Documentation'),
    ];
    expect(progressOf(checks)).toEqual({
      passedChecks: 2,
      totalChecks: 3,
      percentage: 67,
    });
    expect(progressByCategory(checks)).toEqual([
      {
        category: 'Documentation',
        passedChecks: 1,
        totalChecks: 1,
        percentage: 100,
      },
      { category: 'Security', passedChecks: 1, totalChecks: 2, percentage: 50 },
    ]);
  });
});
