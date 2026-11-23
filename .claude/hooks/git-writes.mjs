#!/usr/bin/env node
// PreToolUse hook for Bash and EnterWorktree: only the owner of the repository writes to Git
// (CLAUDE.md, "Repository rules"). It refuses the Git commands that write, such as commit, tag,
// push, add, checkout and branch changes, the GitHub CLI commands that write, and the
// EnterWorktree tool. Reading, fetch, pull and clone pass. Exit code 2 refuses the call and shows
// the reason to the agent.
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

const ALWAYS_WRITES = new Set([
  'commit', 'push', 'merge', 'rebase', 'cherry-pick', 'revert', 'am', 'reset', 'add', 'stage', 'rm', 'mv',
  'restore', 'checkout', 'switch', 'clean', 'init', 'commit-tree', 'update-ref', 'update-index', 'read-tree',
  'write-tree', 'filter-branch', 'filter-repo', 'replace', 'gc', 'prune', 'repack', 'maintenance', 'pack-refs',
  'mktag', 'mktree',
])

const GH_WRITES = {
  pr: ['create', 'merge', 'close', 'reopen', 'edit', 'ready', 'comment', 'review', 'lock', 'unlock', 'checkout', 'revert', 'update-branch'],
  issue: ['create', 'close', 'reopen', 'edit', 'comment', 'delete', 'transfer', 'lock', 'unlock', 'pin', 'unpin', 'develop'],
  release: ['create', 'edit', 'delete', 'delete-asset', 'upload'],
  repo: ['create', 'delete', 'edit', 'rename', 'archive', 'unarchive', 'fork', 'sync', 'set-default', 'deploy-key'],
  secret: ['set', 'delete', 'remove'],
  variable: ['set', 'delete'],
  label: ['create', 'edit', 'delete', 'clone'],
  workflow: ['run', 'enable', 'disable'],
  run: ['rerun', 'cancel', 'delete'],
  gist: ['create', 'edit', 'delete', 'rename'],
  cache: ['delete'],
}

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

function gitWrite(sub, args) {
  if (ALWAYS_WRITES.has(sub)) return true
  const first = args[0]
  switch (sub) {
    case 'stash': return !['list', 'show'].includes(first)
    case 'worktree': return first !== 'list'
    case 'notes': return first !== undefined && !['list', 'show'].includes(first)
    case 'reflog': return ['expire', 'delete'].includes(first)
    case 'remote': return ['add', 'remove', 'rm', 'rename', 'set-url', 'set-head', 'set-branches', 'prune'].includes(first)
    case 'submodule':
      return ['add', 'deinit', 'set-branch', 'set-url', 'sync', 'absorbgitdirs'].includes(first) ||
        (first === 'update' && hasAny(args, ['--remote']))
    case 'sparse-checkout': return first !== 'list'
    case 'bisect': return !['log', 'view', 'visualize', 'visualise'].includes(first)
    case 'symbolic-ref': return hasAny(args, ['-d', '--delete']) || positionals(args).length >= 2
    case 'hash-object': return hasAny(args, ['-w'])
    case 'apply': return hasAny(args, ['--index', '--cached', '-3', '--3way'])
    case 'tag': {
      const writes = ['-a', '--annotate', '-s', '--sign', '-u', '--local-user', '-f', '--force', '-d', '--delete',
        '-m', '--message', '-F', '--file', '-e', '--edit', '--create-reflog', '--cleanup', '--trailer']
      const lists = ['-l', '--list', '-v', '--verify', '-n', '--contains', '--no-contains', '--merged', '--no-merged', '--points-at']
      const withValue = ['--contains', '--no-contains', '--merged', '--no-merged', '--points-at', '--sort', '--format', '--color', '--column']
      return hasAny(args, writes) || (positionals(args, withValue).length > 0 && !hasAny(args, lists))
    }
    case 'branch': {
      const writes = ['-d', '-D', '--delete', '-m', '-M', '--move', '-c', '-C', '--copy', '-f', '--force', '-u',
        '--set-upstream-to', '--unset-upstream', '--edit-description', '-t', '--track', '--no-track',
        '--create-reflog', '--recurse-submodules']
      const lists = ['-l', '--list', '-a', '--all', '-r', '--remotes', '-v', '--verbose', '--contains', '--no-contains',
        '--merged', '--no-merged', '--points-at', '--show-current', '--format', '--sort', '--column']
      const withValue = ['--contains', '--no-contains', '--merged', '--no-merged', '--points-at', '--sort', '--format', '--color', '--column', '--abbrev']
      return hasAny(args, writes) || (positionals(args, withValue).length > 0 && !hasAny(args, lists))
    }
    case 'config': {
      if (['set', 'unset', 'rename-section', 'remove-section', 'edit'].includes(first)) return true
      if (hasAny(args, ['--add', '--unset', '--unset-all', '--replace-all', '--rename-section', '--remove-section', '-e', '--edit'])) return true
      if (['get', 'list'].includes(first)) return false
      if (hasAny(args, ['--get', '--get-all', '--get-regexp', '--get-urlmatch', '--list', '-l'])) return false
      return positionals(args, ['--file', '-f', '--blob', '--type', '--default', '--comment']).length >= 2
    }
    default: return false
  }
}

// Returns the refused command, such as "gh pr create", or null.
function ghWrite(tokens) {
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
    return writes ? 'gh api' : null
  }
  return (GH_WRITES[group] ?? []).includes(action) ? `gh ${group} ${action}` : null
}

// Returns the refused command, such as "git commit", or null when the command line writes nothing.
export function refusedCommand(commandLine) {
  for (const match of commandLine.matchAll(INVOCATION)) {
    const tool = match[2]
    const rest = commandLine.slice(match.index + match[0].length).split(END_OF_SIMPLE_COMMAND)[0]
    const tokens = rest.trim().split(/\s+/).filter(Boolean).map(unquote)
    if (tool === 'gh') {
      const label = ghWrite(tokens)
      if (label) return label
      continue
    }
    let i = 0
    while (i < tokens.length && tokens[i].startsWith('-')) i += GLOBAL_WITH_VALUE.has(tokens[i]) ? 2 : 1
    const sub = tokens[i]
    if (sub !== undefined && gitWrite(sub, tokens.slice(i + 1))) return `git ${sub}`
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
  const rule = 'Only the owner of the repository writes to Git (CLAUDE.md, "Repository rules"). ' +
    'Leave the change in the working tree, report the changed files and propose the commit message.'
  if (input.tool_name === 'EnterWorktree') {
    console.error(`Blocked: a worktree is a Git write. ${rule}`)
    process.exit(2)
  }
  const refused = input.tool_name === 'Bash' ? refusedCommand(input.tool_input?.command ?? '') : null
  if (refused) {
    console.error(`Blocked: "${refused}" writes to Git or GitHub. Reading, fetch, pull and clone are allowed. ${rule}`)
    process.exit(2)
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main()
