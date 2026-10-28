import { useMemo } from 'react';
import Accordion from '@material-ui/core/Accordion';
import AccordionSummary from '@material-ui/core/AccordionSummary';
import AccordionDetails from '@material-ui/core/AccordionDetails';
import Box from '@material-ui/core/Box';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import { EmptyState, InfoCard, Progress } from '@backstage/core-components';
import { useEntity } from '@backstage/plugin-catalog-react';
import type { MaturityCheckResult } from '@backstage-community/plugin-tech-insights-maturity-common';
import { inSentence, useKindLabel } from '../../kinds';
import { isRollupKind } from '../../rollup';
import { UNCATEGORIZED, rankOf } from '../../scoring';
import { LoadErrorState } from '../LoadErrorState';
import { RollupTable } from '../RollupTable';
import { NotScoredChip, TierChip } from '../TierChip';
import {
  useEntityScorecard,
  useFactCollectionTimes,
} from '../useEntityScorecard';
import { CheckResultItem } from './CheckResultItem';

/**
 * Read-only scorecard for one entity: its tier, then its check results
 * grouped by category. Check management lives on the scorecards page. A
 * System, Domain or Group also lists the entities that belong to it, each
 * expanding to its own, and its tier combines them all.
 *
 * A category with a check failing at or below the next tier after the one
 * shown at the top sorts first and starts expanded, so the list explains
 * that tier: a category showing "1/2" could be a Gold aspiration or the
 * Bronze check blocking the entity, and the sort order and per-check tier
 * chip tell them apart. When the entities in a System, Domain or Group hold
 * its tier below what its own checks reach, the header says so and the
 * rollup list beneath shows which.
 */
export function EntityScorecardContent() {
  const { entity } = useEntity();
  const { value, loading, error, retry } = useEntityScorecard(entity);
  const ownChecks = value?.root.ownChecks;
  const collectedAt = useFactCollectionTimes(entity, ownChecks);
  const label = inSentence(useKindLabel()(entity.kind));
  const rollup = isRollupKind(entity.kind);

  const root = value?.root;
  const ownRank = ownChecks ? rankOf(ownChecks) : undefined;
  const shownRank = root?.scored ? root.rank : ownRank;

  const categoryGroups = useMemo(() => {
    if (!ownChecks || shownRank === undefined) return [];
    const groups = new Map<string, MaturityCheckResult[]>();
    ownChecks.forEach(c => {
      const category = c.check.metadata?.category || UNCATEGORIZED;
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category)!.push(c);
    });
    const maxRank = ownChecks.reduce(
      (max, c) => Math.max(max, c.check.metadata?.rank ?? 0),
      0,
    );
    const nextRank = shownRank >= maxRank ? shownRank : shownRank + 1;
    return Array.from(groups.entries())
      .map(([category, checks]) => ({
        category,
        checks,
        hasBlockingFailure: checks.some(
          c => !c.result && c.check.metadata?.rank <= nextRank,
        ),
      }))
      .sort(
        (a, b) => Number(b.hasBlockingFailure) - Number(a.hasBlockingFailure),
      );
  }, [ownChecks, shownRank]);

  const heldByChildren = Boolean(
    rollup &&
      root?.scored &&
      ownChecks &&
      ownChecks.length > 0 &&
      ownRank !== undefined &&
      ownRank > root.rank,
  );
  const ready = !loading && !error && root;

  return (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <Box display="flex" alignItems="center">
          <Typography variant="h6" style={{ marginRight: 8 }}>
            Tier:
          </Typography>
          {root &&
            (root.scored ? (
              <TierChip rank={root.rank} emphasis="filled" />
            ) : (
              <NotScoredChip />
            ))}
          {root?.scored && root.descendantCount > 0 && (
            <Box ml={1}>
              <Typography variant="body2" color="textSecondary">
                {root.progress.passedChecks}/{root.progress.totalChecks} checks
                passing, combined from this {label} and the{' '}
                {root.descendantCount === 1
                  ? 'entity'
                  : `${root.descendantCount} entities`}{' '}
                in it
              </Typography>
            </Box>
          )}
          {heldByChildren && ownRank !== undefined && (
            <Box ml={1} display="flex" alignItems="center" style={{ gap: 4 }}>
              <Typography variant="body2" color="textSecondary">
                Its own checks reach
              </Typography>
              <TierChip rank={ownRank} />
              <Typography variant="body2" color="textSecondary">
                but entities in it hold the tier lower.
              </Typography>
            </Box>
          )}
        </Box>
      </Grid>

      {loading && (
        <Grid item xs={12}>
          <Progress />
        </Grid>
      )}
      {!!error && (
        <Grid item xs={12}>
          <LoadErrorState
            title="Couldn't load check results"
            error={error}
            onRetry={retry}
          />
        </Grid>
      )}
      {ready && !root.scored && (
        <Grid item xs={12}>
          <EmptyState
            missing="data"
            title="No checks apply yet"
            description={
              rollup
                ? `Published checks that match this ${label}, or the entities in it, appear here once their facts have been collected.`
                : 'Published checks whose filter matches this entity, and whose facts have been collected for it, appear here.'
            }
          />
        </Grid>
      )}
      {ready && categoryGroups.length > 0 && (
        <Grid item xs={12}>
          <InfoCard title={rollup ? `Checks on this ${label}` : 'Checks'}>
            {categoryGroups.map(({ category, checks, hasBlockingFailure }) => (
              <Accordion key={category} defaultExpanded={hasBlockingFailure}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>
                    {category} ({checks.filter(c => c.result).length}/
                    {checks.length})
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    {checks.map(c => (
                      <Grid item xs={12} key={c.check.id}>
                        <CheckResultItem result={c} collectedAt={collectedAt} />
                      </Grid>
                    ))}
                  </Grid>
                </AccordionDetails>
              </Accordion>
            ))}
          </InfoCard>
        </Grid>
      )}
      {ready && root.scored && root.children.length > 0 && (
        <Grid item xs={12}>
          <InfoCard
            title={`In this ${label}`}
            subheader="Each entity's tier combines its own checks with those of the entities in it. Expand a row to see them."
          >
            <RollupTable nodes={root.children} />
          </InfoCard>
        </Grid>
      )}
    </Grid>
  );
}
