import { CatalogClient } from '@backstage/catalog-client';
import { ScmIntegrations } from '@backstage/integration';
import { DateTime } from 'luxon';
import type { FactRetriever, TechInsightFact } from '@backstage-community/plugin-tech-insights-node';

const BITBUCKET_PROJECT_SLUG_ANNOTATION = 'bitbucket.org/project-slug';

// Bitbucket Cloud has no single "protected: boolean" field like GitHub —
// branch-restrictions returns a list of independent rules (kind: push/force/
// delete/require_approvals_to_merge/etc.), each matched to branches via a
// pattern. Confirmed live against a real repo: a restricted branch has one
// rule per restriction type (e.g. separate "delete" and "force" entries),
// all sharing the same exact-name pattern. Mirroring GitHub's coarse
// "protected" semantics (true the moment *any* rule exists), v1 treats the
// branch as restricted if *any* rule's pattern matches — not gated on which
// specific kind(s) are present.
//
// Pattern matching here is exact-string only, not full glob support. Real
// data observed so far only uses exact branch names (branch_match_kind:
// "glob", pattern: "main"); generalized glob matching (e.g. "release/*") is
// out of scope for v1 and would need revisiting if that's how a real
// workspace's rules turn out to be configured.
function matchesBranch(pattern: string, branchName: string): boolean {
  return pattern === branchName;
}

export const bitbucketRepoMetadataFactRetriever: FactRetriever = {
  id: 'bitbucketRepoMetadataFactRetriever',
  version: '0.1.0',
  title: 'Bitbucket Cloud Repository Metadata',
  description:
    'Facts about the state of the Bitbucket Cloud repository backing a component, read directly from the Bitbucket Cloud REST API.',
  entityFilter: [{ kind: 'component' }],
  schema: {
    bitbucketIsPrivate: {
      type: 'boolean',
      description: 'Whether the Bitbucket Cloud repository is private',
    },
    bitbucketDefaultBranchName: {
      type: 'string',
      description: 'Name of the repository default branch',
    },
    bitbucketDefaultBranchRestricted: {
      type: 'boolean',
      description:
        'Whether at least one branch-restriction rule matches the default branch. Absent if the branch-restrictions API call fails (e.g. token lacks admin:repository:bitbucket scope) — distinct from a confirmed false.',
    },
  },
  handler: async ({ config, discovery, auth, entityFilter }) => {
    const integrations = ScmIntegrations.fromConfig(config);
    const bitbucket = integrations.bitbucketCloud.byHost('bitbucket.org');
    const apiBaseUrl =
      bitbucket?.config.apiBaseUrl ?? 'https://api.bitbucket.org/2.0';
    const username = bitbucket?.config.username;
    const token = bitbucket?.config.token;

    // Bitbucket Cloud API tokens use HTTP Basic auth (email/username +
    // token) — confirmed live against a real workspace; GitHub's simple
    // `Authorization: Bearer <token>` does not apply here.
    const authHeaders =
      username && token
        ? {
            Authorization: `Basic ${Buffer.from(`${username}:${token}`).toString('base64')}`,
          }
        : {};

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
        entity.metadata.annotations?.[BITBUCKET_PROJECT_SLUG_ANNOTATION];
      if (!slug) {
        // No Bitbucket repo configured for this component — omit rather
        // than emit a fallback value, same missing-data rule as the GitHub
        // metadata retriever.
        continue;
      }

      const response = await fetch(`${apiBaseUrl}/repositories/${slug}`, {
        headers: authHeaders,
      });
      if (!response.ok) {
        // Bad slug, private repo without valid auth, etc. — skip rather
        // than guess, same as the GitHub retriever's skip-on-non-ok.
        continue;
      }
      const repo = await response.json();

      const facts: Record<string, boolean | string> = {
        bitbucketIsPrivate: Boolean(repo.is_private),
      };

      const defaultBranchName: string | undefined = repo.mainbranch?.name;
      if (defaultBranchName) {
        facts.bitbucketDefaultBranchName = defaultBranchName;

        // Requires admin:repository:bitbucket scope — confirmed live that a
        // token without it gets a 403 here even though the base repository
        // call above succeeds on a lesser scope. If this call fails, leave
        // bitbucketDefaultBranchRestricted out of facts entirely rather than
        // defaulting to false — an insufficient-scope token shouldn't make
        // every repo look unprotected.
        const restrictionsResponse = await fetch(
          `${apiBaseUrl}/repositories/${slug}/branch-restrictions`,
          { headers: authHeaders },
        );
        if (restrictionsResponse.ok) {
          const restrictions = await restrictionsResponse.json();
          const rules: Array<{ pattern: string }> = restrictions.values ?? [];
          facts.bitbucketDefaultBranchRestricted = rules.some(rule =>
            matchesBranch(rule.pattern, defaultBranchName),
          );
        }
      }

      results.push({
        entity: {
          namespace: entity.metadata.namespace ?? 'default',
          kind: entity.kind,
          name: entity.metadata.name,
        },
        facts,
        timestamp: DateTime.now(),
      });
    }
    return results;
  },
};
