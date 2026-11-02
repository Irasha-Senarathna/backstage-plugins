import type { BackstageCredentials } from '@backstage/backend-plugin-api';
import { mockCredentials, mockServices } from '@backstage/backend-test-utils';
import { actionsRegistryServiceMock } from '@backstage/backend-test-utils/alpha';
import { AuthorizeResult } from '@backstage/plugin-permission-common';
import { registerCheckActions } from './actions';
import { dryRunCheck } from './dryRun';
import type { DynamicCheckRegistry } from './DynamicCheckRegistry';

jest.mock('./dryRun', () => ({ dryRunCheck: jest.fn() }));
const dryRunCheckMock = dryRunCheck as jest.MockedFunction<typeof dryRunCheck>;

const conditions = {
  all: [{ fact: 'githubVisibility', operator: 'equal', value: 'private' }],
};

// The check as a tool caller sends it: conditions as a JSON string.
const toolCheck = {
  name: 'Repo must be private',
  description: '',
  factIds: ['githubRepoMetadataFactRetriever'],
  rule: { conditions: JSON.stringify(conditions) },
};

// The same check as the module stores and evaluates it.
const draftCheck = {
  type: 'json-rules-engine',
  name: 'Repo must be private',
  description: '',
  factIds: ['githubRepoMetadataFactRetriever'],
  rule: { conditions },
};

const user = mockCredentials.user();
const agent = mockCredentials.service('external:mcp-dev');

function setup({ allow = true }: { allow?: boolean } = {}) {
  const registry = {
    listAll: jest.fn(),
    register: jest.fn(async (check: any) => check),
  };
  const store = {
    getLatestSchemas: jest.fn(),
    getLatestFactsByIds: jest.fn(),
  };
  const catalog = {
    getEntityByRef: jest.fn(async () => ({ kind: 'Component' })),
  };
  const permissions = mockServices.permissions.mock({
    authorize: jest.fn(async () => [
      { result: allow ? AuthorizeResult.ALLOW : AuthorizeResult.DENY },
    ]) as any,
  });
  const actionsRegistry = actionsRegistryServiceMock({
    logger: mockServices.logger.mock(),
  });
  registerCheckActions({
    actionsRegistry,
    registry: registry as unknown as DynamicCheckRegistry,
    catalog: catalog as any,
    auth: mockServices.auth(),
    permissions,
    getEvaluation: () => ({ store, checker: {} }) as any,
  });
  const invoke = (
    name: string,
    input: object,
    credentials: BackstageCredentials = agent,
  ) =>
    actionsRegistry.invoke({ id: `test:${name}`, input: input as any, credentials });
  return { actionsRegistry, registry, store, catalog, permissions, invoke };
}

/**
 * Collects violations of OpenAI strict function calling rules, which the
 * Portal Assistant enables for every tool: each object lists all its
 * properties as required and sets additionalProperties: false, and there are
 * no free-form ("any") schemas.
 */
function strictModeViolations(schema: any, path = '$'): string[] {
  if (!schema || typeof schema !== 'object') return [];
  if (Object.keys(schema).filter(k => k !== 'description').length === 0) {
    return [`${path}: free-form schema`];
  }
  const errors: string[] = [];
  if (schema.type === 'object') {
    const keys = Object.keys(schema.properties ?? {});
    if (schema.additionalProperties !== false) {
      errors.push(`${path}: additionalProperties must be false`);
    }
    const required = new Set(schema.required ?? []);
    keys
      .filter(k => !required.has(k))
      .forEach(k => errors.push(`${path}.${k}: must be required`));
    keys.forEach(k =>
      errors.push(...strictModeViolations(schema.properties[k], `${path}.${k}`)),
    );
  }
  if (schema.type === 'array') {
    errors.push(...strictModeViolations(schema.items, `${path}[]`));
  }
  return errors;
}

describe('registerCheckActions', () => {
  beforeEach(() => dryRunCheckMock.mockReset());

  it('registers exactly the expected tools with explicit flags', () => {
    const { actionsRegistry } = setup();

    const attributes = Object.fromEntries(
      [...actionsRegistry.actions.values()].map(a => [a.name, a.attributes]),
    );
    const readOnly = { readOnly: true, destructive: false, idempotent: true };
    expect(attributes).toEqual({
      list_checks: readOnly,
      get_check: readOnly,
      list_fact_schemas: readOnly,
      get_entity_facts: readOnly,
      dry_run_check: readOnly,
      create_check: { readOnly: false, destructive: false, idempotent: false },
    });
  });

  // Regression: the Portal Assistant's OpenAI call failed with "Invalid
  // schema for function 'dry_run_check'" when rule.conditions was a
  // free-form object and some fields were optional.
  it('every input schema is valid for OpenAI strict function calling', async () => {
    const { actionsRegistry } = setup();

    const { actions } = await actionsRegistry.list();

    expect(
      actions.flatMap(a => strictModeViolations(a.schema.input, a.name)),
    ).toEqual([]);
  });

  describe('permissions', () => {
    it('applies the read permission to a signed-in user', async () => {
      const { invoke, registry } = setup({ allow: false });

      await expect(invoke('list_checks', {}, user)).rejects.toThrow(
        /don't have the .* permission/,
      );
      expect(registry.listAll).not.toHaveBeenCalled();
    });

    it('lets a service caller (the assistant) read without a user', async () => {
      const { invoke, registry, permissions } = setup();
      registry.listAll.mockResolvedValue([]);

      await invoke('list_checks', {}, agent);

      expect(permissions.authorize).not.toHaveBeenCalled();
    });

    it('rejects callers with no credentials', async () => {
      const { invoke } = setup();

      await expect(invoke('list_checks', {}, mockCredentials.none())).rejects.toThrow(
        /signed-in user or service/,
      );
    });

    it('never lets a service caller save a check', async () => {
      const { invoke, registry } = setup();

      await expect(invoke('create_check', toolCheck, agent)).rejects.toThrow(
        /requires a signed-in user/,
      );
      expect(registry.register).not.toHaveBeenCalled();
    });

    it('applies the manage permission to a user saving a check', async () => {
      const { invoke, registry } = setup({ allow: false });

      await expect(invoke('create_check', toolCheck, user)).rejects.toThrow(
        /don't have the .* permission/,
      );
      expect(registry.register).not.toHaveBeenCalled();
    });
  });

  it('list_checks hides leftover dry-run checks', async () => {
    const { invoke, registry } = setup();
    registry.listAll.mockResolvedValue([
      { id: 'c1', name: 'Real', description: 'd', factIds: ['f'], status: 'draft' },
      { id: '__dryrun__x', name: 'Tmp', description: 'd', factIds: ['f'], status: 'draft' },
    ]);

    const { output } = await invoke('list_checks', {});

    expect(output).toEqual({
      checks: [{ id: 'c1', name: 'Real', description: 'd', factIds: ['f'], status: 'draft' }],
    });
  });

  it('get_check returns the full check, or a hint when the id is unknown', async () => {
    const { invoke, registry } = setup();
    registry.listAll.mockResolvedValue([
      { ...draftCheck, id: 'c1', description: undefined, status: 'published' },
    ]);

    const { output } = await invoke('get_check', { id: 'c1' });
    expect(output).toMatchObject({
      check: { id: 'c1', description: '', status: 'published', rule: { conditions } },
    });
    await expect(invoke('get_check', { id: 'nope' })).rejects.toThrow(/use list_checks/);
  });

  it('list_fact_schemas treats an empty ids array as "all"', async () => {
    const { invoke, store } = setup();
    store.getLatestSchemas.mockResolvedValue([{ id: 'a' }]);

    await invoke('list_fact_schemas', { ids: [] });
    await invoke('list_fact_schemas', { ids: ['a'] });

    expect(store.getLatestSchemas.mock.calls).toEqual([[undefined], [['a']]]);
  });

  it('get_entity_facts normalises the entity ref and returns fact values', async () => {
    const { invoke, store } = setup();
    store.getLatestFactsByIds.mockResolvedValue({
      githubRepoMetadataFactRetriever: {
        id: 'row',
        timestamp: 'ts',
        facts: { githubVisibility: 'public' },
      },
    });

    const { output } = await invoke('get_entity_facts', {
      entityRef: 'component:order-api',
      factIds: ['githubRepoMetadataFactRetriever'],
    });

    expect(store.getLatestFactsByIds).toHaveBeenCalledWith(
      ['githubRepoMetadataFactRetriever'],
      'component:default/order-api',
    );
    expect(output).toEqual({
      facts: {
        githubRepoMetadataFactRetriever: {
          timestamp: 'ts',
          facts: { githubVisibility: 'public' },
        },
      },
    });
  });

  describe('dry_run_check', () => {
    const input = { entityRef: 'component:default/order-api', check: toolCheck };

    it('reports a failure as a final result with the actual values', async () => {
      const { invoke } = setup();
      dryRunCheckMock.mockResolvedValue({
        status: 'failed',
        entityRef: 'component:default/order-api',
        reasons: [],
        collectedAt: {},
        conditions: {
          all: [{ fact: 'githubVisibility', operator: 'equal', value: 'private', factResult: 'public', result: false }],
        },
      });

      const { output } = await invoke('dry_run_check', input);

      expect(output).toEqual({
        status: 'failed',
        passed: false,
        summary:
          'The check was evaluated successfully: component:default/order-api does NOT meet this rule ' +
          '(githubVisibility = "public"). This is the final result — report it; do not change the rule to make it pass.',
        factValues: { githubVisibility: 'public' },
        reasons: [],
      });
      expect(dryRunCheckMock).toHaveBeenCalledWith(
        expect.objectContaining({ check: draftCheck, entityRef: 'component:default/order-api' }),
      );
    });

    it('turns an invalid check into an input error with the reasons', async () => {
      const { invoke } = setup();
      dryRunCheckMock.mockResolvedValue({
        status: 'invalid',
        entityRef: 'component:default/order-api',
        reasons: [{ code: 'unknown-fact', message: 'repoVisibility is not a known fact.' }],
        collectedAt: {},
      });

      await expect(invoke('dry_run_check', input)).rejects.toMatchObject({
        name: 'InputError',
        message: 'The check could not be evaluated: repoVisibility is not a known fact.',
      });
    });

    it('explains a check that does not apply to the entity', async () => {
      const { invoke } = setup();
      dryRunCheckMock.mockResolvedValue({
        status: 'not-applicable',
        entityRef: 'component:default/order-api',
        reasons: [{ code: 'no-facts', message: 'No facts collected yet.' }],
        collectedAt: {},
      });

      const { output } = await invoke('dry_run_check', input);

      expect(output).toMatchObject({
        status: 'not-applicable',
        passed: false,
        summary: expect.stringMatching(/does not apply .* No facts collected yet/),
      });
    });

    it('unwraps conditions repeated as {"conditions":{...}}', async () => {
      const { invoke } = setup();
      dryRunCheckMock.mockResolvedValue({
        status: 'passed', entityRef: 'x', reasons: [], collectedAt: {},
      });

      await invoke('dry_run_check', {
        ...input,
        check: { ...toolCheck, rule: { conditions: JSON.stringify({ conditions }) } },
      });

      expect(dryRunCheckMock).toHaveBeenCalledWith(
        expect.objectContaining({ check: draftCheck }),
      );
    });

    it.each([
      ['not JSON', '{all: [', /not valid JSON/],
      ['a JSON array', '[]', /top level is "all", "any" or "not"/],
      ['missing all/any/not', '{"fact":"x","operator":"equal","value":1}', /top level is/],
    ])('rejects conditions that are %s', async (_label, raw, message) => {
      const { invoke } = setup();

      await expect(
        invoke('dry_run_check', { ...input, check: { ...toolCheck, rule: { conditions: raw } } }),
      ).rejects.toThrow(message);
      expect(dryRunCheckMock).not.toHaveBeenCalled();
    });

    it('rejects an incomplete entity ref', async () => {
      const { invoke } = setup();

      await expect(
        invoke('dry_run_check', { ...input, entityRef: 'order-api' }),
      ).rejects.toThrow(/isn't a complete entity ref/);
    });
  });

  it('create_check saves a draft for a permitted user', async () => {
    const { invoke, registry } = setup();

    const { output } = await invoke('create_check', toolCheck, user);

    expect(registry.register).toHaveBeenCalledWith({ ...draftCheck, id: expect.any(String) });
    expect(output).toEqual({
      id: expect.any(String),
      name: 'Repo must be private',
      status: 'draft',
    });
  });
});
