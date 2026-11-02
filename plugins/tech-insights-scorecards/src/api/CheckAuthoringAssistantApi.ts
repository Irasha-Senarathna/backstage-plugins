import type { ComponentType } from 'react';
import { createApiRef } from '@backstage/core-plugin-api';
import type { DynamicCheck, FactSchema } from './types';

/**
 * Optional slot for an AI assistant that helps write checks. When a host app
 * provides it, the check list shows `LaunchButton` next to "New check" and
 * in the edit dialog; otherwise nothing is rendered. Lets an assistant plugin
 * plug in without this plugin depending on it.
 */
export interface CheckAuthoringAssistantApi {
  /**
   * Rendered next to "New check" and when editing a check; receives the fact
   * schemas already loaded, plus the check being edited (absent for new checks).
   */
  LaunchButton: ComponentType<{
    factSchemas: FactSchema[];
    check?: DynamicCheck;
  }>;
}

export const checkAuthoringAssistantApiRef =
  createApiRef<CheckAuthoringAssistantApi>({
    id: 'plugin.tech-insights-scorecards.check-authoring-assistant',
  });
