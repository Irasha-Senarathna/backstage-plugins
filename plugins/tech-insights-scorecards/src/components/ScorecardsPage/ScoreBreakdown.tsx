import { useEffect, useMemo, useRef, useState } from 'react';
import Box from '@material-ui/core/Box';
import Tab from '@material-ui/core/Tab';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Tabs from '@material-ui/core/Tabs';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import {
  EmptyState,
  InfoCard,
  Link,
  Progress,
} from '@backstage/core-components';
import { EntityDisplayName } from '@backstage/plugin-catalog-react';
import { Rank } from '@backstage-community/plugin-tech-insights-maturity-common';
import {
  checkSummaries,
  kindSummaries,
  tierCounts,
  type CheckSummary,
} from '../../breakdown';
import { useKindLabel } from '../../kinds';
import { UNCATEGORIZED } from '../../scoring';
import { FullPageView } from '../FullPageView';
import { LoadErrorState } from '../LoadErrorState';
import { RollupTable } from '../RollupTable';
import { NotScoredChip, TierChip } from '../TierChip';
import { useEntityTabLink } from '../useEntityTabLink';
import { useTierLabel } from '../useTierLabel';
import type { CatalogScores } from './useScoreResults';

const TIERS_HIGH_FIRST = [Rank.Gold, Rank.Silver, Rank.Bronze, Rank.Stone];

type View = 'kinds' | 'checks';

const useStyles = makeStyles({
  selectable: { cursor: 'pointer' },
});

interface ScoreBreakdownProps {
  title: string;
  results?: CatalogScores;
  loading: boolean;
  error?: Error;
  onBack: () => void;
  onRetry: () => void;
}

function CheckEntities({ summary }: { summary: CheckSummary }) {
  const kindLabel = useKindLabel();
  const tabLink = useEntityTabLink();
  const rows = [
    ...summary.failing.map(node => ({ node, passed: false })),
    ...summary.passing.map(node => ({ node, passed: true })),
  ];
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Name</TableCell>
          <TableCell>Kind</TableCell>
          <TableCell>This check</TableCell>
          <TableCell>Tier</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map(({ node, passed }) => (
          <TableRow key={node.ref} hover>
            <TableCell>
              <Link to={tabLink(node.entity)}>
                <EntityDisplayName entityRef={node.entity} />
              </Link>
            </TableCell>
            <TableCell>{kindLabel(node.entity.kind)}</TableCell>
            <TableCell>
              <Typography
                variant="body2"
                color={passed ? 'textPrimary' : 'error'}
              >
                {passed ? 'Passing' : 'Failing'}
              </Typography>
            </TableCell>
            <TableCell>
              {node.scored ? <TierChip rank={node.rank} /> : <NotScoredChip />}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/**
 * The catalog's scores by kind and by check. Selecting a kind or a check
 * lists the entities behind it. Tiers combine what belongs to an entity,
 * the same as on its tab; check counts use each entity's own results.
 */
export function ScoreBreakdown({
  title,
  results,
  loading,
  error,
  onBack,
  onRetry,
}: ScoreBreakdownProps) {
  const classes = useStyles();
  const kindLabel = useKindLabel();
  const tierLabel = useTierLabel();
  const [view, setView] = useState<View>('kinds');
  const [selectedKind, setSelectedKind] = useState<string>();
  const [selectedCheck, setSelectedCheck] = useState<string>();
  const detailRef = useRef<HTMLDivElement>(null);

  const kinds = useMemo(() => results?.kinds ?? [], [results]);
  const entities = useMemo(() => results?.entities ?? [], [results]);
  const byKind = useMemo(
    () => kindSummaries(entities, kinds),
    [entities, kinds],
  );
  const tiers = useMemo(() => tierCounts(entities), [entities]);
  const checks = useMemo(() => checkSummaries(entities), [entities]);

  const kindNodes = useMemo(
    () =>
      selectedKind
        ? entities.filter(node => node.entity.kind === selectedKind)
        : [],
    [entities, selectedKind],
  );
  const check = checks.find(summary => summary.check.id === selectedCheck);
  const selection = view === 'kinds' ? selectedKind : selectedCheck;

  useEffect(() => {
    if (selection) {
      detailRef.current?.scrollIntoView?.({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selection]);

  const toggle = (current: string | undefined, next: string) =>
    current === next ? undefined : next;

  let content;
  if (loading) {
    content = <Progress />;
  } else if (error) {
    content = (
      <LoadErrorState
        title="Couldn't load scores"
        error={error}
        onRetry={onRetry}
      />
    );
  } else if (entities.length === 0) {
    content = (
      <EmptyState
        missing="data"
        title="Nothing to score yet"
        description="Scores appear here once a published check applies to entities in the catalog."
      />
    );
  } else {
    content = (
      <>
        <InfoCard noPadding>
          <Tabs
            value={view}
            onChange={(_, next: View) => setView(next)}
            indicatorColor="primary"
          >
            <Tab value="kinds" label="By kind" />
            <Tab value="checks" label="By check" />
          </Tabs>
          <Box p={2}>
            {view === 'kinds' && (
              <>
                <Box display="flex" flexWrap="wrap" mb={2} style={{ gap: 16 }}>
                  {TIERS_HIGH_FIRST.map(rank => (
                    <TierChip
                      key={rank}
                      rank={rank}
                      emphasis="filled"
                      label={`${tierLabel(rank)}: ${tiers[rank]}`}
                    />
                  ))}
                </Box>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Kind</TableCell>
                      <TableCell>Entities</TableCell>
                      {TIERS_HIGH_FIRST.map(rank => (
                        <TableCell key={rank}>{tierLabel(rank)}</TableCell>
                      ))}
                      <TableCell>Not scored</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {byKind.map(summary => (
                      <TableRow
                        key={summary.kind}
                        hover
                        selected={summary.kind === selectedKind}
                        className={classes.selectable}
                        onClick={() =>
                          setSelectedKind(toggle(selectedKind, summary.kind))
                        }
                      >
                        <TableCell>{kindLabel(summary.kind)}</TableCell>
                        <TableCell>{summary.entities}</TableCell>
                        {TIERS_HIGH_FIRST.map(rank => (
                          <TableCell key={rank}>
                            {summary.tiers[rank]}
                          </TableCell>
                        ))}
                        <TableCell>{summary.notScored}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
            {view === 'checks' &&
              (checks.length > 0 ? (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Check</TableCell>
                      <TableCell>Tier</TableCell>
                      <TableCell>Category</TableCell>
                      <TableCell>Passing</TableCell>
                      <TableCell>Failing</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {checks.map(summary => (
                      <TableRow
                        key={summary.check.id}
                        hover
                        selected={summary.check.id === selectedCheck}
                        className={classes.selectable}
                        onClick={() =>
                          setSelectedCheck(
                            toggle(selectedCheck, summary.check.id),
                          )
                        }
                      >
                        <TableCell>{summary.check.name}</TableCell>
                        <TableCell>
                          {summary.check.metadata?.rank !== undefined && (
                            <TierChip rank={summary.check.metadata.rank} />
                          )}
                        </TableCell>
                        <TableCell>
                          {summary.check.metadata?.category || UNCATEGORIZED}
                        </TableCell>
                        <TableCell>{summary.passing.length}</TableCell>
                        <TableCell>{summary.failing.length}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Typography variant="body2" color="textSecondary">
                  No published check has run against an entity yet.
                </Typography>
              ))}
            {!selection && (view === 'kinds' || checks.length > 0) && (
              <Box mt={2}>
                <Typography variant="body2" color="textSecondary">
                  Select a {view === 'kinds' ? 'kind' : 'check'} to see its
                  entities.
                </Typography>
              </Box>
            )}
          </Box>
        </InfoCard>
        <div ref={detailRef}>
          {view === 'kinds' && selectedKind && (
            <Box mt={2}>
              <InfoCard
                title={kindLabel(selectedKind)}
                subheader="Each entity's tier and checks passing, lowest tier first."
              >
                <RollupTable
                  nodes={kindNodes}
                  showKind={false}
                  expandable={false}
                />
              </InfoCard>
            </Box>
          )}
          {view === 'checks' && check && (
            <Box mt={2}>
              <InfoCard
                title={check.check.name}
                subheader={
                  check.check.description ||
                  'The entities this check ran against, failing first.'
                }
              >
                <CheckEntities summary={check} />
              </InfoCard>
            </Box>
          )}
        </div>
      </>
    );
  }

  return (
    <FullPageView
      title={`${title} breakdown`}
      subtitle="Tiers combine an entity's own checks with those of the entities in it."
      onBack={onBack}
    >
      {content}
    </FullPageView>
  );
}
