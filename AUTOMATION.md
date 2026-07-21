# Automation Publishing Rules

Daily blog automation must publish through the guarded script:

```sh
scripts/automation-publish-current.sh
```

Do not finish with a direct `git push origin main` from the current worktree. This repository can be opened by automation in a detached HEAD or linked worktree whose Git metadata cannot safely fetch or rebase. The guarded script avoids that failure mode by cloning the latest remote `main`, cherry-picking the current committed article, running validation, rebasing if needed, and retrying one rejected push.

If the script fails, report the exact error and stop. Do not create another detached commit on top of an unpublished local chain.
