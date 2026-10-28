---
'@openchoreo/backstage-plugin-common': minor
'@openchoreo/backstage-plugin-catalog-backend-module': patch
---

Synced Components now carry `backstage.io/source-location` in the form
Backstage itself writes, `url:<repo>/tree/<branch>/<appPath>`, instead of the
bare repository URL. Tools that read the standard annotation (the "View
source" link, Tech Insights fact retrievers) get the branch and the
component's folder without an OpenChoreo-specific annotation.
`openchoreo.io/branch` is still written, because a branch name containing `/`
can't be told apart from the folder after it in a URL.

`getRepositoryUrl()` changes to match:

- it no longer assumes `main` when the branch is unknown, and returns the
  repository URL instead;
- with a branch but no app path it returns `<repo>/tree/<branch>` rather than
  the bare repository URL;
- it strips a trailing `.git` from the repository URL and a leading `./` or
  `/` from the app path.
