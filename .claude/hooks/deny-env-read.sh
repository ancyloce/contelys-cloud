#!/bin/sh
# PreToolUse hook for Bash: never read a .env file or print a process's environment, because they
# hold secrets (CLAUDE.md, "Shell conventions"). It refuses a command that names a .env file, or
# that would print a process's or a container's environment, where env_file values end up. The
# JavaScript identifiers process.env and import.meta.env pass. Adapted from the owner's user-level
# hook ~/.claude/hooks/deny-env-read.sh, written for another repository on 2026-10-25.
#
# It matches the text of the whole command, comments and quoted patterns included, so it stops
# ordinary and accidental reads, not deliberate evasion. Without jq it cannot read the command, so
# it refuses every call with exit code 2 instead of letting every call pass.

if ! command -v jq >/dev/null 2>&1; then
  echo "deny-env-read.sh needs jq to read the command, and refuses until jq is installed." >&2
  exit 2
fi

cmd=$(jq -r '.tool_input.command // ""')
scrub=$(printf '%s' "$cmd" | sed -E 's/process\.env//g; s/import\.meta\.env//g')
reason=""
if printf '%s' "$scrub" | grep -Eq '\.env([^A-Za-z0-9_]|$)'; then
  reason="the command names a .env file"
elif printf '%s' "$scrub" | grep -Eq '(^|[;&|(`])[[:space:]]*env[[:space:]]*($|[;&|)`])'; then
  reason="a bare env prints the process environment"
elif printf '%s' "$scrub" | grep -Eq '\bprintenv\b|/environ\b|\.Config\.Env|json[[:space:]]+\.Config[[:space:]]*\}\}|json[[:space:]]+\.[[:space:]]*\}\}'; then
  reason="the command prints a process or container environment"
elif printf '%s' "$scrub" | grep -Eq 'docker([[:space:]]+container)?[[:space:]]+inspect' && ! printf '%s' "$scrub" | grep -Eq -- '--format|[[:space:]]-f[[:space:]]'; then
  reason="docker inspect without --format prints the container environment"
elif printf '%s' "$scrub" | grep -Eq 'compose[^|;&]*[[:space:]]config([[:space:]]|"|'"'"'|$)'; then
  reason="docker compose config renders env_file values"
elif printf '%s' "$scrub" | grep -Eq 'exec[^|;&]*[[:space:]]env([[:space:]]|"|'"'"'|$)'; then
  reason="exec env prints a container environment"
fi
if [ -n "$reason" ]; then
  jq -cn --arg r "Refused by the rule against reading secrets (CLAUDE.md, \"Shell conventions\"): $reason." \
    '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
fi
exit 0
