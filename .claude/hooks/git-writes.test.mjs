// Tests of the hook that refuses Git writes: node --test .claude/hooks/git-writes.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { refusedCommand } from './git-writes.mjs'

const refused = {
  'git commit -m "x"': 'git commit',
  'git -C platform/edge commit -am x': 'git commit',
  'git -c user.name=a commit -m x': 'git commit',
  'cd platform/edge && git push origin main': 'git push',
  'git tag v0.1.0': 'git tag',
  'git tag -a v0.1.0 -m release': 'git tag',
  'git tag -d v0.1.0': 'git tag',
  'git add .': 'git add',
  'git checkout -b t05': 'git checkout',
  'git switch main': 'git switch',
  'git branch t05': 'git branch',
  'git branch -D t05': 'git branch',
  'git stash': 'git stash',
  'git stash pop': 'git stash',
  'git worktree add ../x': 'git worktree',
  'git submodule add ../x.git x': 'git submodule',
  'git submodule update --remote': 'git submodule',
  'git reset --hard HEAD': 'git reset',
  'git merge t05': 'git merge',
  'git rebase main': 'git rebase',
  'git config user.name someone': 'git config',
  'git config --unset user.name': 'git config',
  'git remote add up ../x.git': 'git remote',
  'git init .': 'git init',
  'ls; /usr/bin/git commit -m x': 'git commit',
  'echo "$(git commit -m x)"': 'git commit',
  "bash -c 'git push'": 'git push',
  "git submodule foreach 'git commit -am x'": 'git commit',
  'gh pr create --fill': 'gh pr create',
  'gh release create v1': 'gh release create',
  'gh api -X POST repos/o/r/issues': 'gh api',
  'gh api repos/o/r/issues -f title=x': 'gh api',
}

const allowed = [
  'git status --short',
  'git -C platform/edge log --oneline -5',
  'git diff HEAD~1',
  'git show HEAD:CLAUDE.md',
  'git ls-files',
  'git fetch origin',
  'git pull --ff-only',
  'git clone ../x.git /tmp/x',
  'git tag',
  'git tag -l "v*"',
  'git tag --contains HEAD',
  'git branch',
  'git branch -a',
  'git branch --list "t*"',
  'git branch --merged main',
  'git stash list',
  'git worktree list',
  'git submodule status',
  'git submodule update --init',
  'git config --get user.name',
  'git config user.name',
  'git config --list',
  'git remote -v',
  'git remote get-url origin',
  'git rev-parse HEAD',
  "grep -n 'git push' notes.md",
  'ls .git/hooks',
  'cat docs/.gitignore',
  'gh repo view o/r --json visibility',
  'gh pr list',
  'gh api repos/o/r',
]

for (const [command, expected] of Object.entries(refused)) {
  test(`refuses ${command}`, () => assert.equal(refusedCommand(command), expected))
}
for (const command of allowed) {
  test(`allows ${command}`, () => assert.equal(refusedCommand(command), null))
}
