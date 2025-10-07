# Merging Branches

This document explains how to merge between branches for the [yucelz/anyflow](https://github.com/yucelz/anyflow) project.

---

## 🚀 Quick Commands (copy & paste)

```bash

# 1. Make sure you're up to date
git fetch origin

# 2. Switch to the dev branch
git checkout dev

# 3. Make sure dev is current
git pull origin dev

# 4. Merge master into dev
git merge origin/master


# a) Merge master → dev
git fetch --all --prune
git checkout master && git pull origin master
git checkout dev && git pull origin dev
git merge --no-ff origin/master

git push origin dev

# b) Merge dev → pre-prod
git checkout dev && git pull origin dev
git checkout pre-prod && git pull origin pre-prod
git merge --no-ff origin/dev

git push origin pre-prod

# c) Merge pre-prod → release
git checkout pre-prod && git pull origin pre-prod
git checkout release && git pull origin release
git merge --no-ff origin/pre-prod

git push origin release
```

---

## Step 0 — Clone (if not already cloned)
```bash
git clone https://github.com/yucelz/anyflow.git
cd anyflow
```

---

## Step 1 — Fetch and check branches
```bash
git fetch --all --prune
git branch -a
```
- Updates all remote refs.
- Shows local + remote branches so you can confirm `origin/master`, `origin/dev`, `origin/pre-prod`, and `origin/release` exist.

---

## Step 2 — Update local branches before merging
Always pull the latest changes for both the source and target branches before merging.

Example for **master → dev**:
```bash
git checkout master
git pull origin master

git checkout dev
git pull origin dev
```

Repeat the same pattern for other merges (`dev → pre-prod`, `pre-prod → release`).

---

## Step 3 — Backup target branch (recommended)
```bash
git checkout dev
git branch dev-backup-$(date +%Y%m%d)
git push origin dev-backup-$(date +%Y%m%d)
```
- Replace `dev` with `pre-prod` or `release` depending on the merge target.

---

## Step 4 — Perform the merge
- **Master → Dev**:
  ```bash
  git checkout dev
  git merge --no-ff origin/master
  ```
- **Dev → Pre-Prod**:
  ```bash
  git checkout pre-prod
  git merge --no-ff origin/dev
  ```
- **Pre-Prod → Release**:
  ```bash
  git checkout release
  git merge --no-ff origin/pre-prod
  ```

If there are conflicts:
```bash
git status                # list conflicted files
git mergetool             # optional GUI conflict resolution
# or manually edit files
git add <file(s)>
git commit                # complete the merge
```

---

## Step 5 — Verify build/tests
```bash
pnpm install
pnpm test
```
*(Adjust commands for your project’s tooling, e.g. `npm` or `yarn`.)*

---

## Step 6 — Push updated target branch
```bash
git push origin dev       # after master → dev

git push origin pre-prod  # after dev → pre-prod

git push origin release   # after pre-prod → release
```

---

## Alternative: Create a Pull Request (if branch is protected)

1. Go to GitHub → **Pull requests** → **New pull request**.
2. Set **base = target branch**, **compare = source branch**.
3. Create PR and merge after review.

CLI (with GitHub CLI `gh`):
```bash
# Example: master → dev
gh pr create --base dev --head master \
  --title "Merge master into dev" \
  --body "Update dev with latest master"

# Example: dev → pre-prod
gh pr create --base pre-prod --head dev \
  --title "Merge dev into pre-prod" \
  --body "Update pre-prod with latest dev"

# Example: pre-prod → release
gh pr create --base release --head pre-prod \
  --title "Merge pre-prod into release" \
  --body "Update release with latest pre-prod"
```

---

## Optional: Rebase instead of merge
```bash
git checkout dev
git fetch origin
git rebase origin/master

# Resolve conflicts if any:
git rebase --continue

# Push carefully (rewrites history):
git push --force-with-lease origin dev
```
*(Adjust source/target for other branches.)*

---

## Troubleshooting
- **Conflicts:** open files and edit between `<<<<<<<`, `=======`, `>>>>>>>`.
  - Keep target version: `git checkout --ours path/to/file`
  - Keep source version: `git checkout --theirs path/to/file`
- **Failed to push:** someone updated target branch. Run `git pull --rebase` or re-merge.
- **Protected branch:** direct push may be blocked → use PR workflow.

---

## References
- [Git merge documentation](https://git-scm.com/docs/git-merge)
- [Resolving merge conflicts (GitHub Docs)](https://docs.github.com/articles/resolving-a-merge-conflict-using-the-command-line)
- [GitHub CLI – Create PR](https://cli.github.com/manual/gh_pr_create)
