# Merging `master` into `dev`

This document explains how to merge the **`master`** branch into **`dev`** for the [yucelz/anyflow](https://github.com/yucelz/anyflow) project.

---

## 🚀 Quick Commands (copy & paste)

```bash
git fetch --all --prune
git checkout master && git pull origin master
git checkout dev && git pull origin dev
git checkout dev
git merge --no-ff origin/master
# (resolve conflicts if any, then:)
git push origin dev
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
- Shows local + remote branches so you can confirm `origin/master` and `origin/dev` exist.

---

## Step 2 — Update local branches
```bash
git checkout master
git pull origin master

git checkout dev
git pull origin dev
```
- Ensures you’re merging the **latest** versions.

---

## Step 3 — Inspect upcoming changes
```bash
git log --oneline dev..origin/master        # commits in master but not dev
git diff --name-status dev..origin/master   # files changed
```

---

## Step 4 — Backup `dev` branch (recommended)
```bash
git checkout dev
git branch dev-backup-$(date +%Y%m%d)
git push origin dev-backup-$(date +%Y%m%d)
```
- Creates a dated backup in case rollback is needed.

---

## Step 5 — Merge `master` → `dev`
```bash
git checkout dev
git merge --no-ff origin/master
```
- Brings all `master` changes into `dev`.
- If there are conflicts:
  ```bash
  git status                # list conflicted files
  git mergetool             # optional GUI conflict resolution
  # or manually edit files
  git add <file(s)>
  git commit                # complete the merge
  ```

---

## Step 6 — Verify build/tests
```bash
pnpm install
pnpm test
```
*(Adjust commands for your project’s tooling, e.g. `npm` or `yarn`.)*

---

## Step 7 — Push updated `dev`
```bash
git push origin dev
```

---

## Alternative: Create a Pull Request (if branch is protected)

1. Go to GitHub → **Pull requests** → **New pull request**.  
2. Set **base = dev**, **compare = master**.  
3. Create PR and merge after review.

CLI (with GitHub CLI `gh`):
```bash
gh pr create --base dev --head master \
  --title "Merge master into dev" \
  --body "Update dev with latest master"
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

---

## Troubleshooting
- **Conflicts:** open files and edit between `<<<<<<<`, `=======`, `>>>>>>>`.  
  - Keep dev version: `git checkout --ours path/to/file`  
  - Keep master version: `git checkout --theirs path/to/file`  
- **Failed to push:** someone updated `dev`. Run `git pull --rebase` or re-merge.  
- **Protected branch:** direct push may be blocked → use PR workflow.

---

## References
- [Git merge documentation](https://git-scm.com/docs/git-merge)  
- [Resolving merge conflicts (GitHub Docs)](https://docs.github.com/articles/resolving-a-merge-conflict-using-the-command-line)  
- [GitHub CLI – Create PR](https://cli.github.com/manual/gh_pr_create)

