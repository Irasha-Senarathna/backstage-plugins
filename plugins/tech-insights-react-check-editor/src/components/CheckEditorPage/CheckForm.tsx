import { useState } from 'react';
import Grid from '@material-ui/core/Grid';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import MenuItem from '@material-ui/core/MenuItem';
import Autocomplete from '@material-ui/lab/Autocomplete';
import Alert from '@material-ui/lab/Alert';
import Chip from '@material-ui/core/Chip';
import Typography from '@material-ui/core/Typography';
import Divider from '@material-ui/core/Divider';
import Box from '@material-ui/core/Box';
import Accordion from '@material-ui/core/Accordion';
import AccordionSummary from '@material-ui/core/AccordionSummary';
import AccordionDetails from '@material-ui/core/AccordionDetails';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import { InfoCard } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import { dynamicChecksApiRef } from '../../api/DynamicChecksApi';
import { AskPortalAssistantButton } from './AskPortalAssistantButton';
import { DEFAULT_CHECK_CATEGORIES } from '../../constants';
import {
  factFieldsOf,
  type DryRunResult,
  type DynamicCheck,
  type DynamicCheckInput,
  type FactSchema,
} from '../../api/types';

interface CheckFormProps {
  check: DynamicCheck | null;
  factSchemas: FactSchema[];
  existingCategories: string[];
  onSaved: (check: DynamicCheck) => void;
  onPublished: () => void;
  /**
   * Hides the form's own InfoCard title — for hosts (e.g. a full-page
   * editor) that already show "New check"/"Edit: <name>" in their own
   * chrome, so it isn't repeated. Defaults to shown, since CheckFormDialog
   * and CheckManagementPanel have no other title of their own.
   */
  showTitle?: boolean;
  /**
   * Renders a Cancel button alongside Save/Publish when provided. Omitted
   * by CheckManagementPanel (no cancel affordance there); CheckFormDialog
   * relies on its own close button instead.
   */
  onCancel?: () => void;
}

function defaultRuleJson() {
  return JSON.stringify(
    { conditions: { all: [{ fact: '', operator: 'equal', value: true }] } },
    null,
    2,
  );
}

export function CheckForm(props: CheckFormProps) {
  const {
    check,
    factSchemas,
    existingCategories,
    onSaved,
    onPublished,
    showTitle = true,
    onCancel,
  } = props;
  const api = useApi(dynamicChecksApiRef);

  const [name, setName] = useState(check?.name ?? '');
  const [description, setDescription] = useState(check?.description ?? '');
  const [category, setCategory] = useState(
    (check?.metadata?.category as string | undefined) ?? '',
  );
  const categoryOptions = Array.from(
    new Set([...DEFAULT_CHECK_CATEGORIES, ...existingCategories]),
  ).sort();
  const [rank, setRank] = useState<string>(
    check?.metadata?.rank !== undefined ? String(check.metadata.rank) : '1',
  );
  const [factIds, setFactIds] = useState<string[]>(check?.factIds ?? []);
  const [ruleJson, setRuleJson] = useState(
    check ? JSON.stringify(check.rule, null, 2) : defaultRuleJson(),
  );
  const [filterJson, setFilterJson] = useState(
    check?.filter ? JSON.stringify(check.filter, null, 2) : '',
  );
  const [entityRef, setEntityRef] = useState('component:default/');

  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dryRunError, setDryRunError] = useState<string | null>(null);
  const [dryRunning, setDryRunning] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);

  function buildInput(): DynamicCheckInput | null {
    let rule;
    try {
      rule = JSON.parse(ruleJson);
    } catch (e) {
      setSaveError(`Rule is not valid JSON: ${(e as Error).message}`);
      return null;
    }
    let filter;
    if (filterJson.trim()) {
      try {
        filter = JSON.parse(filterJson);
      } catch (e) {
        setSaveError(`Filter is not valid JSON: ${(e as Error).message}`);
        return null;
      }
    }
    if (!name.trim()) {
      setSaveError('Name is required.');
      return null;
    }
    if (factIds.length === 0) {
      setSaveError('At least one fact retriever is required.');
      return null;
    }
    const metadata: Record<string, unknown> = { rank: Number(rank) };
    if (category.trim()) metadata.category = category.trim();
    return {
      name: name.trim(),
      description: description.trim() || undefined,
      factIds,
      metadata,
      filter,
      rule,
    };
  }

  async function handleSave() {
    setSaveError(null);
    const input = buildInput();
    if (!input) return;

    setSaving(true);
    try {
      const saved = check
        ? await api.updateCheck(check.id, input)
        : await api.createCheck(input);
      onSaved(saved);
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDryRun() {
    setDryRunError(null);
    setDryRunResult(null);
    const input = buildInput();
    if (!input) return;
    if (!entityRef.trim()) {
      setDryRunError('Enter an entity ref to dry-run against, e.g. component:default/my-service.');
      return;
    }

    setDryRunning(true);
    try {
      const result = await api.dryRun(entityRef.trim(), input);
      setDryRunResult(result);
    } catch (e) {
      setDryRunError((e as Error).message);
    } finally {
      setDryRunning(false);
    }
  }

  async function handlePublish() {
    if (!check) return;
    await api.publishCheck(check.id);
    onPublished();
  }

  const title = check ? `Edit: ${check.name}` : 'New check';

  return (
    <InfoCard title={showTitle ? title : undefined}>
      <Grid container spacing={2}>
        {/* About */}
        <Grid item xs={12}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <SectionLabel>About</SectionLabel>
            <AskPortalAssistantButton
              factSchemas={factSchemas}
              factIds={factIds}
            />
          </Box>
        </Grid>
        <Grid item xs={12}>
          <TextField
            label="Name"
            fullWidth
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            label="Description"
            fullWidth
            multiline
            minRows={2}
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </Grid>

        <Grid item xs={12}>
          <Box my={1}>
            <Divider />
          </Box>
        </Grid>

        {/* Classification */}
        <Grid item xs={12}>
          <SectionLabel>Classification</SectionLabel>
        </Grid>
        <Grid item xs={6}>
          <TextField
            select
            label="Category"
            fullWidth
            value={category}
            onChange={e => setCategory(e.target.value)}
            helperText="Groups checks in the compliance view"
          >
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            {categoryOptions.map(option => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item xs={6}>
          <TextField
            select
            required
            label="Maturity tier"
            fullWidth
            value={rank}
            onChange={e => setRank(e.target.value)}
            helperText="Checks with no tier are excluded from the Bronze/Silver/Gold breakdown"
          >
            <MenuItem value="1">Bronze</MenuItem>
            <MenuItem value="2">Silver</MenuItem>
            <MenuItem value="3">Gold</MenuItem>
          </TextField>
        </Grid>

        <Grid item xs={12}>
          <Box my={1}>
            <Divider />
          </Box>
        </Grid>

        {/* Define the check */}
        <Grid item xs={12}>
          <SectionLabel>Define the check</SectionLabel>
        </Grid>
        <Grid item xs={12}>
          <Autocomplete
            multiple
            options={factSchemas.map(f => f.id)}
            value={factIds}
            onChange={(_e, value) => setFactIds(value)}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip label={option} size="small" {...getTagProps({ index })} />
              ))
            }
            renderInput={params => (
              <TextField
                {...params}
                label="Fact retrievers"
                helperText="Populated from the running backend's registered fact retrievers. Pick these first — the rule below references their fields."
              />
            )}
          />
        </Grid>
        {factIds.length > 0 && (
          <Grid item xs={12}>
            <Typography variant="caption" color="textSecondary">
              Available facts for reference in the rule below:
            </Typography>
            {factIds.map(id => {
              const schema = factSchemas.find(f => f.id === id);
              if (!schema) return null;
              return (
                <Typography key={id} variant="body2" component="div">
                  <strong>{id}</strong>:{' '}
                  {factFieldsOf(schema)
                    .map(f => `${f.name} (${f.field.type})`)
                    .join(', ')}
                </Typography>
              );
            })}
          </Grid>
        )}
        <Grid item xs={12}>
          <TextField
            label="Rule (json-rules-engine conditions)"
            fullWidth
            multiline
            minRows={8}
            value={ruleJson}
            onChange={e => setRuleJson(e.target.value)}
            InputProps={{ style: { fontFamily: 'monospace', fontSize: 13 } }}
          />
        </Grid>
        <Grid item xs={12}>
          <Accordion
            variant="outlined"
            defaultExpanded={filterJson.trim().length > 0}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="body2">
                Advanced: entity filter (optional)
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <TextField
                label="Entity filter (optional, JSON)"
                fullWidth
                multiline
                minRows={4}
                placeholder='{"kind": "component"}'
                helperText="Restricts which entities this check runs against. Leave empty to apply to all entities the chosen facts support."
                value={filterJson}
                onChange={e => setFilterJson(e.target.value)}
                InputProps={{ style: { fontFamily: 'monospace', fontSize: 13 } }}
              />
            </AccordionDetails>
          </Accordion>
        </Grid>

        <Grid item xs={12}>
          <Box my={1}>
            <Divider />
          </Box>
        </Grid>

        {/* Test it */}
        <Grid item xs={12}>
          <SectionLabel>Test it</SectionLabel>
        </Grid>
        <Grid item xs={12}>
          <Grid container spacing={2} alignItems="flex-end">
            <Grid item xs={12} sm={8}>
              <TextField
                label="Dry-run against entity ref"
                fullWidth
                value={entityRef}
                onChange={e => setEntityRef(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <Button
                variant="outlined"
                onClick={handleDryRun}
                disabled={dryRunning}
              >
                Dry run
              </Button>
            </Grid>
          </Grid>
        </Grid>

        {dryRunError && (
          <Grid item xs={12}>
            <Alert severity="error">{dryRunError}</Alert>
          </Grid>
        )}
        {dryRunResult && (
          <Grid item xs={12}>
            <Alert severity={dryRunResult.result ? 'success' : 'warning'}>
              Result: {String(dryRunResult.result)}
            </Alert>
            <Typography variant="body2" component="pre" style={{ overflowX: 'auto' }}>
              {JSON.stringify(dryRunResult.facts, null, 2)}
            </Typography>
          </Grid>
        )}

        <Grid item xs={12}>
          <Box my={1}>
            <Divider />
          </Box>
        </Grid>

        {/* Save */}
        {saveError && (
          <Grid item xs={12}>
            <Alert severity="error">{saveError}</Alert>
          </Grid>
        )}
        <Grid item xs={12}>
          <Box display="flex" justifyContent="flex-end" style={{ gap: 8 }}>
            {onCancel && <Button onClick={onCancel}>Cancel</Button>}
            {check && check.status !== 'published' && (
              <Button variant="outlined" color="primary" onClick={handlePublish}>
                Publish
              </Button>
            )}
            <Button
              variant="contained"
              color="primary"
              onClick={handleSave}
              disabled={saving}
            >
              {check ? 'Save changes' : 'Create check'}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </InfoCard>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Typography
      variant="subtitle2"
      color="textSecondary"
      style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}
    >
      {children}
    </Typography>
  );
}
