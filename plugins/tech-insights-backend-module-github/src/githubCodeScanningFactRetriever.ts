import { CatalogClient } from '@backstage/catalog-client';
import { ScmIntegrations } from '@backstage/integration';
import { DateTime } from 'luxon';
import type { FactRetriever, TechInsightFact } from '@backstage-community/plugin-tech-insights-node';

const GITHUB_PROJECT_SLUG_ANNOTATION = 'github.com/project-slug';

export const githubCodeScanningFactRetriever: FactRetriever = {
  id: 'githubCodeScanningFactRetriever',
  version: '0.1.0',
  title: 'GitHub Code Scanning (CodeQL)',
  description:
    'Open CodeQL vulnerability alert counts, read from the GitHub Code Scanning Alerts API.',
  entityFilter: [{ kind: 'component' }],
  schema: {
    githubCodeScanningEnabled: {
      type: 'boolean',
      description:
        'Whether CodeQL has ever analyzed this repository. False if no analysis has run yet — distinct from having zero open alerts.',
    },
    githubOpenCriticalAlertCount: {
      type: 'integer',
      description: 'Number of open CodeQL alerts with security_severity_level critical',
    },
    githubOpenHighAlertCount: {
      type: 'integer',
      description: 'Number of open CodeQL alerts with security_severity_level high',
    },
    githubOpenMediumAlertCount: {
      type: 'integer',
      description: 'Number of open CodeQL alerts with security_severity_level medium',
    },
    githubOpenLowAlertCount: {
      type: 'integer',
      description: 'Number of open CodeQL alerts with security_severity_level low',
    },
    githubHasOpenCriticalAlerts: {
      type: 'boolean',
      description: 'True if githubOpenCriticalAlertCount > 0',
    },
  },
  handler: async ({ config, discovery, auth, entityFilter }) => {
    const integrations = ScmIntegrations.fromConfig(config);
    const github = integrations.github.byHost('github.com');
    const apiBaseUrl = github?.config.apiBaseUrl ?? 'https://api.github.com';
    const token = github?.config.token;

    const { token: catalogToken } = await auth.getPluginRequestToken({
      onBehalfOf: await auth.getOwnServiceCredentials(),
      targetPluginId: 'catalog',
    });
    const catalogClient = new CatalogClient({ discoveryApi: discovery });
    const entities = await catalogClient.getEntities(
      { filter: entityFilter },
      { token: catalogToken },
    );

    const results: TechInsightFact[] = [];
    for (const entity of entities.items) {
      const slug =
        entity.metadata.annotations?.[GITHUB_PROJECT_SLUG_ANNOTATION];
      if (!slug) {
        continue;
      }

      const response = await fetch(
        `${apiBaseUrl}/repos/${slug}/code-scanning/alerts?tool_name=CodeQL&state=open&per_page=100`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );

      if (response.status === 404) {
        // No CodeQL analysis has ever run on this repo — omit every fact
        // except githubCodeScanningEnabled: false, so a check like
        // "no open critical alerts" doesn't pass-by-omission for a repo
        // that was never scanned. Same missing-data rule as the metadata
        // retriever's skip-on-missing-slug behavior.
        results.push({
          entity: {
            namespace: entity.metadata.namespace ?? 'default',
            kind: entity.kind,
            name: entity.metadata.name,
          },
          facts: { githubCodeScanningEnabled: false },
          timestamp: DateTime.now(),
        });
        continue;
      }
      if (!response.ok) {
        // 403 (permission/GHAS-disabled) or 5xx — skip entirely rather than
        // guess, same as the metadata retriever's skip-on-non-ok behavior.
        continue;
      }

      const alerts: Array<{ rule: { security_severity_level: string | null } }> =
        await response.json();

      let critical = 0, high = 0, medium = 0, low = 0;
      for (const alert of alerts) {
        switch (alert.rule.security_severity_level) {
          case 'critical': critical++; break;
          case 'high': high++; break;
          case 'medium': medium++; break;
          case 'low': low++; break;
          // null/undefined: rule has no security_severity_level (e.g.
          // quality-only rules) — intentionally not counted in any bucket.
        }
      }

      results.push({
        entity: {
          namespace: entity.metadata.namespace ?? 'default',
          kind: entity.kind,
          name: entity.metadata.name,
        },
        facts: {
          githubCodeScanningEnabled: true,
          githubOpenCriticalAlertCount: critical,
          githubOpenHighAlertCount: high,
          githubOpenMediumAlertCount: medium,
          githubOpenLowAlertCount: low,
          githubHasOpenCriticalAlerts: critical > 0,
        },
        timestamp: DateTime.now(),
      });
    }
    return results;
  },
};
