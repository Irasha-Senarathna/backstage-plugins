import Box from '@material-ui/core/Box';
import CircularProgress from '@material-ui/core/CircularProgress';
import Link from '@material-ui/core/Link';
import Typography from '@material-ui/core/Typography';
import { useTheme } from '@material-ui/core/styles';
import { InfoCard } from '@backstage/core-components';
import { catalogProgress } from '../../breakdown';
import type { CatalogScores } from './useScoreResults';

const GAUGE_SIZE = 96;

interface ScoreSummaryCardProps {
  results?: CatalogScores;
  loading: boolean;
  error?: Error;
  onViewBreakdown: () => void;
}

/**
 * Pass-rate gauge across every scored entity's published checks: a literal
 * "checks passed / checks total" percentage, not a weighted score. Each
 * entity's own results count once.
 */
export function ScoreSummaryCard({
  results,
  loading,
  error,
  onViewBreakdown,
}: ScoreSummaryCardProps) {
  const theme = useTheme();

  const value = results && catalogProgress(results.entities);
  const percentage = loading || !value ? 0 : value.percentage;

  return (
    <InfoCard>
      <Box display="flex" alignItems="center">
        <Box position="relative" display="inline-flex" mr={3}>
          <CircularProgress
            variant="determinate"
            value={percentage}
            size={GAUGE_SIZE}
            thickness={4}
            style={{
              color: theme.palette.status?.ok ?? theme.palette.primary.main,
            }}
          />
          <Box
            position="absolute"
            top={0}
            left={0}
            bottom={0}
            right={0}
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <Typography
              component="div"
              style={{ fontSize: GAUGE_SIZE / 4, fontWeight: 600 }}
            >
              {loading ? '—' : `${percentage}%`}
            </Typography>
          </Box>
        </Box>
        <Box>
          <Typography variant="h6">
            Checks passing across the catalog
          </Typography>
          {!loading && error && (
            <Typography variant="body2" color="error">
              {error.message}
            </Typography>
          )}
          {!loading && value && (
            <Typography variant="body2" color="textSecondary">
              {value.passedChecks}/{value.totalChecks} checks passing across{' '}
              {value.scoredEntities} entit
              {value.scoredEntities === 1 ? 'y' : 'ies'}
            </Typography>
          )}
          <Link component="button" variant="body2" onClick={onViewBreakdown}>
            View full breakdown &gt;
          </Link>
        </Box>
      </Box>
    </InfoCard>
  );
}
