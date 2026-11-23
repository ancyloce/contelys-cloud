#!/usr/bin/env node
// PreToolUse hook for Bash: only the owner of the repository writes history (CLAUDE.md,
// "Repository rules"). It refuses the Git commands that stage, commit, stash, reset, merge,
// rebase, cherry-pick, revert, create or delete a tag, force a branch to move, or push, and the
// GitHub CLI commands that do the same on GitHub: merging a pull request, a release's tag,
// syncing a fork, and API writes to Git data, file contents and merges. Everything else passes,
// worktrees, branches, checkouts, issues and pull request creation included. Exit code 2
// refuses the call and shows the reason to the agent.
//
// It matches the text of a command, so it stops ordinary and accidental writes, not deliberate
// evasion: a Git alias or a command assembled at run time passes.

import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

// A Git or gh invocation starts at the beginning of the command, after whitespace, after a
// separator or a command substitution, optionally behind a directory path or a backslash.
// A quote in front does not start one, so `grep 'git push'` passes.
const INVOCATION = /(^|[\s;&|(`])\\?(?:[^\s;&|()`'"]*\/)?(git|gh)(?=\s|$)/g
const END_OF_SIMPLE_COMMAND = /[;&|()\n`]/
// Wrappers whose quoted argument is itself a command line.
const WRAPPED = /(?:\b(?:ba|z|da)?sh\s+-[A-Za-z]*c[A-Za-z]*|\beval|\bforeach)\s+(['"])([\s\S]*?)\1/g

const GLOBAL_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--config-env'])

// Subcommands that always stage, commit, move history or publish it.
const HISTORY_WRITES = new Set([
  'add', 'stage', 'rm', 'mv', 'update-index', 'commit', 'commit-tree', 'push', 'merge', 'rebase',
  'cherry-pick', 'revert', 'am', 'reset', 'update-ref', 'filter-branch', 'filter-repo', 'replace', 'mktag',
])

// GitHub CLI commands that merge, tag or push on GitHub.
const GH_HISTORY_WRITES = {
  pr: ['merge', 'update-branch', 'revert'],
  release: ['create', 'edit', 'delete'],
  repo: ['sync'],
}
// API endpoints that write Git data, file contents, merges or releases.
const GH_API_HISTORY = /(^|\/)(git\/(refs|tags|commits|trees|blobs)|contents|merges|merge-upstream|update-branch|releases)(\/|$)|\/pulls\/\d+\/merge$/
const GH_API_WITH_VALUE = ['-X', '--method', '-f', '-F', '--field', '--raw-field', '-H', '--header', '--input',
  '-q', '--jq', '-t', '--template', '--hostname', '-p', '--preview', '--cache']

const unquote = (token) => token.replace(/^['"]+|['"]+$/g, '')

// True when a token is the flag: `--long`, `--long=value`, or a short flag alone or combined (`-av`).
function isFlag(token, flag) {
  if (flag.startsWith('--')) return token === flag || token.startsWith(`${flag}=`)
  return /^-[^-]/.test(token) && token.slice(1).includes(flag.slice(1))
}
const hasAny = (args, flags) => args.some((token) => flags.some((flag) => isFlag(token, flag)))

// The arguments that are not options, skipping the value of an option that takes a separate one.
function positionals(args, optionsWithValue = []) {
  const result = []
  for (let i = 0; i < args.length; i += 1) {
    if (optionsWithValue.includes(args[i])) i += 1
    else if (!args[i].startsWith('-')) result.push(args[i])
  }
  return result
}

function gitHistoryWrite(sub, args) {
  if (HISTORY_WRITES.has(sub)) return true
  const first = args[0]
  switch (sub) {
    // A stash is a commit; listing and showing stashes write nothing.
    case 'stash': return !['list', 'show'].includes(first)
    case 'notes': return first !== undefined && !['list', 'show'].includes(first)
    case 'apply': return hasAny(args, ['--index', '--cached', '-3', '--3way'])
    case 'submodule': return first === 'add'
    // The forced forms move or drop a branch that may hold history.
    case 'branch': return hasAny(args, ['-f', '--force', '-D', '-M', '-C'])
    case 'tag': {
      const writes = ['-a', '--annotate', '-s', '--sign', '-u', '--local-user', '-f', '--force', '-d', '--delete',
        '-m', '--message', '-F', '--file', '-e', '--edit', '--create-reflog', '--cleanup', '--trailer']
      const lists = ['-l', '--list', '-v', '--verify', '-n', '--contains', '--no-contains', '--merged', '--no-merged', '--points-at']
      const withValue = ['--contains', '--no-contains', '--merged', '--no-merged', '--points-at', '--sort', '--format', '--color', '--column']
      return hasAny(args, writes) || (positionals(args, withValue).length > 0 && !hasAny(args, lists))
    }
    default: return false
  }
}

// Returns the refused command, such as "gh pr merge", or null.
function ghHistoryWrite(tokens) {
  let i = 0
  while (i < tokens.length && tokens[i].startsWith('-')) i += ['-R', '--repo', '--hostname'].includes(tokens[i]) ? 2 : 1
  const [group, action] = tokens.slice(i)
  if (group === 'api') {
    const args = tokens.slice(i + 1)
    const at = args.findIndex((token) => token === '-X' || token === '--method' || token.startsWith('--method=') || /^-X./.test(token))
    let method
    if (at >= 0) {
      const token = args[at]
      method = token.startsWith('--method=') ? token.slice(9) : /^-X./.test(token) ? token.slice(2) : args[at + 1]
    }
    const writes = method ? method.toUpperCase() !== 'GET' : hasAny(args, ['-f', '-F', '--field', '--raw-field', '--input'])
    const [endpoint = ''] = positionals(args, GH_API_WITH_VALUE)
    return writes && GH_API_HISTORY.test(endpoint.split('?')[0]) ? 'gh api' : null
  }
  if (group === 'repo' && action === 'create' && hasAny(tokens, ['--push'])) return 'gh repo create --push'
  return (GH_HISTORY_WRITES[group] ?? []).includes(action) ? `gh ${group} ${action}` : null
}

// Returns the refused command, such as "git commit", or null when the command line writes no history.
export function refusedCommand(commandLine) {
  for (const match of commandLine.matchAll(INVOCATION)) {
    const tool = match[2]
    const rest = commandLine.slice(match.index + match[0].length).split(END_OF_SIMPLE_COMMAND)[0]
    const tokens = rest.trim().split(/\s+/).filter(Boolean).map(unquote)
    if (tool === 'gh') {
      const label = ghHistoryWrite(tokens)
      if (label) return label
      continue
    }
    let i = 0
    while (i < tokens.length && tokens[i].startsWith('-')) i += GLOBAL_WITH_VALUE.has(tokens[i]) ? 2 : 1
    const sub = tokens[i]
    if (sub !== undefined && gitHistoryWrite(sub, tokens.slice(i + 1))) return `git ${sub}`
  }
  for (const match of commandLine.matchAll(WRAPPED)) {
    const inner = refusedCommand(match[2])
    if (inner) return inner
  }
  return null
}

function main() {
  let input
  try {
    input = JSON.parse(readFileSync(0, 'utf8'))
  } catch (error) {
    console.error(`git-writes hook: cannot read the hook input (${error.message}), so the call is not checked`)
    process.exit(1)
  }
  const refused = input.tool_name === 'Bash' ? refusedCommand(input.tool_input?.command ?? '') : null
  if (refused) {
    console.error(`Blocked: "${refused}" writes history. Only the owner of the repository stages, commits, ` +
      'tags, merges and pushes (CLAUDE.md, "Repository rules"). Leave the change unstaged, report the ' +
      'changed files and propose the commit message.')
    process.exit(2)
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main()
