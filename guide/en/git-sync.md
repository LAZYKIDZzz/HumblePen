# Sync notes to GitHub

[简体中文](../git-sync.md)

Create your repository from the public template or copy the template files into a new repository. Choose visibility based on how you will deploy the site. The default branch is `main`. Give the local task only the Git access it needs and store credentials in your system credential manager or SSH configuration.

If starting from a local template directory, create an empty GitHub repository and check its visibility. Review and create the initial local commit, then set your remote.

```sh
git remote add origin 'git@github.com:<OWNER>/<REPOSITORY>.git'
git remote get-url --push origin
git push -u origin main
```

Clones already have an `origin`. Check where it points before pushing.

## Daily sync

Review the changes in the correct checkout. Check that all sources are redacted and each changed file is part of the daily content. Review new files individually.

```sh
npm run check
git status --short
git diff
git add -- en/docs/skills/SK-005.md en/docs/skill-index.md en/daily/2026-01-02.md
npm run check:staged
git diff --cached
git commit -m "docs: update knowledge notes"
git push origin HEAD:refs/heads/main
```

Replace the example paths, date, and ID with the files changed by the run. If the batch also contains Chinese notes, stage only the Chinese files it changed. Skip the commit if nothing changed. The staged check is for routine note updates. Use full repository review and CI checks for the initial template commit or site changes. Follow your repository's pull request policy. For public repositories, review content before uploading any branch or opening a pull request. Preserve local changes when resolving conflicts.

## Automatic sync to a private repository

Enable automatic sync only with explicit user authorization. Pin the target `<OWNER>/<REPOSITORY>`, remote `origin`, and branch `main` in the private task configuration. Sign in to GitHub CLI. Check that the fetch and push URLs for `origin` point to the configured repository, then run `gh repo view <OWNER>/<REPOSITORY> --json nameWithOwner,visibility` and confirm the visibility is `PRIVATE`. Repeat the checks before each push. Keep changes local when any information is missing or differs.

Use a dedicated, clean checkout. Record HEAD at the beginning of the run and confirm the local branch matches the configured remote. Review the content, stage only the intended paths, and run both checks before committing and pushing to the configured target. If the push is rejected or the remote has advanced, keep the local commit and report the issue. Server-side publishing uses a read-only fetch.
