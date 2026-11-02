import { fireEvent, render, screen } from '@testing-library/react';
import type {
  DynamicCheck,
  FactSchema,
} from '@openchoreo/backstage-plugin-tech-insights-scorecards';
import { AskPortalAssistantButton } from './AskPortalAssistantButton';
import type { ChatScope } from '../../api/PortalAssistantApi';

// Hoisted shared spies — see InvestigateLogButton.test.tsx for the rationale.
const holder: { enabled: boolean; openDrawer: jest.Mock } = {
  enabled: true,
  openDrawer: jest.fn(),
};

jest.mock('@backstage/core-plugin-api', () => ({
  createApiRef: (config: { id: string }) => ({ id: config.id }),
}));

jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useAssistantEnabled: () => holder.enabled,
}));

// Only factFieldsOf is used at runtime; keep the scorecards package (and
// its UI) out of this test.
jest.mock('@openchoreo/backstage-plugin-tech-insights-scorecards', () => ({
  factFieldsOf: (schema: Record<string, unknown>) =>
    Object.entries(schema)
      .filter(([key]) => !['id', 'version', 'entityFilter'].includes(key))
      .map(([name, field]) => ({ name, field })),
}));

jest.mock('../AssistantContext/AssistantDrawerContext', () => ({
  useAssistantDrawer: () => ({
    openDrawer: (...args: unknown[]) => holder.openDrawer(...args),
  }),
}));

type DrawerCall = {
  scopeOverrides: Partial<ChatScope>;
  conversationKey: string;
};

const firstCall = () => holder.openDrawer.mock.calls[0][0] as DrawerCall;

const factSchemas = [
  {
    id: 'githubRepoMetadataFactRetriever',
    version: '0.1.0',
    githubVisibility: { type: 'string', description: 'public or private' },
  },
] as unknown as FactSchema[];

const check: DynamicCheck = {
  id: 'abc-123',
  type: 'json-rules-engine',
  name: 'Repo must be public',
  description: 'Fails if the repository is not public',
  factIds: ['githubRepoMetadataFactRetriever'],
  metadata: { solution: 'Make the repository public' },
  rule: {
    conditions: {
      all: [{ fact: 'githubVisibility', operator: 'equal', value: 'public' }],
    },
  },
};

beforeEach(() => {
  holder.enabled = true;
  holder.openDrawer = jest.fn();
});

describe('AskPortalAssistantButton', () => {
  it('renders nothing when the assistant feature is disabled', () => {
    holder.enabled = false;
    const { container } = render(
      <AskPortalAssistantButton factSchemas={factSchemas} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('opens the shared check_authoring conversation for a new check', () => {
    render(<AskPortalAssistantButton factSchemas={factSchemas} />);
    fireEvent.click(screen.getByRole('button', { name: /ask portal assistant/i }));

    const call = firstCall();
    expect(call.conversationKey).toBe('check_authoring');
    expect(call.scopeOverrides.caseType).toBe('check_authoring');
    expect(call.scopeOverrides.availableFactRetrievers?.[0].id).toBe(
      'githubRepoMetadataFactRetriever',
    );
    expect(call.scopeOverrides.checkId).toBeUndefined();
    expect(call.scopeOverrides.currentRule).toBeUndefined();
  });

  it('forwards the edited check and uses one conversation per check', () => {
    render(<AskPortalAssistantButton factSchemas={factSchemas} check={check} />);
    fireEvent.click(screen.getByRole('button', { name: /ask portal assistant/i }));

    const call = firstCall();
    expect(call.conversationKey).toBe('check_authoring:abc-123');
    expect(call.scopeOverrides).toMatchObject({
      caseType: 'check_authoring',
      checkId: 'abc-123',
      checkName: 'Repo must be public',
      checkDescription: 'Fails if the repository is not public',
      checkSolution: 'Make the repository public',
      selectedFactIds: ['githubRepoMetadataFactRetriever'],
    });
    expect(JSON.parse(call.scopeOverrides.currentRule!)).toEqual(
      check.rule.conditions,
    );
  });
});
