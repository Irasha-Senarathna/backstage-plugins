import Box from '@material-ui/core/Box';
import LinearProgress from '@material-ui/core/LinearProgress';
import Typography from '@material-ui/core/Typography';
import { InfoCard, Progress } from '@backstage/core-components';
import { useEntity } from '@backstage/plugin-catalog-react';
import { inSentence, useKindLabel } from '../../kinds';
import { LoadErrorState } from '../LoadErrorState';
import { TierChip } from '../TierChip';
import { useEntityScorecard } from '../useEntityScorecard';
import { useEntityTabLink } from '../useEntityTabLink';

export interface EntityScorecardSummaryCardProps {
  title: string;
}

/**
 * An entity's tier and pass rate per category, linking to its scorecard
 * tab. For a System, Domain or Group, it combines the entity's own checks
 * with those of everything that belongs to it.
 */
export function EntityScorecardSummaryCard({
  title,
}: EntityScorecardSummaryCardProps) {
  const { entity } = useEntity();
  const { value, loading, error, retry } = useEntityScorecard(entity);
  const link = useEntityTabLink()(entity);
  const label = inSentence(useKindLabel()(entity.kind));

  let content;
  if (loading) {
    content = <Progress />;
  } else if (error) {
    content = (
      <LoadErrorState
        title="Couldn't load scores"
        error={error}
        onRetry={retry}
      />
    );
  } else if (!value || !value.root.scored) {
    content = (
      <Typography variant="body2" color="textSecondary">
        No checks apply yet.
      </Typography>
    );
  } else {
    const { rank, progress, descendantCount } = value.root;
    const { categories } = value;
    content = (
      <Box display="flex" flexDirection="column" style={{ gap: 12 }}>
        <Box display="flex" alignItems="center" style={{ gap: 8 }}>
          <TierChip rank={rank} emphasis="filled" />
          <Typography variant="body2">
            {progress.passedChecks}/{progress.totalChecks} checks passing (
            {progress.percentage}%)
          </Typography>
        </Box>
        {descendantCount > 0 && (
          <Typography variant="caption" color="textSecondary">
            Combined from this {label} and the{' '}
            {descendantCount === 1 ? 'entity' : `${descendantCount} entities`}{' '}
            in it.
          </Typography>
        )}
        {categories.map(category => (
          <Box key={category.category}>
            <Box display="flex" justifyContent="space-between">
              <Typography variant="body2">{category.category}</Typography>
              <Typography variant="body2" color="textSecondary">
                {category.passedChecks}/{category.totalChecks}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={category.percentage}
              aria-label={`${category.category}: ${category.percentage}% of checks passing`}
            />
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <InfoCard title={title} deepLink={{ title: 'View details', link }}>
      {content}
    </InfoCard>
  );
}
