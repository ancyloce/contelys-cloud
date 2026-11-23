# Contelys Repository Layout and Code Structure Standard

This document sets the standard for how the Contelys source is arranged and named: the repositories, the directory layout, the naming convention, the rules that keep deployables independent, and the structure of the code inside a domain service. It is written for people and for AI coding agents, so every path, name and rule is literal and can be applied as written. Paths are relative to the root of the parent repository, and `<slug>` stands for a deployable's slug as defined under "Naming convention". Other documents cite it as "the repository layout standard". Its path is `docs/LAYOUT.md`: the structure check reads it there and documents in the sub-repositories link to it.

The standard keeps what the [architecture document](./DESIGN.md) decides about deployables: each domain ships as its own deployable, released by its own team ([ADR 0028](./adr/0028-one-deployable-per-domain.md)), compatible with the previous version of its neighbours ([ADR 0032](./adr/0032-neighbour-compatibility-rule.md)), and delivered to installations through a version manifest. [ADR 0045](./adr/0045-parent-repository-with-submodules.md) decides that each deployable and the shared contracts have their own repository, mounted as Git submodules in a parent repository that is the Nx workspace. The [glossary](../GLOSSARY.md) defines the terms.

**Status: partly applied.** ADR 0045 records the decision and supersedes [ADR 0044](./adr/0044-one-repository-independent-versions.md), which kept every deployable as a plain directory. The parent repository was set up on 2026-11-18. Four steps of the last section are open. Step 4: `CODEOWNERS` waits for the GitHub organization `contelys` to exist. Step 6 has begun: the owner of the repository made `contracts` and `platform/edge` sub-repositories on 2026-11-19, `services/identity` on 2026-11-20, and `services/notifications` and `services/organization-access` on 2026-11-22, and recorded their pointers in the parent repository. `.gitmodules` gives the last two an absolute address, which statement 10 of the structure check rejects. The other 15 deployable directories are still placeholders that hold only a `project.json`. Step 7: the CI job that moves submodule pointers is not built. Step 8: no domain service has source yet, so none has the structure of its language. Until steps 4 and 6 are done the structure check fails on statements 8 and 10. No project has targets yet; each gains them with its first code. On 2026-11-19 the target `scenario-test` was added to this standard; `nx.json` and the CI workflow gain it with the first project that defines it. On 2026-11-22 the standard gained the section "Structure of a domain service" and its present title; before that it was the "Repository layout standard". Later the same day the review of the open items settled six points that this standard had listed as not yet decided: the name of the organization, `contelys`; the credential of CI; the place of the service template ([ADR 0034](./adr/0034-platform-team-shared-library.md)); how the contracts are packaged ([ADR 0060](./adr/0060-contracts-as-a-go-module-and-an-npm-dependency.md)); where a route fragment lives and how files reach an installation, through the tooling image ([ADR 0058](./adr/0058-one-tooling-image-per-tested-set.md)); and the form of a product version and its hotfixes ([ADR 0057](./adr/0057-compatibility-reaches-the-latest-product-version.md)). On 2026-11-23 [ADR 0067](./adr/0067-every-deployables-own-code-is-written-in-go.md) made Go the language of every deployable's own code, Edge's renderer and scenario suite included, superseding ADR 0065, which had admitted Python for them; the structure check needs no change for it. The same day the owner of the repository decided that this standard is the only document committed, and every other one stays in the working copy. Update this paragraph as the steps are completed.

## The repositories

Contelys uses one parent repository, `contelys-cloud`, and 20 sub-repositories: one per deployable and one for the shared contracts. All of them are hosted on GitHub under one organization, `contelys`. Until it exists the repositories sit under a personal account, and no Go module is created, because every module path contains the organization's name. Edge's module is the one exception: no other module imports it, so it carries its final path, `github.com/contelys/contelys-cloud-edge`, from its first `go.mod` on (ADR 0067). After the repositories move to the organization, GitHub redirects their old addresses, and the relative submodule addresses keep resolving.

The parent repository is the Nx workspace. It holds the shared Go service library, the deployment code, the version manifest, the repository-level scripts and the documents that concern every team: the architecture document, the system-wide decision records, this standard and the glossary. Its CI builds the tooling image of every commit on `main` (ADR 0058). It mounts every sub-repository as a Git submodule at its project directory. Nothing else is a submodule, and a sub-repository has no submodules of its own.

The sub-repository of a deployable holds its source, dependency manifest and lock file, `Dockerfile` and `project.json`. Its team owns it, releases from it and tags its versions in it. The source of a domain service is arranged as "Structure of a domain service" gives it for its language. It also holds the deployable's detailed design, `docs/DESIGN.md`, and the decision records that bind that deployable alone, in `docs/adr/`. The sub-repository of the contracts holds the shared contracts, and every team changes its own contracts there. Every sub-repository carries its own `.gitattributes`, because the one in the parent repository does not apply inside a submodule. Nx orchestrates tasks across the mounted directories: it decides which tasks to run and caches their results, and each task calls the project's own tools.

## Directory layout

The parent repository, with every sub-repository mounted:

~~~text
contelys-cloud/                          the parent repository: the Nx workspace
├── .claude/
│   └── settings.json                    settings for AI coding agents that everyone shares
├── .gitattributes                       line endings
├── .github/
│   └── workflows/
│       └── ci.yml                       the CI workflow
├── .gitignore                           also keeps every document but this standard out of Git
├── .gitmodules                          one entry per sub-repository
├── .scratch/                            issue tracker, kept out of Git
│   └── <feature-slug>/
│       ├── spec.md                      the spec of the feature
│       └── issues/                      one file per issue
├── CLAUDE.md                            instructions for AI coding agents
├── CODEOWNERS                           the owning team of each path the parent repository holds
├── GLOSSARY.md                          the one glossary
├── nx.json                              Nx settings
├── package.json                         build tooling only: pins Nx
├── package-lock.json                    the npm lock file of the build tooling
├── version-manifest.yaml                the version manifest
├── apps/
│   └── authoring/                       submodule: Authoring, the authoring app and its image
├── contracts/                           submodule: the shared contracts
│   ├── .gitattributes
│   ├── CODEOWNERS                       each team owns its own contract directories
│   ├── buf.yaml                         lint and breaking-change rules for event schemas
│   ├── go.mod                           the contracts as a Go module
│   ├── package.json                     the contracts as the npm package @contelys/contracts
│   ├── project.json
│   ├── access/
│   │   └── <target slug>.yaml           who may call the operations of one deployable
│   ├── events/                          Protobuf event schemas, one buf module
│   │   └── contelys/
│   │       └── <slug with underscores>/
│   │           └── v1/
│   ├── jobs/                            the job-request contract of Workers
│   └── openapi/
│       └── <slug>/                      the OpenAPI contract of one domain service
├── deploy/                              deployment code
│   ├── ansible/                         VM profile
│   └── compose/                         single-VM evaluation profile
├── docs/                                kept out of Git, except LAYOUT.md
│   ├── adr/                             system-wide decision records
│   ├── agents/                          how AI coding agents use the issue tracker and the documents
│   ├── archive/                         superseded documents, kept unchanged
│   ├── DESIGN.md                        the architecture document
│   └── LAYOUT.md                        this standard, the one committed document
├── libs/
│   └── service/                         the shared Go service library, the project libs-service
│       └── template/                    the service template, a Go module of its own
├── platform/                            the 3 deployables of the platform team, each a submodule
│   ├── edge/
│   ├── public-delivery/
│   └── workers/                         Workers, with its sandbox images in sandboxes/<worker class>/
├── services/                            the 15 domain services, each a submodule
│   ├── assets/
│   ├── billing-entitlements/
│   ├── collaboration/
│   ├── components/
│   ├── content/
│   ├── event-center/
│   ├── identity/
│   ├── notifications/
│   ├── organization-access/
│   ├── pages/
│   ├── projects/
│   ├── publishing/
│   ├── search/
│   ├── sites/
│   └── texts/
└── tools/
    ├── structure-check.mjs              the structure check
    └── structure-check.test.mjs         the tests of the structure check
~~~

The sub-repository of a deployable has the same files at its root, whatever its language:

~~~text
contelys-cloud-<slug>/                   mounted at services/<slug>/, platform/<slug>/ or apps/authoring/
├── .gitattributes                       the line * text=auto eol=lf
├── .github/
│   └── workflows/                       the pipeline of the deployable
├── .gitignore                           keeps docs/ and .scratch/ out of Git
├── Dockerfile                           builds the image contelys/<slug>
├── project.json                         the Nx project, with the fixed target names
├── route-fragment.yaml                  the external routes that Edge publishes, if any
├── <dependency manifest and lock file>  go.mod and go.sum, or package.json and package-lock.json
├── <source>                             for a domain service, see "Structure of a domain service"
└── docs/                                kept out of Git
    ├── DESIGN.md                        the detailed design
    ├── PLANS.md                         the overall plan, above plans/
    ├── adr/                             decision records that bind this sub-repository alone
    ├── plans/                           implementation plans
    ├── verification/                    records of verification runs
    └── archive/                         superseded documents, kept unchanged
~~~

| Path | Holds |
| --- | --- |
| `services/<slug>/` | One domain service, mounted from the sub-repository `contelys-cloud-<slug>`: its source, dependency manifest and lock file, `Dockerfile` and `project.json`. The directory name is short for "domain services" and holds nothing else. |
| `platform/<slug>/` | Edge, Workers or Public Delivery, mounted the same way, with the same contents. The platform team owns them. |
| `platform/workers/sandboxes/<worker class>/` | The sandbox image of one worker class: its `Dockerfile` and what the image contains. It is part of the sub-repository of Workers. |
| `<project directory>/route-fragment.yaml` | The route fragment of one deployable: its external routes, which Edge publishes (ADR 0058). A deployable without external routes has none. |
| `libs/service/` | The shared Go service library ([ADR 0034](./adr/0034-platform-team-shared-library.md)), a Go module with its own versions. |
| `libs/service/template/` | The service template: a Go module of its own, without a `replace` directive, that the library's CI builds against the library's latest tag (ADR 0034). |
| `apps/authoring/` | Authoring, mounted from the sub-repository `contelys-cloud-authoring`: the source of the authoring app and the `Dockerfile` of the image that serves it ([ADR 0013](./adr/0013-authoring-single-page-app.md), [ADR 0041](./adr/0041-authoring-app-static-file-host.md)). |
| `contracts/` | The shared contracts, mounted from the sub-repository `contelys-cloud-contracts`. |
| `contracts/openapi/<slug>/` | The OpenAPI contract of one domain service. Edge, Authoring and Public Delivery have no contract directory. |
| `contracts/events/` | Protobuf event schemas, as one buf module. |
| `contracts/jobs/` | The job-request contract of Workers: the request API, the outcome report and the payload of each worker class. |
| `contracts/buf.yaml` | The buf lint and breaking-change rules for event schemas. |
| `contracts/access/<slug>.yaml` | The access file of one deployable: the callers that may use each of its operations, and whether it has protected writes (ADR 0058). The deployable's team owns it. |
| `contracts/go.mod` and `contracts/package.json` | The contracts as a Go module and as an npm package, released at their version tag (ADR 0060). |
| `deploy/ansible/` | Deployment code for installations on VMs. |
| `deploy/compose/` | Deployment code for the single-VM evaluation profile. |
| `.gitmodules` | One entry per sub-repository: its project directory and its relative address. |
| `version-manifest.yaml` | The version manifest: the versions and image digests of the tested set that the submodule pointers record. |
| `nx.json`, `package.json` and `package-lock.json` | The Nx settings and the pinned Nx version. They hold build tooling only, never a project's dependencies. |
| `CODEOWNERS` | The owning team of each path that the parent repository holds. It gives no sub-repository's directory an owner. |
| `docs/` | The architecture document, the system-wide decision records in `docs/adr/` and this standard. Every document in this table, and every `.scratch/`, stays out of Git, except this standard (see ".gitignore" under "Configuration files"). |
| `<project directory>/docs/DESIGN.md` | The detailed design of one sub-repository. |
| `<project directory>/docs/adr/` | The decision records that bind that sub-repository alone. |
| `<project directory>/docs/PLANS.md` | The overall plan of one sub-repository's work, above its implementation plans. |
| `<project directory>/docs/plans/` | The implementation plans of one sub-repository. |
| `<project directory>/docs/verification/` | The records of the verification runs of one sub-repository. |
| `docs/archive/` and `<project directory>/docs/archive/` | Superseded documents, kept unchanged. The current design is the `DESIGN.md` beside them. |
| `docs/agents/` | How AI coding agents use the issue tracker, the triage labels and the documents. |
| `<project directory>/cmd/`, `internal/`, `src/`, `test/` and `tests/` | The source and the tests of a domain service, arranged as "Structure of a domain service" gives them for its language. |
| `tools/` | Repository-level scripts. The structure check is `tools/structure-check.mjs`, and `tools/structure-check.test.mjs` tests it. |
| `.github/workflows/ci.yml` | The CI workflow. It runs the structure check, its tests and `nx affected`. |
| `.scratch/` | The issue tracker: one directory per feature, with its spec and its issues. It is committed. |
| `CLAUDE.md` | Instructions for AI coding agents. |
| `.claude/settings.json` | Settings for AI coding agents that everyone shares. It enables the Nx plugin for agents. |

## Projects

A project is a directory that Nx runs tasks for. It contains a `project.json` file. The 19 projects under `services/`, `platform/` and `apps/` are the deployables. They and `contracts` are submodules. The project `libs-service` is a directory of the parent repository. In this document "project" always means such an Nx project, never a project of the Projects domain, and "task" means one run of a target by Nx, never a job.

| Project | Directory | Language |
| --- | --- | --- |
| `assets` | `services/assets` | Go |
| `billing-entitlements` | `services/billing-entitlements` | Go |
| `collaboration` | `services/collaboration` | Node/TypeScript |
| `components` | `services/components` | Go |
| `content` | `services/content` | Go |
| `event-center` | `services/event-center` | Go |
| `identity` | `services/identity` | Go |
| `notifications` | `services/notifications` | Go |
| `organization-access` | `services/organization-access` | Go |
| `pages` | `services/pages` | Go |
| `projects` | `services/projects` | Go |
| `publishing` | `services/publishing` | Go |
| `search` | `services/search` | Go |
| `sites` | `services/sites` | Go |
| `texts` | `services/texts` | Go |
| `edge` | `platform/edge` | Go, for the renderer and the scenario suite of its APISIX configuration (ADR 0067) |
| `public-delivery` | `platform/public-delivery` | Go |
| `workers` | `platform/workers` | Go |
| `libs-service` | `libs/service` | Go |
| `authoring` | `apps/authoring` | TypeScript |
| `contracts` | `contracts` | OpenAPI and Protobuf |

Every deployable's own code is written in Go, except Collaboration's, which is Node/TypeScript, and the authoring app, which is TypeScript ([ADR 0067](./adr/0067-every-deployables-own-code-is-written-in-go.md)). Workers' sandbox images may use another language where a job needs it. The repository's tooling in `tools/` and `.claude/hooks/` runs on Node, which Nx already requires.

## Naming convention

| Thing | Convention | Example |
| --- | --- | --- |
| Deployable slug | The glossary name in lower case, words joined by hyphens | `organization-access` |
| Sub-repository | `contelys-cloud-<project name>`, in the same organization as the parent repository | `contelys-cloud-organization-access`, `contelys-cloud-contracts` |
| Submodule address | `../contelys-cloud-<project name>.git` in `.gitmodules`, relative to the address of the parent repository | `../contelys-cloud-edge.git` |
| Project directory | `services/<slug>` for a domain service, `platform/<slug>` for a deployable of the platform team, `apps/authoring` for Authoring | `platform/public-delivery` |
| Project name | The slug for a deployable, otherwise the project directory with `/` replaced by `-` | `projects`, `libs-service` |
| Version tag | `v<major>.<minor>.<patch>` in a sub-repository. `<project directory>/v<major>.<minor>.<patch>` in the parent repository for `libs/service` | `v1.4.0` in `contelys-cloud-projects`, `libs/service/v1.2.0` |
| Product version | `<year>.<month>.<patch>`. The patch number is 0 for a scheduled product version, and each hotfix raises it (ADR 0057) | `2027.3.0`, `2027.3.1` |
| Product version tag | `product/<product version>` in the parent repository | `product/2027.3.0` |
| Release branch | `release/<year>.<month>` in the parent repository and `release/v<major>.<minor>` in a sub-repository, for hotfixes only | `release/2027.3`, `release/v1.4` |
| Go module path | The clone URL of the repository that holds the module, without the scheme and the `.git` suffix, followed by the project directory if the module is in the parent repository | `github.com/contelys/contelys-cloud-search`, `github.com/contelys/contelys-cloud/libs/service` |
| npm package | `@contelys/<last segment of the project directory>` | `@contelys/collaboration` |
| Container image | `contelys/<slug>`, pinned by digest in the version manifest | `contelys/edge` |
| Sandbox image | `contelys/workers-<worker class>`, pinned by digest in the version manifest | `contelys/workers-image` for the worker class `image` |
| Tooling image | `contelys/tooling`, tagged with the commit of the parent repository that it was built from, and with the product version when that commit is one (ADR 0058) | `contelys/tooling:2027.3.0` |
| Route fragment | `route-fragment.yaml` at the root of a deployable's sub-repository | `services/projects/route-fragment.yaml` |
| Event topic | `<slug>.<event family>` ([ADR 0061](./adr/0061-events-named-by-family-with-cloudevents-headers.md)) | `identity.principal` |
| Access file | `contracts/access/<target slug>.yaml` | `contracts/access/identity.yaml` |
| Team | `@contelys/<slug>` for the team of a domain service, `@contelys/authoring` for the team of the authoring app, `@contelys/platform` for the platform team | `@contelys/projects` |
| Protobuf package | `contelys.<slug with underscores>.v1` | `contelys.event_center.v1` |
| Protobuf directory | `contracts/events/contelys/<slug with underscores>/v1/` | `contracts/events/contelys/event_center/v1/` |
| OpenAPI directory | `contracts/openapi/<slug>/`, for a domain service | `contracts/openapi/projects/` |
| Layer directory | `interfaces`, `application`, `domain` and `infrastructure`, the same in every language | `internal/domain/` in Go, `src/domain/` in Node/TypeScript |
| Generated code | A directory named `gen`, beside the code that uses it | `internal/infrastructure/postgres/gen/` |
| Go command | `cmd/<slug>/`, which builds the executable `<slug>` | `cmd/organization-access/` |
| Package named after another deployable | Its slug without hyphens in Go, its slug in Node/TypeScript | `organizationaccess`, `organization-access` |
| Decision record | `ADR <number>` for a record of the parent repository. `<glossary name> ADR <number>` for a record of a sub-repository, numbered from 0001 there | `ADR 0030`, `Edge ADR 0001` |

A sub-repository holds its Go module at its root, so Go resolves the module from a plain version tag. Go resolves a module in a subdirectory only from a tag that starts with that directory, which is why `libs/service` uses the longer form in the parent repository. From major version 2 on, Go requires the module path to end in `/v<major>`, for example `github.com/contelys/contelys-cloud-search/v2`, while the tag keeps its form, `v2.0.0`.

The submodule address is relative so that the whole set can be mirrored to a customer's or an air-gapped Git server without a change to `.gitmodules`.

## Rules

### Independence

These rules keep every deployable separately releasable.

1. Each deployable has its own version. Its pipeline creates the version tag in its sub-repository, in the form given under "Naming convention".
2. Each Go or Node project has its own dependency manifest and lock file: `go.mod` and `go.sum` for Go, and `package.json` and `package-lock.json` for Node. The Node package manager is npm. No npm workspace spans projects, because a workspace gives them one shared lock file.
3. Each deployable has its own `Dockerfile` and its own image, `contelys/<slug>`. The image is built once per version, with the sub-repository as the build context, so the build cannot read another project's source or the parent repository. The `Dockerfile` pins its base image by digest. Workers ships further images: one sandbox image per worker class, `contelys/workers-<worker class>`, built from `sandboxes/<worker class>/` in its sub-repository and versioned with Workers. The parent repository's CI builds one more image, the tooling image, for every commit on `main` (ADR 0058).
4. Each deployable has its own pipeline, which runs in its sub-repository, and is deployed on its own. For a pull request, the pipeline checks out the parent repository with its submodules, switches its own submodule to the commit of the pull request and runs its `contract-test` target there. The pipeline of `contracts` does the same and runs the `contract-test` target of every deployable.
5. A change that crosses deployables is several commits in several sub-repositories, released at different times. A deployable stays compatible with the previous released version of each neighbour (ADR 0032) and with each neighbour's version in the latest product version (ADR 0057), and its `contract-test` target proves both. Never rely on a contract, its provider and its consumers changing together.
6. `CODEOWNERS` in the parent repository names the owning team of each path that the parent repository holds: the shared library and the other shared paths. It gives no sub-repository's directory an owner, because the content of a sub-repository is reviewed there and CI moves its pointer. The sub-repository of the contracts has a `CODEOWNERS` of its own, in which the team of a domain service owns that domain service's contract directories.

### Submodules

These rules keep the parent repository a record of tested sets.

1. Every deployable is a submodule, mounted at its project directory, and so is `contracts`. Nothing else is. A sub-repository has no submodules of its own.
2. `.gitmodules` gives every submodule a relative address, in the form given under "Naming convention".
3. Only CI moves a submodule pointer. It opens a pull request in the parent repository that moves the pointer to a commit that carries a version tag. The same commit writes that version into `version-manifest.yaml`, and for a deployable its image digest as well. The pull request is merged automatically once the contract tests of the whole set pass, and it needs no person's approval. There are two exceptions, and the owner of the repository makes both: the commit that first adds a submodule, and, until the CI job that moves pointers exists, every other pointer move.
4. The pointer of a sub-repository that has a version in the manifest is the commit that the tag of that version names. The pointers and the manifest therefore never disagree.
5. Work on a deployable or on the contracts happens in its sub-repository, on that repository's branches. A change inside a mounted directory is committed and pushed there, and the moved pointer is never committed in the parent repository by hand.
6. A sub-repository has no customer branches. Customer differences live in a separate configuration repository. Release branches for hotfixes are allowed, in the forms given under "Naming convention", and CI's pull request for a hotfix moves the pointer on the parent repository's release branch (ADR 0057).
7. Every sub-repository contains a `.gitattributes` file with the line `* text=auto eol=lf`. Git applies such a file only inside the repository that contains it, so the one in the parent repository does not cover a submodule.
8. CI reads the other repositories, and opens the pull requests that move pointers, with tokens of two GitHub Apps that `actions/create-github-app-token` mints for each job. A read-only App, with Contents: read on all 21 repositories, serves every pipeline. A pointer App, with Contents and Pull requests: write on the parent repository alone, serves the job that moves pointers. A pull request opened with the token that GitHub Actions provides triggers no workflow, so the contract tests would never run on it.

### Documents

These rules say where a design or a decision is written down, so that a team finds its own documents in its own repository and every team finds the shared ones in one place.

1. The parent repository holds the documents that every team must follow: the architecture document, the system-wide decision records, this standard and the glossary.
2. A sub-repository holds its own detailed design, `docs/DESIGN.md`, and the decision records that bind it alone, in `docs/adr/`. A decision that another deployable must follow is system-wide and belongs in the parent repository, even when one deployable implements it. A sub-repository may also hold its implementation plans, in `docs/plans/`, and the records of its verification runs, in `docs/verification/`. The steps of a plan are tracked as issues in `.scratch/` of the parent repository.
3. A sub-repository numbers its decision records from 0001 and cites them with its glossary name, as in "Edge ADR 0001". A bare "ADR 0030" always names a record of the parent repository.
4. A record that moves from the parent repository to a sub-repository leaves a stub at its old path that names its new place, so that existing citations still resolve.
5. A link from one repository into another is relative, and it resolves where the sub-repository is mounted in the parent repository. An absolute address would name the organization and would break when the set is mirrored.
6. There is one glossary, `GLOSSARY.md` in the parent repository. A sub-repository has none.

### Dependencies

1. Builds use pinned dependencies and never read another project's source directory (architecture document, section 08). A `replace` directive never points at a local path, and no import crosses from one project into another by relative path.
2. `go.work` and `go.work.sum` are never committed. CI and image builds run with `GOWORK=off`, so a workspace file on a developer's machine cannot replace a pinned version with source from the repository.
3. A deployable never depends on another deployable's module. Shared Go code lives in `libs/service`, which stays thin. A deployable uses it at the version pinned in its `go.mod`, resolved from the tag `libs/service/v<version>` of the parent repository, not from the directory beside it (ADR 0034).
4. Contracts have one source of truth, the sub-repository mounted at `contracts/`. A deployable's build consumes them as a versioned package, the Go module or the npm Git dependency of ADR 0060, and never copies them. Only its `contract-test` target reads `contracts/` directly, so that a contract change is tested before it is released. That target runs only in a checkout of the parent repository, where the deployable and the contracts are mounted side by side.
5. Contract changes are additive only. buf rejects a breaking change to an event schema in CI (ADR 0032, [ADR 0038](./adr/0038-protobuf-event-schemas-with-buf.md)).
6. The version manifest pins the exact build of every deployable. A customer installation receives the tooling image of its product version, which carries the version manifest, and the images that the manifest pins, never a checkout. It moves only from one manifest version to another, one scheduled product version at a time (architecture document, section 08; ADR 0057, ADR 0058).

### Nx

1. Nx orchestrates and does not replace the language tools. Every target in a `project.json` is an explicit command that calls `go`, `buf`, `docker` or the project's package manager.
2. A project builds and tests without Nx, by running the same commands in its directory. The image of a Go deployable needs neither Node nor Nx. A sub-repository cloned on its own therefore builds and tests without the parent repository.
3. No Nx plugin for Go is required. The available ones are maintained by the community, and this standard does not depend on them.
4. Target names are fixed, as listed below. The command behind each name is the project's choice.
5. Every deployable lists `contracts` in `implicitDependencies`, because its `contract-test` target reads the contract files in `contracts/`, whether the deployable provides a contract or only consumes one. A contract change then marks every deployable as affected and runs that target against the changed files. The `lint`, `test`, `build` and `scenario-test` targets take only the project's own files as inputs, so a contract change leaves their cached results valid. Split `contracts` into one project per contract only if those runs become too slow.
6. A deployable does not list `libs-service` as a dependency. It uses the library at a pinned version, so a library change does not affect it until its `go.mod` moves to the new version.
7. CI is GitHub Actions. It checks out the parent repository with its submodules and runs only what a change affects: `nx affected -t lint test build contract-test scenario-test`. Nx Cloud is the remote cache: `nx.json` holds the workspace ID, and CI passes the access token from the repository secret `NX_CLOUD_ACCESS_TOKEN`.
8. The root `package.json` pins Nx to an exact version.
9. Nx sees a moved submodule pointer as a change to the project directory and marks that project as affected. A moved pointer of `contracts` therefore marks every deployable as affected.

| Target | What it does | Projects |
| --- | --- | --- |
| `lint` | Runs the static checks | All |
| `test` | Runs the unit tests | All except `contracts` |
| `build` | Compiles the project | Go and TypeScript projects |
| `contract-test` | Tests a deployable through its contracts, against each neighbour's contract as it is in `contracts/`, as it was in the previous released version (ADR 0032) and as it is in the latest product version (ADR 0057) | The 19 deployables |
| `scenario-test` | Runs a deployable's verification scenarios against stubs of its neighbours, in an environment that the target starts and removes itself. It reads no file outside the project | `edge` |
| `image` | Builds the container image from the project directory | The 19 deployables |
| `breaking` | Runs `buf breaking` against the previous released contracts (ADR 0038) | `contracts` |

## Structure of a domain service

This section fixes how the source of a domain service is arranged: one set of layers for every language, and one directory tree each for Go and Node/TypeScript. The four deployables that host no domain have no domain layer, so the detailed design of each gives its structure. Edge follows the Go tree without `internal/domain/` (ADR 0067).

### Layers

A domain service has four layers. Each is one directory with the same name in every language, and an import points inward only, toward `domain/`.

| Layer | Directory | Holds | May import |
| --- | --- | --- | --- |
| Interface | `interfaces/` | What receives a call and turns it into the call of a use case: HTTP handlers, WebSocket handlers, event consumers, job handlers and operator commands. It verifies the internal token, checks the input against the contract and reports an error as the one error body ([ADR 0054](./adr/0054-one-error-body-in-every-contract.md)). The HTTP framework is used here alone. | `application/`, `domain/`, the framework, generated server code, the shared library |
| Application | `application/` | The use cases, one for each operation of the domain service. A use case asks for the caller's role, calls the domain and commits the result. It declares the ports that it needs from outside: stores, clients of other deployables and the outbox. | `domain/` |
| Domain | `domain/` | The model of the domain: aggregates, value objects, events and policies, with the rules that must always hold. | Itself and the standard library of the language |
| Infrastructure | `infrastructure/` | What implements the ports: stores over PostgreSQL with their queries and migrations, clients of other deployables and of infrastructure products, and the mapping of events to their schemas. | `application/`, `domain/`, drivers, generated client code, the shared library |

The interface layer is what many frameworks call controllers, the application and domain layers together are the business logic, and the infrastructure layer includes data access.

The composition root is the one place that imports every layer. It reads the configuration, builds the infrastructure, hands it to the use cases as their ports and starts the interface layer. It holds no rule of the domain.

1. A use case is the transaction boundary. It commits business state and the outbox record in one local transaction, with the write barrier inside it, and it calls another deployable outside that transaction (architecture document, section 05).
2. A signature in `application/` or `domain/` names only types of those two layers and of the standard library. The framework, the database driver and the shared library stay behind the ports.
3. A type generated from a contract stays in `interfaces/` and `infrastructure/`. Both translate it into the domain's own types, so a neighbour's contract change reaches one translation and no rule of the domain.
4. Generated code sits in a directory named `gen`, beside the code that uses it. It is committed, so that the project builds with its language tools alone, and it is never edited by hand.
5. A unit test sits beside the code, where Go and Node/TypeScript put it. The tests of the `contract-test` target sit in a directory named `contract`. The `test` target leaves them out, because they run only where `contracts/` is mounted beside the deployable.
6. The `lint` target of a domain service fails on an import that the table does not allow.

### Domain model

One domain service hosts one domain ([ADR 0028](./adr/0028-one-deployable-per-domain.md)), so `domain/` holds one model, and the names in the code are the terms of the [glossary](../GLOSSARY.md). The building blocks are those of domain-driven design. Two of them have another name here, because the usual name already means something else in these documents.

| Building block | Layer | What it is |
| --- | --- | --- |
| Aggregate | Domain | A group of objects that changes as one unit and guards its own rules. Other code reaches it through its root. |
| Value object | Domain | A value without identity that cannot change, such as a role or an amount of money in minor units. |
| Event | Domain | The record of a fact that an aggregate has decided, as the glossary defines it. In `domain/` it is a plain type. Infrastructure maps it to its Protobuf schema and writes it to the outbox. |
| Policy | Domain | A rule that involves more than one aggregate. Domain-driven design calls it a domain service, a name that the glossary gives to the deployable. |
| Use case | Application | One operation of the domain service, from the check of the caller's role to the commit. |
| Port | Application | An interface that a use case needs from outside and that infrastructure implements. |
| Store | Application, implemented in infrastructure | The port through which a use case loads and saves an aggregate. Domain-driven design calls it a repository, which in this standard always means a Git repository. |

1. A fact of another domain is held as its identifier, together with its version where the fact is fixed. The domain service that owns the fact stays its one writer and answers for it through its contract (architecture document, section 05).
2. A large domain splits `domain/` and `application/` by aggregate, one package each. A package is named with the glossary's term for what it holds, never after a technical kind such as `models` or `utils`.

### Frameworks

The HTTP framework belongs to the interface layer alone, so replacing it changes that layer and nothing else.

| Language | Framework | Decided by |
| --- | --- | --- |
| Go | The standard library's router, with server stubs generated from the OpenAPI contract. PostgreSQL through pgx, with queries generated by sqlc | [ADR 0021](./adr/0021-sql-first-data-access.md) |
| Node/TypeScript | Fastify, which validates every request against a schema that the OpenAPI contract supplies. Hocuspocus carries the WebSocket traffic of Collaboration | This standard, until the detailed design of Collaboration confirms or replaces Fastify. The architecture document names Hocuspocus |

Gin is not used. ADR 0021 fixes the standard library's router for every Go domain service, and the detailed designs of Identity, Organization Access and Notifications follow it. Using Gin needs a decision record that supersedes ADR 0021. Express is not used either, because it needs further middleware for what Fastify does from the contract's schema.

### Go

A Go domain service keeps all of its code under `cmd/` and `internal/`. The Go compiler refuses an import of an `internal/` package from another module, so no deployable can depend on another deployable's code (rule 3 under "Dependencies").

~~~text
services/<slug>/                         the sub-repository contelys-cloud-<slug>
├── Dockerfile
├── go.mod                               the module github.com/contelys/contelys-cloud-<slug>
├── go.sum
├── project.json
├── sqlc.yaml                            reads migrations/ as the schema and queries/ as the queries
├── cmd/
│   └── <slug>/
│       └── main.go                      the composition root: the server and the operator commands
├── internal/
│   ├── interfaces/
│   │   ├── httpapi/                     handlers on the standard library's router
│   │   │   └── gen/                     server stubs generated from the OpenAPI contract
│   │   ├── consumers/                   event consumers, behind the inbox of the shared library
│   │   ├── jobs/                        River job handlers
│   │   └── commands/                    operator commands
│   ├── application/                     use cases and the ports they declare
│   ├── domain/                          aggregates, value objects, events and policies
│   └── infrastructure/
│       ├── postgres/                    stores over pgx
│       │   ├── migrations/              the migrations of the domain service's database
│       │   ├── queries/                 the SQL that sqlc reads
│       │   └── gen/                     query code generated by sqlc
│       ├── clients/
│       │   └── <neighbour>/             the client of one other deployable, generated into gen/
│       ├── events/                      maps events to their Protobuf messages for the outbox
│       └── <product>/                   one package per infrastructure product, such as objectstorage
├── test/
│   └── contract/                        the tests of the contract-test target
└── docs/
~~~

The package is `httpapi` and not `http`, so that it does not hide `net/http`. What the shared library provides is used where the table under "Layers" allows it: internal-token verification and the health endpoints in `interfaces/`, the outbox, the inbox and River in `infrastructure/`, and configuration loading and telemetry in the composition root.

### Node/TypeScript

A Node domain service keeps its code under `src/`. No shared library exists for Node. Collaboration is the only Node domain service, and it implements for itself what the shared library gives a Go domain service: that code sits in `infrastructure/`, and the verification of the internal token in `interfaces/`.

~~~text
services/<slug>/                         the sub-repository contelys-cloud-<slug>
├── Dockerfile
├── package.json                         the package @contelys/<slug>
├── package-lock.json
├── project.json
├── tsconfig.json
├── src/
│   ├── main.ts                          the composition root
│   ├── interfaces/
│   │   ├── http/                        Fastify plugins, one per group of operations of the contract
│   │   │   └── gen/                     types generated from the OpenAPI contract
│   │   ├── websocket/                   the Hocuspocus hooks of Collaboration
│   │   ├── consumers/                   event consumers
│   │   └── commands/                    operator commands
│   ├── application/                     use cases and the ports they declare
│   ├── domain/                          aggregates, value objects, events and policies
│   └── infrastructure/
│       ├── postgres/                    stores, with their migrations in migrations/
│       ├── valkey/                      the instance sync of Collaboration
│       ├── clients/
│       │   └── <neighbour>/             the client of one other deployable, generated into gen/
│       ├── events/                      the outbox, the relay and the inbox
│       ├── config/                      configuration loading
│       └── telemetry/                   traces, metrics and logs
├── test/
│   └── contract/                        the tests of the contract-test target
└── docs/
~~~

### Shared code

Code is shared at the narrowest place that covers its users. The first row that fits decides.

| Code | Place |
| --- | --- |
| Used by one layer of one deployable | A package of that layer |
| Used by two layers of one deployable | The inner one of the two layers |
| A concern that every Go domain service has and that ADR 0034 lists: configuration loading, telemetry, internal-token verification, the outbox and the inbox, River setup, the health endpoints and the idempotency key ([ADR 0062](./adr/0062-creating-posts-take-an-idempotency-key.md)) | `libs/service/`, used at a pinned version |
| A message, an operation or a payload that deployables exchange | `contracts/`. Each deployable generates its own code from it |
| A rule that two domains need | The domain service that owns the fact. The other one calls its contract |
| A helper that two deployables happen to need | A copy in each of them |

1. `libs/service/` holds plumbing only: no type and no rule of a domain. It stays thin and supports its previous version (ADR 0034).
2. A copy in two deployables is preferred to a shared library for a small helper, because a library that several teams release against couples their releases (ADR 0034).
3. What deployables share about a domain is its contract. Its entities, its tables and its model stay inside its domain service (architecture document, section 05).
4. A second library under `libs/` needs a system-wide decision record that names its owning team and at least two deployables that use it. No library exists for Node/TypeScript.

## Configuration files

These are the required contents of the configuration files.

**`nx.json`** sets the branch that `nx affected` compares with, turns on caching for the targets that have no side effects, limits their inputs to the project's own files, connects the workspace to Nx Cloud and keeps usage analytics off:

~~~json
{
  "$schema": "./node_modules/nx/schemas/nx-schema.json",
  "defaultBase": "main",
  "namedInputs": {
    "own": ["{projectRoot}/**/*"]
  },
  "targetDefaults": {
    "lint": { "cache": true, "inputs": ["own"] },
    "test": { "cache": true, "inputs": ["own"] },
    "build": { "cache": true, "inputs": ["own"] },
    "scenario-test": { "cache": true, "inputs": ["own"] }
  },
  "nxCloudId": "<workspace ID>",
  "analytics": false
}
~~~

Without the `inputs`, Nx counts the files of `contracts` as inputs of every deployable, and a contract change would rerun the `lint`, `test`, `build` and `scenario-test` targets of all of them.

**`package.json`** at the root holds build tooling only, and npm keeps its lock file, `package-lock.json`, beside it:

~~~json
{
  "name": "contelys-cloud",
  "private": true,
  "devDependencies": {
    "nx": "<exact version>"
  }
}
~~~

**`project.json`** sits in every project directory, which for a deployable is the root of its sub-repository. This is the form for a Go deployable. The `contract-test` target follows the same form. The `$schema` path resolves where the sub-repository is mounted in the parent repository.

~~~json
{
  "name": "projects",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "projectType": "application",
  "implicitDependencies": ["contracts"],
  "targets": {
    "lint": {
      "command": "go vet ./...",
      "options": { "cwd": "{projectRoot}", "env": { "GOWORK": "off" } }
    },
    "test": {
      "command": "go test ./...",
      "options": { "cwd": "{projectRoot}", "env": { "GOWORK": "off" } }
    },
    "build": {
      "command": "go build -o /dev/null ./...",
      "options": { "cwd": "{projectRoot}", "env": { "GOWORK": "off" } }
    },
    "image": {
      "command": "docker build --tag contelys/projects .",
      "options": { "cwd": "{projectRoot}" }
    }
  }
}
~~~

The `build` command discards its output with `-o /dev/null`. Without it, `go build ./...` writes an executable into the project directory when the module has a single `main` package, and Nx then reports the project as affected because of that untracked file.

**`.gitmodules`** has one entry per sub-repository, named after its project directory, with its relative address:

~~~ini
[submodule "services/projects"]
	path = services/projects
	url = ../contelys-cloud-projects.git
~~~

**`CODEOWNERS`** in the parent repository names an owning team for every path that the parent repository holds. Team names follow the naming convention. No line gives a sub-repository's directory an owner: its content is owned in the sub-repository, and the pull request that moves its pointer is merged without a person's approval.

| Path | Owning team |
| --- | --- |
| `libs/`, `deploy/`, `tools/`, `.github/` and `.claude/` | The platform team |
| The root files `.gitattributes`, `.gitignore`, `.gitmodules`, `CODEOWNERS`, `nx.json`, `package.json`, `package-lock.json` and `version-manifest.yaml` | The platform team |

`docs/`, `GLOSSARY.md`, `CLAUDE.md` and `.scratch/` have no owner line.

~~~text
/libs/       @contelys/platform
/deploy/     @contelys/platform
/tools/      @contelys/platform
~~~

The sub-repository of the contracts has a `CODEOWNERS` of its own. In it the team of a domain service owns `openapi/<slug>/`, `events/contelys/<slug with underscores>/` and `access/<slug>.yaml`, and the platform team owns the rest, which includes `jobs/`, `buf.yaml`, `go.mod` and `package.json`. A later line overrides an earlier one, so the general line comes first:

~~~text
*                               @contelys/platform
/openapi/projects/              @contelys/projects
/events/contelys/projects/      @contelys/projects
/access/projects.yaml           @contelys/projects
~~~

**`.gitignore`** keeps local workspace files, installed tooling, the Nx cache, the agents' local files and the documents out of the repository. Of the documents only this standard is committed, because the structure check reads it in CI:

~~~text
go.work
go.work.sum
node_modules/
.nx/
.nx/cache
.nx/workspace-data
.nx/migrate-runs
.claude/worktrees
.claude/settings.local.json
/docs/*
!/docs/LAYOUT.md
/.scratch/
~~~

The `.gitignore` of every sub-repository holds `/docs/` and `/.scratch/` beside the entries of its language. The documents live only in the working copy, and `CLAUDE.md` names their backup outside the repository.

**`.gitattributes`** forces LF line endings, because the files are rendered onto Linux hosts and a clone with `core.autocrlf=true` would otherwise check them out with CRLF. The parent repository and every sub-repository carry the file with this content:

~~~text
* text=auto eol=lf
~~~

**`version-manifest.yaml`** has a `productVersion` line in the form `<year>.<month>.<patch>` (ADR 0057), which is `0.0.0` until the first product version, a `contracts` line and one line per deployable, sorted by slug. `contracts` is the version of the shared contracts, a tag in their sub-repository, and it is `null` until they have their first version. For a deployable, `version` is its version, a tag in its sub-repository. In both cases the submodule pointer is the commit that the tag names. `digest` is the digest of the image `contelys/<slug>` that CI built from that tag. Both are `null` until the deployable has its first version. The line of Workers also has `sandboxes`, which maps each worker class to the digest of its sandbox image, `null` until CI has built that image. CI writes a version and its digest in the commit that moves the submodule pointer. A person only adds the line for a new deployable, with both values `null`, and the entry for a new worker class, with the value `null`. The work that first installs from a manifest may add fields. It adds `upgradesFrom`, the scheduled product version that this one upgrades from, such as `"2027.3"` (ADR 0057), together with the structure check's support for it.

~~~yaml
productVersion: 0.0.0
contracts: v1.3.0
deployables:
  assets: {version: v1.4.0, digest: "sha256:<digest>"}
  billing-entitlements: {version: null, digest: null}
  workers: {version: v1.2.0, digest: "sha256:<digest>", sandboxes: {image: "sha256:<digest>"}}
~~~

**`contracts/buf.yaml`** makes `contracts/events/` one buf module, with the standard lint rules and the strictest breaking-change rules:

~~~yaml
version: v2
modules:
  - path: events
lint:
  use:
    - STANDARD
breaking:
  use:
    - FILE
~~~

## Working with the repository

Clone the parent repository with its submodules and install the build tooling at the root:

~~~sh
git clone --recurse-submodules <address of contelys-cloud>
cd contelys-cloud
npm ci
~~~

In an existing clone, `git submodule update --init` checks out the submodules that are missing. Then run tasks through Nx:

~~~sh
npx nx run projects:test
npx nx run-many -t lint test build
npx nx affected -t lint test build contract-test scenario-test
npx nx graph
~~~

The first command runs one target of one project, the second runs targets for every project, the third runs them only for projects that a change affects, and the fourth shows the project graph.

A project also works without Nx, and a sub-repository cloned on its own works without the parent repository:

~~~sh
cd services/projects
GOWORK=off go test ./...
~~~

To change a deployable or a contract, work in its sub-repository: commit and push there, on that repository's branches. Do not commit the moved submodule pointer in the parent repository, because CI moves it.

To add a deployable:

1. Create the sub-repository `contelys-cloud-<slug>` with the deployable's source, its dependency manifest and lock file, its `Dockerfile`, its `.gitattributes` and its `project.json`, which has the slug as the name, the fixed target names and `contracts` in `implicitDependencies`. A Go deployable uses the module path given under "Naming convention". A deployable with external routes adds its `route-fragment.yaml`.
2. Mount it in the parent repository with `git submodule add ../contelys-cloud-<slug>.git services/<slug>`, or at `platform/<slug>` for a deployable that hosts no domain. The directory must not exist beforehand, because Git refuses to add a submodule at a path that exists.
3. If it is a domain service, add its contract directory, `openapi/<slug>/`, and its access file, `access/<slug>.yaml`, in the sub-repository of the contracts, with their lines in the `CODEOWNERS` of that sub-repository.
4. Add its line to `version-manifest.yaml`.
5. Add its row to the table under "Projects" in this document.

To release a deployable, its pipeline runs its targets, creates the version tag in the sub-repository, builds the image once and pushes it. CI in the parent repository then opens a pull request that moves the submodule pointer to the tagged commit and writes the version and the image digest into `version-manifest.yaml` in the same commit. The pull request is merged automatically once the contract tests of the set pass, and CI then builds the tooling image of the merged commit, which SaaS applies (ADR 0058).

The contracts are released the same way, without an image. Their pipeline creates the version tag in their sub-repository, and the pull request in the parent repository moves their pointer and writes the version into the `contracts` line of the manifest.

A product version is a commit of `main` that the platform team tags `product/<product version>`, and its tooling image is re-tagged, not built again. A hotfix of an older product version is cut the same way on the release branch `release/<year>.<month>` (ADR 0057).

## Where a change goes

| Change | Place |
| --- | --- |
| The behavior of a domain service | The sub-repository `contelys-cloud-<slug>`, mounted at `services/<slug>/` |
| A rule of a domain | `domain/` of its domain service |
| An operation of a domain service, with its transaction | `application/` of that domain service |
| An HTTP handler, an event consumer, a job handler or an operator command | `interfaces/` of the domain service |
| A query, a migration, or a client of another deployable or of an infrastructure product | `infrastructure/` of the domain service |
| Code that more than one layer or more than one deployable needs | The first row that fits in the table under "Shared code" |
| The behavior of Edge, Workers or Public Delivery | The sub-repository `contelys-cloud-<slug>`, mounted at `platform/<slug>/` |
| A sandbox image of Workers | `sandboxes/<worker class>/` in the sub-repository of Workers |
| Code that every Go domain service shares | `libs/service/`, released as a new library version |
| The authoring app | The sub-repository `contelys-cloud-authoring`, mounted at `apps/authoring/` |
| The API contract of a domain service | `openapi/<slug>/` in the sub-repository `contelys-cloud-contracts`, mounted at `contracts/` |
| An event schema | `events/contelys/<slug with underscores>/v1/` in the sub-repository `contelys-cloud-contracts` |
| The job-request contract of Workers | `jobs/` in the sub-repository `contelys-cloud-contracts` |
| Installing or upgrading on VMs | `deploy/ansible/` |
| The single-VM evaluation profile | `deploy/compose/` |
| The tasks of one project | That project's `project.json` |
| Settings for all tasks | `nx.json` |
| Which builds make up a product version | `version-manifest.yaml` and the submodule pointers, both written by CI |
| Which sub-repositories exist | `.gitmodules`, changed by the owner of the repository |
| A decision that more than one deployable must follow | A new decision record in `docs/adr/` |
| A decision that binds one sub-repository alone | A new decision record in `docs/adr/` of that sub-repository |
| The detailed design of a deployable | `docs/DESIGN.md` in its sub-repository |
| The overall plan of a deployable's work | `docs/PLANS.md` in its sub-repository |
| An implementation plan of a deployable | `docs/plans/` in its sub-repository |
| The record of a verification run of a deployable | `docs/verification/` in its sub-repository |
| The CI workflow | `.github/workflows/ci.yml` |
| A repository-level script, such as the structure check | `tools/` |
| A spec or an issue | `.scratch/<feature-slug>/` |
| Customer-specific configuration | A separate configuration repository, not this one |

## Structure check

CI fails when any of these statements is false. The check is the Node script `tools/structure-check.mjs`, run as `node tools/structure-check.mjs` in the parent repository with its submodules checked out. A person or an agent can check the same statements by hand.

1. The directories under `services/`, `platform/` and `apps/` are exactly the deployables in the table under "Projects", and `version-manifest.yaml` lists exactly their slugs and has a `contracts` line.
2. Every project directory contains a `project.json` whose name follows the naming convention.
3. Every deployable that has a version in `version-manifest.yaml` contains a `Dockerfile`. If it is a Go project it also contains `go.mod` and `go.sum`, and if it is a Node project, `package.json` and `package-lock.json`.
4. Every deployable lists `contracts` in `implicitDependencies`, and none lists another deployable or `libs-service`.
5. No `go.mod` contains a `replace` directive that points at a local path, and no deployable's `go.mod` requires another deployable's module.
6. No `go.work` or `go.work.sum` file is tracked.
7. Every sub-repository that has a version in `version-manifest.yaml` is a submodule whose pointer is the commit that the tag of that version names in that sub-repository.
8. In `CODEOWNERS`, every project directory that is not a sub-repository has an owner, and no sub-repository's directory has one.
9. Every directory under `platform/workers/sandboxes/` contains a `Dockerfile`, and the `sandboxes` entry of Workers in `version-manifest.yaml` lists exactly those directories.
10. `.gitmodules` lists exactly the deployables and `contracts`, each with its project directory as the path and `../contelys-cloud-<project name>.git` as the address, and no sub-repository contains a `.gitmodules` file.
11. Every directory that `.gitmodules` lists contains a `.gitattributes` file with the line `* text=auto eol=lf`.

The structure check does not look inside the source of a deployable. The `lint` target of each domain service checks its layers (rule 6 under "Layers").

## Not yet decided

The standard does not settle the following. Do not choose one silently; record the decision first.

- The HTTP framework of Collaboration. This standard names Fastify, and the detailed design of Collaboration confirms or replaces it.

## Applying the standard

1. Add the configuration files at the root, as described under "Configuration files".
2. Create the directories shown under "Directory layout". A directory with no content yet holds a `.gitkeep` file.
3. Give every project a `project.json` with its name, and with `contracts` in `implicitDependencies` if it is a deployable. Add targets as the project gains code.
4. Add `CODEOWNERS`, with a line for every path that the parent repository holds.
5. Add the structure check, `tools/structure-check.mjs`, and run it and `nx affected` in CI.
6. Replace each placeholder directory under `services/`, `platform/` and `apps/` with its submodule, as "To add a deployable" describes: the sub-repository takes over the `project.json`, the placeholder directory is deleted, and the submodule is added at the same path. The owner of the repository does this.
7. Add the CI job that moves a submodule pointer and writes the manifest.
8. Give every domain service the structure of its language, as described under "Structure of a domain service", with its first code.
