// Tests of the hook that refuses history writes: node --test .claude/hooks/git-writes.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { refusedCommand } from './git-writes.mjs'

const refused = {
  'git add .': 'git add',
  'git -C platform/edge add docs': 'git add',
  'git rm --cached x': 'git rm',
  'git mv a b': 'git mv',
  'git commit -m "x"': 'git commit',
  'git -C platform/edge commit -am x': 'git commit',
  'git -c user.name=a commit -m x': 'git commit',
  'git tag v0.1.0': 'git tag',
  'git tag -a v0.1.0 -m release': 'git tag',
  'git tag -d v0.1.0': 'git tag',
  'cd platform/edge && git push origin main': 'git push',
  'git push --tags': 'git push',
  'git merge t05': 'git merge',
  'git rebase main': 'git rebase',
  'git cherry-pick abc123': 'git cherry-pick',
  'git revert HEAD': 'git revert',
  'git reset --hard HEAD': 'git reset',
  'git stash': 'git stash',
  'git stash pop': 'git stash',
  'git branch -f main HEAD~1': 'git branch',
  'git branch -D t05': 'git branch',
  'git submodule add ../x.git x': 'git submodule',
  'git apply --index fix.patch': 'git apply',
  'ls; /usr/bin/git commit -m x': 'git commit',
  'echo "$(git commit -m x)"': 'git commit',
  "bash -c 'git push'": 'git push',
  "git submodule foreach 'git commit -am x'": 'git commit',
  'gh pr merge 12 --squash': 'gh pr merge',
  'gh release create v1': 'gh release create',
  'gh repo sync': 'gh repo sync',
  'gh repo create o/x --source . --push': 'gh repo create --push',
  'gh api -X PUT repos/o/r/contents/README.md -f message=x': 'gh api',
  'gh api repos/o/r/git/refs -f ref=refs/heads/x -f sha=abc': 'gh api',
  'gh api -X PUT repos/o/r/pulls/12/merge': 'gh api',
}

const allowed = [
  'git status --short',
  'git -C platform/edge log --oneline -5',
  'git diff HEAD~1',
  'git fetch origin',
  'git pull --ff-only',
  'git clone ../x.git /tmp/x',
  'git worktree add -b t05 .claude/worktrees/t05',
  'git worktree remove .claude/worktrees/t05',
  'git branch t05',
  'git branch -d t05',
  'git checkout -b t05',
  'git switch main',
  'git restore README.md',
  'git submodule update --init',
  'git submodule update --remote',
  'git config user.name someone',
  'git remote add up ../x.git',
  'git init /tmp/x',
  'git stash list',
  'git tag',
  'git tag -l "v*"',
  'git tag --contains HEAD',
  "grep -n 'git push' notes.md",
  'ls .git/hooks',
  'gh pr create --fill',
  'gh pr comment 12 --body ok',
  'gh pr checkout 12',
  'gh issue create --title x --body y',
  'gh label create bug',
  'gh repo view o/r --json visibility',
  'gh api repos/o/r',
  'gh api repos/o/r/issues -f title=x',
  'gh api -X PATCH repos/o/r/issues/3 -f state=closed',
]

for (const [command, expected] of Object.entries(refused)) {
  test(`refuses ${command}`, () => assert.equal(refusedCommand(command), expected))
}
for (const command of allowed) {
  test(`allows ${command}`, () => assert.equal(refusedCommand(command), null))
}
