export interface Config {
  techInsights?: {
    scorecards?: {
      /**
       * Names shown for entity kinds, keyed by kind, for example
       * `{ System: Project, Domain: Namespace }`. Kinds without an entry are
       * split into words: `DeploymentPipeline` is shown as "Deployment
       * pipeline".
       * @deepVisibility frontend
       */
      kindLabels?: { [kind: string]: string };
    };
    maturity?: {
      /**
       * Tier names, the same keys the maturity plugin reads. Tiers without a
       * title are shown as Stone, Bronze, Silver and Gold.
       */
      rank?: {
        stone?: {
          /** @visibility frontend */
          title?: string;
        };
        bronze?: {
          /** @visibility frontend */
          title?: string;
        };
        silver?: {
          /** @visibility frontend */
          title?: string;
        };
        gold?: {
          /** @visibility frontend */
          title?: string;
        };
      };
    };
  };
}
