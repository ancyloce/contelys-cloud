# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

`contelys-cloud` is the parent repository of Contelys, a content creation and publishing platform delivered as SaaS and as private installations. It is an Nx workspace that mounts 20 sub-repositories as Git submodules: the 19 deployables and the shared contracts. It also holds what every team shares: the documents, the version manifest, the shared Go service library (`libs/service/`), the deployment code (`deploy/`) and the repository-level scripts (`tools/`).

The design is ahead of the code. A project gains its targets with its first code, so a `project.json` may have none: `npx nx show project <name>` lists the ones that exist. The "Status" paragraph of `docs/LAYOUT.md` records which steps of the standard are applied.

## Parallel sessions

Other Claude Code sessions may be editing this repository and its sub-repositories at the same time. Git shows none of their changes to documents, because documents are untracked, so check more than Git before you start a ticket:

1. Run `git status` and `git log -5` in each repository that the ticket touches, with `git -C <project directory>` for a sub-repository, and list the files changed in the last hour with `find <directory> -mmin -60`.
2. Run `ListAgents`. If a busy session works on the same deployable, ask it with `SendMessage` which tickets and files it holds.
3. Read the ticket's `**Claimed by:**` line. A ticket that has one belongs to the session it names.
4. Before you write code, add `**Claimed by:** <first eight characters of $CLAUDE_CODE_SESSION_ID>, <date>` below the ticket's `**Status:**` line, which keeps its five triage values. Remove the line when the ticket is resolved.

If a file changes under you, stop, re-read it and reconcile the two versions. Never overwrite another session's work: before you copy a file from a staging tree back into the main checkout, check that the checkout's copy still has the hash you recorded.

## Commands

~~~sh
git submodule update --init                   # check out the submodules that are missing
npm ci                                        # install Nx, the only root dependency
node tools/structure-check.mjs                # the structure check
node --test tools/structure-check.test.mjs    # the tests of the structure check
node --test --test-name-pattern='<pattern>' tools/structure-check.test.mjs   # only the tests whose name matches
node --test .claude/hooks/git-writes.test.mjs # the tests of the hook that refuses Git writes
node --test .claude/hooks/deny-env-read.test.mjs   # the tests of the hook that refuses reading secrets
npx nx run <project>:<target>                 # one target of one project
npx nx run-many -t lint test build            # those targets of every project
npx nx affected -t lint test build contract-test scenario-test breaking   # the targets that a change affects
~~~

CI (`.github/workflows/ci.yml`) runs the structure check, its tests and `nx affected`.

When a target's output is evidence, run it with `--outputStyle=static`, as in `npx nx run-many -t lint test build --outputStyle=static`, and add `--skip-nx-cache` so that the tools run again. Nx 24 detects an AI agent and then defaults to `summary`, which prints only run counts, and a cached result replays old output.

The target names are fixed: `lint`, `test`, `build`, `contract-test`, `scenario-test`, `image` and `breaking`. The table under "Nx" in the standard says what each does and which projects have it. A target runs its project's whole command. To run a single test, call the project's own tool in the project directory, for a Go project `GOWORK=off go test ./<package> -run <TestName>`.

The structure check enforces the 11 statements under "Structure check" in the standard. Two findings wait for the owner of the repository and do not fail it: a missing `CODEOWNERS` (statement 8) and a deployable that is neither mounted nor committed (statement 10). It lists them as waiting, and every failure it reports is a defect. Phase 1 commits no placeholder project and no empty directory such as `deploy/ansible/`: they stay in the working copy, and the check leaves a project that is neither committed nor mounted to statement 10.

### Shell conventions

The Bash tool runs zsh. Quote every glob, or start the command with `setopt nullglob`, because an unmatched glob aborts the command. Avoid zsh-only expansions such as `${(f)…}` and glob qualifiers such as `*(N/)`, which the safety check rejects or zsh refuses: run a loop under `bash -c '…'` or pipe a list into `while read -r`. Do not nest heredocs. Write multi-line content with the Write tool, then run it as one plain command. Do not chain unrelated commands with `&&` or `;` in one call, because a hook or the classifier that refuses one part refuses the whole call. Never read a `.env` file or print a process's environment, because they hold secrets. The hook `.claude/hooks/deny-env-read.sh`, registered in `.claude/settings.json`, refuses a command that names a `.env` file, a bare `env`, `printenv`, `/proc/*/environ`, `docker inspect` without `--format`, `docker compose config` and an `exec … env`. It matches the text of the whole command, so a comment or a `grep` pattern that names a `.env` file is refused too. Without `jq` it refuses every command.

## Architecture

`docs/DESIGN.md` is the architecture document of phase 1. These are the parts that take several documents to piece together:

- **Deployables.** 15 domain services, each hosting exactly one domain (`services/`), and four deployables that host no domain: Edge, Workers and Public Delivery (`platform/`) and Authoring (`apps/`). 14 domain services are Go on the shared service library, with pgx, sqlc and stubs generated from OpenAPI. Collaboration is Node/TypeScript, Edge is APISIX configuration with a renderer and a scenario suite in Go, and Authoring serves a React single-page app. Every deployable's own code is Go except Collaboration's and the authoring app; only Workers' sandbox images may use another language (ADR 0067).
- **Ingress.** Authoring and API traffic enters through Edge, which authenticates each request once through Identity and passes on a signed internal token. A domain service verifies that token and asks Organization Access for the role the caller holds. Site visitors reach Public Delivery, which serves releases as static files from object storage and needs no domain service at request time.
- **Between deployables.** A call goes through Edge's internal listener, by the OpenAPI contract of the domain service that owns the fact, and an error is one `application/problem+json` body (ADR 0054). Each domain service has its own PostgreSQL database, and SQL stays inside it. An event leaves through its owner's outbox, travels on Kafka and is deduplicated in the subscriber's inbox. A job request leaves through the same outbox and reaches Workers through its API; Workers queues it in River and runs it in a sandbox. Kafka carries events only.
- **Independent releases.** Each deployable has its own version, dependency lock, image and pipeline, and stays compatible with the previous released version of each neighbour (ADR 0032) and with each neighbour's version in the latest product version (ADR 0057). A contract changes by addition only. A change that crosses deployables is several commits in several sub-repositories, released at different times. A deployable imports no other deployable: shared Go code comes from `libs/service` at a pinned tag, and contracts come as a versioned package. Only a `contract-test` target reads `contracts/` directly.
- **Delivery.** `version-manifest.yaml` and the submodule pointers record one tested set, a product version, and CI writes both. CI also builds a tooling image for every commit on `main`, which carries the manifest, the deployment code with Ansible, the route fragments and the contracts (ADR 0058). An installation receives the tooling image of its product version and the images that the manifest pins, and runs them as containers on VMs under Ansible (`deploy/ansible/`), or under Compose for the single-VM evaluation profile (`deploy/compose/`). It upgrades one scheduled product version at a time (ADR 0057). Phase 1 has no Kubernetes.

## Where to look

- **`docs/LAYOUT.md`**, the repository layout standard. Read "Where a change goes" before creating or moving a file, "Naming convention" before naming a module, package, image, tag or directory, and "Configuration files" before changing `project.json`, `nx.json`, `.gitmodules`, `version-manifest.yaml` or the CI workflow.
- **"Not yet decided"** in the standard. It lists the choices to record before making them. The GitHub organization is named `contelys` but does not exist yet, and every Go module path contains its name, so a `go.mod` waits for it.
- **`docs/DESIGN.md`**, sections 01 to 10. Read the section for the area before changing or describing behavior. Section 09 lists what phase 1 defers and section 10 the decisions still open.
- **`.scratch/phase-1-platform/spec.md`** and the issues beside it. Together with `docs/DESIGN.md` they hold the requirements that bind every deployable, and a sub-repository's own design leaves them out. Check them before changing what a deployable needs from another, its availability or its topology.
- **`docs/archive/`**, here and in each sub-repository. It keeps superseded documents unchanged. Read them as history: the current design is `docs/DESIGN.md`.
- **`GLOSSARY.md`**. Its terms differ from common usage: "deployable" and "domain service" where others say "service" or "microservice", "job" for work that Workers performs and "task" for one run of a target by Nx, "release" for a published build of a site and "product version" for a version of the product.

## Agent skills

### Issue tracker

Issues and specs live as markdown files under `.scratch/<feature-slug>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default triage labels, recorded as a `Status:` line in each issue file. See `docs/agents/triage-labels.md`.

### Domain docs

One `GLOSSARY.md` at the root, for every team. System-wide decision records are in `docs/adr/`. A sub-repository keeps its detailed design in its own `docs/DESIGN.md` and the decision records that bind it alone in its own `docs/adr/`. See `docs/agents/domain.md`.

### Review findings and links

Before you fix the findings of a code review, write them under the "Comments" heading of the ticket's file. Give each finding its axis, Standards or Spec, its date and the reviewing session, so that the findings survive the session. Ticket numbers repeat across deployables, so the ticket's own file is the one unambiguous place for them. Never write the target of a link to a decision record or a document from memory. Confirm each path with `ls` first, and cite a sub-repository's record with its glossary name, as in "Edge ADR 0003".

## Repository rules

The repository layout standard, `docs/LAYOUT.md`, takes precedence over the Nx guidelines below. Every target is an explicit command in `project.json`. No Nx plugin or generator is added to scaffold or run a project, and the root `package.json` pins only Nx. Each deployable and the shared contracts have their own sub-repository, mounted in this parent repository as a Git submodule (`docs/adr/0045-parent-repository-with-submodules.md`). The owner of the repository adds submodules and only CI moves their pointers.

Only the owner of the repository writes history, here and in every sub-repository: staging (`add`, `rm`, `mv`), commits, stashes, resets, merges, rebases, cherry-picks, reverts, tags, forced branch moves and pushes, and the same operations through GitHub: merging a pull request, creating a release, syncing a fork, and API writes to Git data or file contents. An agent may do the rest, such as reading, `fetch`, `pull` and `clone`, branches, checkouts and worktrees, and the GitHub CLI for pull requests and issues. It leaves its changes unstaged, lists the changed files and proposes the commit message, even when asked to commit. The hook `.claude/hooks/git-writes.mjs`, registered in `.claude/settings.json`, refuses the owner's operations. It matches the text of a command, so it stops accidental writes, not deliberate ones: never route one of them through an alias, a script or another tool.

Documents stay out of Git. Of all of them only `docs/LAYOUT.md` is committed, because the structure check reads it in CI. Every other file under `docs/` and `.scratch/`, here and in every sub-repository, lives only in the working copy, and the `.gitignore` files keep it out. The documents are backed up to `/root/backup/contelys-cloud` under the same paths. After changing a document, refresh the backup from the root of this repository:

~~~sh
find . \( -name node_modules -o -name .nx -o -name .git -o -path ./.claude/worktrees \) -prune -o -type d \( -name docs -o -name .scratch \) -print | rsync -ar --files-from=- ./ /root/backup/contelys-cloud/
~~~

A worktree holds only committed files, so it has no documents: work that reads or changes them runs in the main checkout.

A directory that `.gitmodules` lists is a repository of its own: run Git for it with `git -C <project directory>`. A change inside it belongs to that sub-repository, where the owner commits and pushes it on its branches, and the modified pointer that the parent repository then shows stays uncommitted. A deployable directory that `.gitmodules` does not list is a placeholder that holds only a `project.json`. Its source has no place until the owner of the repository mounts its sub-repository.


<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

## General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax


<!-- nx configuration end-->