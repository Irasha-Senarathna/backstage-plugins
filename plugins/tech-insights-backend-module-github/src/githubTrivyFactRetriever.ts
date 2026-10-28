import type { FactRetriever } from '@backstage-community/plugin-tech-insights-node';
import { collectGithubFacts } from './collectGithubFacts';
import {
  codeScanningFacts,
  listOpenCodeScanningAlerts,
} from './codeScanningFacts';

export const githubTrivyFactRetriever: FactRetriever = {
  id: 'githubTrivyFactRetriever',
  version: '0.1.0',
  title: 'GitHub Trivy Scanning',
  description:
    'Open Trivy container-image alerts by severity, read from GitHub Code Scanning.',
  entityFilter: [{ kind: 'component' }],
  schema: {
    trivyScanEnabled: {
      type: 'boolean',
      description:
        'Whether Trivy has uploaded scan results for the repository. When false (it never ran, or the component names no GitHub repository), every other fact is null',
    },
    trivyOpenCriticalAlertCount: {
      type: 'integer',
      description: 'Open Trivy alerts with security severity critical',
    },
    trivyOpenHighAlertCount: {
      type: 'integer',
      description: 'Open Trivy alerts with security severity high',
    },
    trivyOpenMediumAlertCount: {
      type: 'integer',
      description: 'Open Trivy alerts with security severity medium',
    },
    trivyOpenLowAlertCount: {
      type: 'integer',
      description: 'Open Trivy alerts with security severity low',
    },
    trivyHasOpenCriticalAlerts: {
      type: 'boolean',
      description: 'Whether there is at least one open critical Trivy alert',
    },
  },
  handler: context =>
    collectGithubFacts(
      context,
      async ({ repository, api }) =>
        codeScanningFacts(
          'trivy',
          await listOpenCodeScanningAlerts(api, repository, 'Trivy'),
        ),
      { unresolvedFacts: codeScanningFacts('trivy', undefined) },
    ),
};
