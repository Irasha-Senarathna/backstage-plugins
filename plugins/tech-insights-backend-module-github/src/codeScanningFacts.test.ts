import type { GithubApi } from './githubApi';
import type { GithubRepository } from './repository';
import {
  codeScanningFacts,
  listOpenCodeScanningAlerts,
} from './codeScanningFacts';
import { githubCodeqlFactRetriever } from './githubCodeqlFactRetriever';
import { githubTrivyFactRetriever } from './githubTrivyFactRetriever';

const repository = {
  owner: 'org',
  name: 'repo',
} as GithubRepository;

const alert = (severity: string | null) => ({
  rule: { security_severity_level: severity },
});

function apiReturning(...responses: Array<{ status: number; body?: any }>) {
  const getRepo = jest.fn();
  responses.forEach(r => getRepo.mockResolvedValueOnce(r));
  return { api: { getRepo } as GithubApi, getRepo };
}

describe('codeScanningFacts', () => {
  it('counts open alerts by severity under the given prefix', () => {
    expect(
      codeScanningFacts('codeql', [
        alert('critical'),
        alert('high'),
        alert('high'),
        alert('low'),
        alert(null),
      ]),
    ).toEqual({
      codeqlScanEnabled: true,
      codeqlOpenCriticalAlertCount: 1,
      codeqlOpenHighAlertCount: 2,
      codeqlOpenMediumAlertCount: 0,
      codeqlOpenLowAlertCount: 1,
      codeqlHasOpenCriticalAlerts: true,
    });
  });

  it('reports a clean scan with real zero values', () => {
    expect(codeScanningFacts('trivy', [])).toEqual({
      trivyScanEnabled: true,
      trivyOpenCriticalAlertCount: 0,
      trivyOpenHighAlertCount: 0,
      trivyOpenMediumAlertCount: 0,
      trivyOpenLowAlertCount: 0,
      trivyHasOpenCriticalAlerts: false,
    });
  });

  it('reports ScanEnabled: false and null counts when the tool never ran', () => {
    expect(codeScanningFacts('trivy', undefined)).toEqual({
      trivyScanEnabled: false,
      trivyOpenCriticalAlertCount: null,
      trivyOpenHighAlertCount: null,
      trivyOpenMediumAlertCount: null,
      trivyOpenLowAlertCount: null,
      trivyHasOpenCriticalAlerts: null,
    });
  });
});

describe('listOpenCodeScanningAlerts', () => {
  it('filters by tool and open state', async () => {
    const { api, getRepo } = apiReturning({ status: 200, body: [] });
    await listOpenCodeScanningAlerts(api, repository, 'Trivy');
    expect(getRepo).toHaveBeenCalledWith(
      repository,
      expect.stringMatching(/^\/code-scanning\/alerts\?tool_name=Trivy&state=open&/),
    );
  });

  it('reads every page', async () => {
    const { api, getRepo } = apiReturning(
      { status: 200, body: Array(100).fill(alert('high')) },
      { status: 200, body: [alert('critical')] },
    );
    const alerts = await listOpenCodeScanningAlerts(api, repository, 'CodeQL');
    expect(alerts).toHaveLength(101);
    expect(getRepo).toHaveBeenLastCalledWith(
      repository,
      expect.stringContaining('page=2'),
    );
  });

  it('returns undefined when the tool never ran (404)', async () => {
    const { api } = apiReturning({ status: 404 });
    await expect(
      listOpenCodeScanningAlerts(api, repository, 'CodeQL'),
    ).resolves.toBeUndefined();
  });

  it('throws on other errors so the entity is skipped, not reported clean', async () => {
    const { api } = apiReturning({ status: 403 });
    await expect(
      listOpenCodeScanningAlerts(api, repository, 'CodeQL'),
    ).rejects.toThrow('HTTP 403');
  });
});

describe('CodeQL and Trivy retrievers', () => {
  it('are independent: different ids and non-overlapping facts', () => {
    expect(githubCodeqlFactRetriever.id).not.toBe(githubTrivyFactRetriever.id);
    expect(
      Object.keys(githubCodeqlFactRetriever.schema).every(f =>
        f.startsWith('codeql'),
      ),
    ).toBe(true);
    expect(
      Object.keys(githubTrivyFactRetriever.schema).every(f =>
        f.startsWith('trivy'),
      ),
    ).toBe(true);
  });
});
