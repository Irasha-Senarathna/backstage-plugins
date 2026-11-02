import { useApiHolder } from '@backstage/core-plugin-api';
import { checkAuthoringAssistantApiRef } from '../../api/CheckAuthoringAssistantApi';
import type { DynamicCheck, FactSchema } from '../../api/types';
import { useEntityLabel } from '../../kinds';
import { CheckForm } from '../Checks/CheckForm';
import { FullPageView } from '../FullPageView';

interface CheckEditPageProps {
  check: DynamicCheck | null;
  factSchemas: FactSchema[];
  existingCategories: string[];
  onBack: () => void;
  onSaved: (check: DynamicCheck) => void;
  onPublished: () => void;
}

/**
 * Full-page create/edit view, swapped in by ScorecardsPage in place of the
 * checks table. Save and Publish stay inside CheckForm, so Cancel, the back
 * arrow and Esc all leave the editor the same way.
 */
export function CheckEditPage(props: CheckEditPageProps) {
  const {
    check,
    factSchemas,
    existingCategories,
    onBack,
    onSaved,
    onPublished,
  } = props;
  const entityLabel = useEntityLabel();

  // Optional: only present when a host app installs a check-authoring assistant.
  const assistant = useApiHolder().get(checkAuthoringAssistantApiRef);

  return (
    <FullPageView
      title={check ? `Edit check: ${check.name}` : 'New check'}
      subtitle={`Define the check, dry-run it against a sample ${entityLabel.singular}, then save or publish.`}
      onBack={onBack}
    >
      {assistant && check && (
        <div
          style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}
        >
          <assistant.LaunchButton factSchemas={factSchemas} check={check} />
        </div>
      )}
      <CheckForm
        key={check?.id ?? 'new'}
        check={check}
        factSchemas={factSchemas}
        existingCategories={existingCategories}
        onSaved={onSaved}
        onPublished={onPublished}
        showTitle={false}
        onCancel={onBack}
      />
    </FullPageView>
  );
}
