// Tests of the hook that refuses reading secrets from files and environments:
// node --test .claude/hooks/deny-env-read.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const hook = fileURLToPath(new URL('./deny-env-read.sh', import.meta.url))

function run(command, env = process.env) {
  return spawnSync('/bin/sh', [hook], {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
    encoding: 'utf8',
    env,
  })
}

// The decision for one command: 'deny', or 'allow' when the hook prints nothing.
function decision(command) {
  const result = run(command)
  assert.equal(result.status, 0, result.stderr)
  if (result.stdout.trim() === '') return 'allow'
  const output = JSON.parse(result.stdout).hookSpecificOutput
  assert.equal(output.hookEventName, 'PreToolUse')
  return output.permissionDecision
}

const refused = [
  'cat .env',
  'cat deploy/compose/.env',
  'source ./.env.local',
  'grep KEY services/identity/.env.production',
  'cp secrets.env /tmp/',
  'ls -la # also check .env',
  'env',
  'env | grep TOKEN',
  'ls; env',
  'echo "$(env)"',
  'printenv',
  'printenv HOME',
  'cat /proc/self/environ',
  'docker inspect edge',
  'docker container inspect edge',
  'docker compose -f deploy/compose/compose.yaml config',
  'docker compose exec edge env',
]

const allowed = [
  'git status --short',
  'ls deploy/compose',
  "node -e 'console.log(process.env.HOME)'",
  'grep -n import.meta.env apps/authoring/src/main.ts',
  'env FOO=1 npx nx run edge:test',
  'env -u HOME true',
  'NX_TUI=false npx nx run contracts:lint',
  'go env GOPATH',
  'cat docs/environment.md',
  'docker inspect --format "{{.State.Status}}" edge',
  'docker compose ps',
]

for (const command of refused) {
  test(`refuses: ${command}`, () => assert.equal(decision(command), 'deny'))
}

for (const command of allowed) {
  test(`allows: ${command}`, () => assert.equal(decision(command), 'allow'))
}

test('refuses every call when jq is missing', () => {
  const result = run('ls', { PATH: '/nonexistent' })
  assert.equal(result.status, 2)
  assert.match(result.stderr, /needs jq/)
})
