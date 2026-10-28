import {
  canonicalKind,
  filterCoversKinds,
  humanizeKind,
  inSentence,
  kindsFromChecks,
  kindsOfFilter,
} from './kinds';

function check(filter?: unknown) {
  return {
    id: 'c',
    type: 'json-rules-engine',
    name: 'c',
    description: '',
    factIds: [],
    filter,
  } as Parameters<typeof kindsFromChecks>[0][number];
}

describe('kindsFromChecks', () => {
  it('collects kinds from string and array filters, lowercased', () => {
    expect(
      kindsFromChecks([
        check({ kind: 'Component' }),
        check({ kind: ['System', 'group'] }),
      ]),
    ).toEqual(['component', 'group', 'system']);
  });

  it('reads every object of an array filter', () => {
    expect(
      kindsFromChecks([check([{ kind: 'API' }, { kind: 'Component' }])]),
    ).toEqual(['api', 'component']);
  });

  it('treats a missing filter as every kind', () => {
    expect(kindsFromChecks([check({ kind: 'Component' }), check()])).toBe(
      'all',
    );
  });

  it('treats a filter object without a kind as every kind', () => {
    expect(
      kindsFromChecks([check([{ kind: 'Component' }, { 'spec.type': 'x' }])]),
    ).toBe('all');
  });

  it('matches the kind key without regard to case', () => {
    expect(kindsFromChecks([check({ Kind: 'Domain' })])).toEqual(['domain']);
  });
});

describe('kindsOfFilter', () => {
  it('reads a fact retriever entityFilter', () => {
    expect(kindsOfFilter([{ kind: 'component' }])).toEqual(['component']);
    expect(kindsOfFilter(null)).toBe('all');
  });

  it('keeps the first spelling of each kind, so it reads without the catalog', () => {
    const kinds = kindsOfFilter([
      { kind: ['ClusterComponentType', 'ComponentType'] },
      { kind: 'componenttype' },
    ]);
    expect(kinds).toEqual(['ClusterComponentType', 'ComponentType']);
    expect(
      (kinds as string[]).map(kind => humanizeKind(canonicalKind(kind, []))),
    ).toEqual(['Cluster component type', 'Component type']);
  });
});

describe('filterCoversKinds', () => {
  it('matches any chosen kind without regard to case', () => {
    expect(filterCoversKinds([{ kind: 'component' }], ['Component'])).toBe(
      true,
    );
    expect(filterCoversKinds([{ kind: 'component' }], ['System'])).toBe(false);
    expect(
      filterCoversKinds([{ kind: 'component' }], ['System', 'Component']),
    ).toBe(true);
  });

  it('covers everything with no filter or no chosen kinds', () => {
    expect(filterCoversKinds(null, ['System'])).toBe(true);
    expect(filterCoversKinds([{ kind: 'component' }], [])).toBe(true);
  });
});

describe('kind labels', () => {
  it('splits a kind into words', () => {
    expect(humanizeKind('DeploymentPipeline')).toBe('Deployment pipeline');
    expect(humanizeKind('ClusterComponentType')).toBe('Cluster component type');
    expect(humanizeKind('API')).toBe('API');
    expect(humanizeKind('Component')).toBe('Component');
  });

  it('lowercases a label inside a sentence, but not an acronym', () => {
    expect(inSentence('Namespace')).toBe('namespace');
    expect(inSentence('API')).toBe('API');
  });
});

describe('canonicalKind', () => {
  const catalogKinds = ['ClusterComponentType', 'Component', 'System'];

  it("uses the catalog's spelling of a filter's lowercased kind", () => {
    expect(canonicalKind('clustercomponenttype', catalogKinds)).toBe(
      'ClusterComponentType',
    );
    expect(
      humanizeKind(canonicalKind('clustercomponenttype', catalogKinds)),
    ).toBe('Cluster component type');
  });

  it('keeps a kind the catalog does not have as written', () => {
    expect(canonicalKind('Environment', catalogKinds)).toBe('Environment');
  });
});
