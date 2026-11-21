# Git workflow

Never do project work or create commits on `main`. Make each change on its own
branch and merge it into `main` through a pull request.

## Start a change

```sh
git switch main
git pull --ff-only
git switch -c <type>/<short-description>
```

Use a descriptive branch name such as `feat/project-filter`, `fix/mobile-layout`,
or `docs/git-workflow`. If no remote is configured, skip the pull; once a remote
is available, configure it and keep `main` up to date before starting a branch.

## Before opening a pull request

1. Review the change with `git diff` and `git diff --check`.
2. Test the affected pages and interactions in a browser.
3. Commit focused changes on the feature branch with a short, imperative message.
4. Push the branch and open a pull request targeting `main`.
5. Merge through the pull request after review and any applicable checks pass.

Do not push directly to `main`. When hosting this repository on a platform that
supports branch rules, protect `main` by requiring pull requests and disallowing
direct pushes.

## Install the local commit guard

The tracked hooks reject commits on `main` or detached `HEAD`, and pushes
to or from `main`. Enable them once in each clone:

```sh
git config core.hooksPath .githooks
```

These hooks are local safeguards; the pull-request workflow and remote branch
protection are still necessary to prevent direct changes or pushes elsewhere.
