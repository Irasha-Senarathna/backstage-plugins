import { useRouteRef } from '@backstage/core-plugin-api';
import { entityRouteRef } from '@backstage/plugin-catalog-react';
import { getCompoundEntityRef, type Entity } from '@backstage/catalog-model';
import { DEFAULT_ENTITY_TAB_PATH } from '../routes';

/** Links to an entity's scorecard tab. */
export function useEntityTabLink(): (entity: Entity) => string {
  const entityRoute = useRouteRef(entityRouteRef);
  return entity => {
    const ref = getCompoundEntityRef(entity);
    return `${entityRoute({
      kind: ref.kind.toLocaleLowerCase('en-US'),
      namespace: ref.namespace,
      name: ref.name,
    })}${DEFAULT_ENTITY_TAB_PATH}`;
  };
}
