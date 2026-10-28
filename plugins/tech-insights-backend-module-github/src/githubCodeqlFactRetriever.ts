import type { FactRetriever } from '@backstage-community/plugin-tech-insights-node';
import { collectGithubFacts } from './collectGithubFacts';
import {
  codeScanningFacts,
  listOpenCodeScanningAlerts,
} from './codeScanningFacts';

export const githubCodeqlFactRetriever: FactRetriever = {
  id: 'githubCodeqlFactRetriever',
  version: '0.1.0',
  title: 'GitHub CodeQL Scanning',
  description:
    'Open CodeQL static-analysis alerts by severity, read from GitHub Code Scanning.',
  entityFilter: [{ kind: 'component' }],
  schema: {
    codeqlScanEnabled: {
      type: 'boolean',
      description:
        'Whether CodeQL has uploaded an analysis for the repository. When false (it never ran, or the component names no GitHub repository), every other fact is null',
    },
    codeqlOpenCriticalAlertCount: {
      type: 'integer',
      description: 'Open CodeQL alerts with security severity critical',
    },
    codeqlOpenHighAlertCount: {
      type: 'integer',
      description: 'Open CodeQL alerts with security severity high',
    },
    codeqlOpenMediumAlertCount: {
      type: 'integer',
      description: 'Open CodeQL alerts with security severity medium',
    },
    codeqlOpenLowAlertCount: {
      type: 'integer',
      description: 'Open CodeQL alerts with security severity low',
    },
    codeqlHasOpenCriticalAlerts: {
      type: 'boolean',
      description: 'Whether there is at least one open critical CodeQL alert',
    },
  },
  handler: context =>
    collectGithubFacts(
      context,
      async ({ repository, api }) =>
        codeScanningFacts(
          'codeql',
          await listOpenCodeScanningAlerts(api, repository, 'CodeQL'),
        ),
      { unresolvedFacts: codeScanningFacts('codeql', undefined) },
    ),
};
