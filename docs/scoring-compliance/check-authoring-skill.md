# Check-Authoring Skill: json-rules-engine Syntax

This document teaches an AI agent how to write valid checks for this
platform's Tech Insights system. A "check" evaluates one or more Facts
about a catalog entity and returns true/false.

## 1. Grammar Rules

A check's `rule.conditions` is a JSON object. It must follow these rules
exactly:

- The root object must contain exactly ONE of these keys: `all`, `any`,
  `not`, or `condition`.
  - `all`: every nested condition must be true (AND logic)
  - `any`: at least one nested condition must be true (OR logic)
- Under `all`/`any`, provide an ARRAY of conditions.
- Each individual (leaf) condition is an object with exactly three keys:
  - `fact` (string) — must be one of the fact names listed in Section 2
  - `operator` (string) — e.g. `equal`, `notEqual`, `lessThan`,
    `greaterThan`, `contains`
  - `value` — the value to compare against (type must match the fact's
    type)
- `all`/`any` can be nested inside each other for compound logic.

A full check object (what gets saved) also needs:
- `name` (string, required)
- `factIds` (array of strings, required) — which fact retriever(s) this
  check needs; must include the retriever that owns every fact you
  reference in `rule.conditions`
- `description` (string, optional)
- `rule` (object, required) — contains `conditions` as described above

## 2. Available Facts

Only use fact names from this table. Do not invent new fact names.

| factIds value (retriever) | fact name | type | meaning |
|---|---|---|---|
| `githubRepoMetadataFactRetriever` | `githubIsArchived` | boolean | repository is archived on GitHub |
| `githubRepoMetadataFactRetriever` | `githubVisibility` | string (`public`\|`private`\|`internal`) | repository visibility |
| `githubRepoMetadataFactRetriever` | `githubOpenIssuesCount` | integer | number of open issues |
| `githubRepoMetadataFactRetriever` | `githubDefaultBranchProtected` | boolean | default branch has branch protection enabled |
| `githubRepoMetadataFactRetriever` | `githubTargetBranchProtected` | boolean | branch named by the github.com/branch-protection-target annotation has branch protection enabled |
| `entityMetadataFactRetriever` | `hasTitle` | boolean | entity has a title in metadata |
| `entityMetadataFactRetriever` | `hasDescription` | boolean | entity has a description in metadata |
| `entityMetadataFactRetriever` | `hasTags` | boolean | entity has tags in metadata |
| `entityOwnershipFactRetriever` | `hasOwner` | boolean | `spec.owner` field is set |
| `entityOwnershipFactRetriever` | `hasGroupOwner` | boolean | `spec.owner` is set and refers to a group |
| `techdocsFactRetriever` | `hasAnnotationBackstageIoTechdocsRef` | boolean | entity has a TechDocs reference annotation |
| `techdocsFactRetriever` | `hasAnnotationBackstageIoTechdocsEntity` | boolean | entity has a TechDocs entity annotation |

## 3. Worked Example

User request: "Make sure the repository isn't archived."

```json
{
  "name": "Repo not archived",
  "description": "Fails if the component's GitHub repository has been archived",
  "factIds": ["githubRepoMetadataFactRetriever"],
  "rule": {
    "conditions": {
      "all": [
        { "fact": "githubIsArchived", "operator": "equal", "value": false }
      ]
    }
  }
}
```

A compound example — "must have an owner AND not be archived":

```json
{
  "name": "Owned and active repo",
  "factIds": ["entityOwnershipFactRetriever", "githubRepoMetadataFactRetriever"],
  "rule": {
    "conditions": {
      "all": [
        { "fact": "hasOwner", "operator": "equal", "value": true },
        { "fact": "githubIsArchived", "operator": "equal", "value": false }
      ]
    }
  }
}
```

## 4. Common Mistakes to Avoid

- Never write a leaf condition at the root without wrapping it in `all`
  or `any` — `{ "fact": ..., "operator": ..., "value": ... }` alone is
  invalid; it must be `{ "all": [{ "fact": ..., "operator": ..., "value": ... }] }`.
- Never invent a fact name — only use names from the table in Section 2.
- Every fact you reference in `rule.conditions` must have its owning
  retriever listed in `factIds`, or the check cannot resolve it.
- This is plain JSON only — not Rego, not YAML, not Kyverno/CEL syntax.
- `value`'s type must match the fact's type (e.g. don't compare
  `githubOpenIssuesCount` to a string).
