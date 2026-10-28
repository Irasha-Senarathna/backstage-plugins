import type { GithubApi } from './githubApi';
import type { GithubRepository } from './repository';

export interface CodeScanningAlert {
  rule?: { security_severity_level?: string | null };
}

// GitHub's maximum page size for the alerts listing.
const PAGE_SIZE = 100;

/**
 * Open GitHub Code Scanning alerts reported by one tool, or `undefined` when
 * that tool has never uploaded an analysis for the repository (HTTP 404).
 *
 * `toolName` is matched against the SARIF `tool.driver.name` of each upload,
 * and the listing has no `category` filter, so alerts from every upload of
 * the tool (e.g. every image in a scan matrix) arrive together.
 */
export async function listOpenCodeScanningAlerts(
  api: GithubApi,
  repository: GithubRepository,
  toolName: string,
): Promise<CodeScanningAlert[] | undefined> {
  const slug = `${repository.owner}/${repository.name}`;
  const alerts: CodeScanningAlert[] = [];
  for (let page = 1; ; page++) {
    const { status, body } = await api.getRepo(
      repository,
      `/code-scanning/alerts?tool_name=${encodeURIComponent(
        toolName,
      )}&state=open&per_page=${PAGE_SIZE}&page=${page}`,
    );
    if (status === 404) {
      return undefined;
    }
    if (status !== 200) {
      // 403 is code scanning disabled or a token without Code scanning
      // alerts: read — the facts can't be determined, so the entity is
      // skipped rather than reported clean.
      throw new Error(
        `GET ${toolName} code scanning alerts of ${slug} returned HTTP ${status}`,
      );
    }
    alerts.push(...(body as CodeScanningAlert[]));
    if ((body as CodeScanningAlert[]).length < PAGE_SIZE) {
      return alerts;
    }
  }
}

/**
 * The six `<prefix>*` facts for one scanning tool. When the tool has never
 * run, or the component names no GitHub repository, `<prefix>ScanEnabled` is
 * false and every count is null, so checks fail the component instead of
 * skipping it. Alerts without a security severity (quality-only rules) are
 * not counted.
 */
export function codeScanningFacts(
  prefix: string,
  alerts: CodeScanningAlert[] | undefined,
): Record<string, boolean | number | null> {
  if (!alerts) {
    return {
      [`${prefix}ScanEnabled`]: false,
      [`${prefix}OpenCriticalAlertCount`]: null,
      [`${prefix}OpenHighAlertCount`]: null,
      [`${prefix}OpenMediumAlertCount`]: null,
      [`${prefix}OpenLowAlertCount`]: null,
      [`${prefix}HasOpenCriticalAlerts`]: null,
    };
  }
  const count = (severity: string) =>
    alerts.filter(a => a.rule?.security_severity_level === severity).length;
  const critical = count('critical');
  return {
    [`${prefix}ScanEnabled`]: true,
    [`${prefix}OpenCriticalAlertCount`]: critical,
    [`${prefix}OpenHighAlertCount`]: count('high'),
    [`${prefix}OpenMediumAlertCount`]: count('medium'),
    [`${prefix}OpenLowAlertCount`]: count('low'),
    [`${prefix}HasOpenCriticalAlerts`]: critical > 0,
  };
}
