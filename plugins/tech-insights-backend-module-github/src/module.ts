import { createBackendModule } from '@backstage/backend-plugin-api';
import { techInsightsFactRetrieversExtensionPoint } from '@backstage-community/plugin-tech-insights-node';
import { githubRepoMetadataFactRetriever } from './githubRepoMetadataFactRetriever';
import { githubCodeScanningFactRetriever } from './githubCodeScanningFactRetriever';

export const techInsightsModuleGithub = createBackendModule({
  pluginId: 'tech-insights',
  moduleId: 'github',
  register(reg) {
    reg.registerInit({
      deps: {
        factRetrievers: techInsightsFactRetrieversExtensionPoint,
      },
      async init({ factRetrievers }) {
        factRetrievers.addFactRetrievers({
          githubRepoMetadataFactRetriever,
          githubCodeScanningFactRetriever,
        });
      },
    });
  },
});
