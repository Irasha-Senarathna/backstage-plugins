import Button from '@material-ui/core/Button';
import SvgIcon, { type SvgIconProps } from '@material-ui/core/SvgIcon';
import { useAssistantEnabled } from '@openchoreo/backstage-plugin-react';
import {
  factFieldsOf,
  type DynamicCheck,
  type FactSchema,
} from '@openchoreo/backstage-plugin-tech-insights-scorecards';
import type { ChatScope, FactRetriever } from '../../api/PortalAssistantApi';
import { useAssistantDrawer } from '../AssistantContext/AssistantDrawerContext';

/** Scope fields that tell the agent which existing check is being edited. */
function editingScope(check: DynamicCheck): Partial<ChatScope> {
  const solution = check.metadata?.solution;
  return {
    checkId: check.id,
    checkName: check.name,
    ...(check.description ? { checkDescription: check.description } : {}),
    ...(typeof solution === 'string' && solution
      ? { checkSolution: solution }
      : {}),
    currentRule: JSON.stringify(check.rule.conditions),
    ...(check.factIds.length > 0 ? { selectedFactIds: check.factIds } : {}),
  };
}

/**
 * Sparkle glyph (Material "auto_awesome") marking the button as an AI
 * feature. @material-ui/icons v4 doesn't ship it, so the path is inlined.
 */
const AiSparkleIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z" />
  </SvgIcon>
);

/**
 * Opens the Portal Assistant drawer scoped to check authoring. Rendered next
 * to "New check" on the scorecards check list through the scorecards
 * plugin's `checkAuthoringAssistantApiRef` slot (see ../../alpha.tsx).
 *
 * The registered fact schemas are forwarded as
 * `ChatScope.availableFactRetrievers` so the agent only references facts
 * that actually exist instead of inventing names.
 *
 * When `check` is set (opened from the edit dialog), the check's id, text
 * and current rule are forwarded too, and each check gets its own
 * conversation so edits to different checks don't mix.
 */
export const AskPortalAssistantButton = ({
  factSchemas,
  check,
}: {
  factSchemas: FactSchema[];
  check?: DynamicCheck;
}) => {
  const enabled = useAssistantEnabled();
  const { openDrawer } = useAssistantDrawer();

  if (!enabled) return null;

  const handleClick = () => {
    const availableFactRetrievers: FactRetriever[] = factSchemas.map(
      schema => ({
        id: schema.id,
        facts: factFieldsOf(schema).map(f => ({
          name: f.name,
          type: f.field.type,
          description: f.field.description,
        })),
      }),
    );

    const overrides: Partial<ChatScope> = {
      caseType: 'check_authoring',
      ...(availableFactRetrievers.length > 0
        ? { availableFactRetrievers }
        : {}),
      ...(check ? editingScope(check) : {}),
    };

    openDrawer({
      scopeOverrides: overrides,
      // Stable key: re-opening this button resumes the same conversation
      // rather than starting a fresh one each time, matching the "generic
      // FAB" convention documented in OpenAssistantOptions.conversationKey.
      // One conversation per edited check, one shared for new checks.
      conversationKey: check
        ? `check_authoring:${check.id}`
        : 'check_authoring',
    });
  };

  return (
    <Button
      variant="outlined"
      size="small"
      color="primary"
      startIcon={<AiSparkleIcon fontSize="small" />}
      onClick={handleClick}
    >
      Ask Portal Assistant
    </Button>
  );
};
