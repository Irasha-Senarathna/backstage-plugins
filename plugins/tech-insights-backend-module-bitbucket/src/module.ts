import { createBackendModule } from '@backstage/backend-plugin-api';
import { techInsightsFactRetrieversExtensionPoint } from '@backstage-community/plugin-tech-insights-node';
import { bitbucketRepoMetadataFactRetriever } from './bitbucketRepoMetadataFactRetriever';

export const techInsightsModuleBitbucket = createBackendModule({
  pluginId: 'tech-insights',
  moduleId: 'bitbucket',
  register(reg) {
    reg.registerInit({
      deps: {
        factRetrievers: techInsightsFactRetrieversExtensionPoint,
      },
      async init({ factRetrievers }) {
        factRetrievers.addFactRetrievers({
          bitbucketRepoMetadataFactRetriever,
        });
      },
    });
  },
});
