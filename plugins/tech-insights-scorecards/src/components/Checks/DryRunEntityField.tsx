import { useState } from 'react';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import Autocomplete from '@material-ui/lab/Autocomplete';
import { stringifyEntityRef, type Entity } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import useAsync from 'react-use/lib/useAsync';
import useDebounce from 'react-use/lib/useDebounce';
import { useKindDisplay } from '../../kinds';

const RESULT_LIMIT = 20;

interface DryRunEntityFieldProps {
  /** Kinds to search within; every kind when empty. */
  kinds: string[];
  value: string;
  onChange: (entityRef: string) => void;
  error?: string;
}

/**
 * Picks the entity to dry-run against, searching the catalog by name or
 * title as you type. A typed entity ref is also accepted as is.
 */
export function DryRunEntityField({
  kinds,
  value,
  onChange,
  error,
}: DryRunEntityFieldProps) {
  const catalogApi = useApi(catalogApiRef);
  const kindDisplay = useKindDisplay();
  const [term, setTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  useDebounce(() => setDebouncedTerm(term), 250, [term]);
  const kindsKey = kinds.join(',');

  const { value: options = [], loading } = useAsync(async () => {
    const { items } = await catalogApi.queryEntities({
      filter: kindsKey ? { kind: kindsKey.split(',') } : undefined,
      fullTextFilter: debouncedTerm
        ? { term: debouncedTerm, fields: ['metadata.name', 'metadata.title'] }
        : undefined,
      fields: ['kind', 'metadata.name', 'metadata.namespace', 'metadata.title'],
      orderFields: { field: 'metadata.name', order: 'asc' },
      limit: RESULT_LIMIT,
    });
    return items;
  }, [catalogApi, kindsKey, debouncedTerm]);

  return (
    <Autocomplete<Entity, false, false, true>
      freeSolo
      openOnFocus
      options={options}
      loading={loading}
      filterOptions={list => list}
      getOptionLabel={option =>
        typeof option === 'string' ? option : stringifyEntityRef(option)
      }
      renderOption={option => (
        <div>
          <Typography variant="body2">
            {option.metadata.title ?? option.metadata.name}
          </Typography>
          <Typography variant="caption" color="textSecondary">
            {stringifyEntityRef(option)}
          </Typography>
        </div>
      )}
      inputValue={value}
      onInputChange={(_e, next, reason) => {
        onChange(next);
        // A picked option fills in its full ref; searching for that would
        // find nothing, so only typed text becomes the search term.
        if (reason === 'input') setTerm(next.split(/[:/]/).pop() ?? '');
      }}
      renderInput={params => (
        <TextField
          {...params}
          label="Entity to dry-run against"
          placeholder="Search by name, or type an entity ref"
          error={!!error}
          helperText={
            error ??
            (kinds.length > 0
              ? `Showing ${kinds.map(kindDisplay).join(', ')} entities.`
              : 'Showing entities of every kind.')
          }
        />
      )}
    />
  );
}
