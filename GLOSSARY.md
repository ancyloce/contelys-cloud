# Contelys Cloud

A content creation and publishing platform delivered as SaaS and as private installations. This glossary fixes the words used in its architecture documents.

## Language

### Architecture

**Domain**:
A boundary that owns a set of business facts and the contracts, decisions and recovery for them.
_Avoid_: Service on its own, microservice

**Deployable**:
A separately shipped and versioned process.
_Avoid_: Service on its own

**Domain service**:
A deployable that hosts exactly one domain and is released by that domain's team.
_Avoid_: Microservice, Core

**Edge**:
The deployable that receives authoring and API traffic and routes calls between deployables. It hosts no domain.
_Avoid_: Gateway service, API gateway

**Workers**:
The deployable that performs jobs in sandboxes. It hosts no domain.
_Avoid_: Worker service, job runner

**Public Delivery**:
The deployable that serves published sites to visitors. It hosts no domain.
_Avoid_: Delivery on its own (it also means notification delivery), CDN

**Authoring**:
The deployable that serves the authoring app, the single-page app that authors work in. It hosts no domain.
_Avoid_: Static-file host, frontend service

**Route fragment**:
The list of external routes that a deployable ships for Edge to publish.
_Avoid_: Route config, gateway rule

**Traffic class**:
A kind of traffic at Edge that shares one set of limits, timeouts and sizes.
_Avoid_: Profile, tier

**Listener**:
One of Edge's entry points, set apart by who can reach it and what traffic it carries, such as the external listener and the internal listener.
_Avoid_: Port, endpoint

**Parent repository**:
The repository that brings the sub-repositories together and records which commit of each belongs to the tested set.
_Avoid_: Umbrella repository

**Sub-repository**:
The repository of one deployable, or the one that holds the shared contracts.
_Avoid_: Component repository, module

### Access

**Identity provider**:
The product that keeps credentials and login sessions. Identity is the domain built around it, not the product.
_Avoid_: Identity for the product

**Principal**:
The application's own identity for one person, under an identifier that is never reused.
_Avoid_: User ID, account, subject

**Subject**:
The identity provider's identifier for one of its accounts, unique only together with its issuer.
_Avoid_: Principal, user ID

**Admission**:
Identity's decision, made for each request, that the caller's principal may use the application now.
_Avoid_: Authorization, commit admission

**Session**:
Identity's record that a browser is signed in as a principal.
_Avoid_: Login session, token

**Editing session**:
Collaboration's record that a principal is connected to a page for real-time editing.
_Avoid_: Session on its own, live session, connection

**Credential**:
What a caller presents at Edge to prove who it is.
_Avoid_: Bearer, token on its own

**Internal token**:
A short-lived signed statement of who is calling, issued by Identity once a caller is authenticated and verified by every domain service that receives it.
_Avoid_: Session token, access token

**Workload token**:
A short-lived token that Identity issues to a deployable for a call made with no user, limited to one target deployable and to the operations that caller may perform.
_Avoid_: Service token, machine token

**Limit key**:
An opaque identifier of an authenticated caller, issued by Identity, by which Edge counts that caller's rate limit.
_Avoid_: Rate-limit ID, user ID, principal ID

**Strict revocation**:
A revocation that is complete only when no protected write under the revoked authority can still commit.
_Avoid_: Hard revocation, instant revocation

**Authority version**:
A counter that an authority raises with every strict revocation, so that a decision made under a lower value can be refused.
_Avoid_: Epoch, generation

**Minimum authority version**:
The lowest authority version that a registered domain service still accepts for one principal or one membership.
_Avoid_: Floor, fence

**Write barrier**:
The check inside a domain service's commit that refuses a protected write made under a revoked authority version.
_Avoid_: Fence, commit admission, commit barrier

**Registered domain service**:
A domain service that holds protected writes, so that every authority installs its minimum authority versions there and waits for its acknowledgement.
_Avoid_: Participant, subscriber

### Organizations

**Organization**:
The body that owns projects and sites and that people belong to as members. No role reaches from one organization into another.
_Avoid_: Workspace, account, team

**Member**:
A principal that belongs to an organization. One principal can be a member of several organizations.
_Avoid_: User, collaborator

**Scope**:
An organization, a project or a site, as the thing a role is held on.
_Avoid_: Resource, root, node

**Role**:
What a member may do on a scope and on the scopes inside it: Viewer, Editor, Publisher or Admin, each including the one before, and Owner on an organization alone.
_Avoid_: Permission, binding, grant

**Invitation**:
An offer to the person behind one email address of one role on one scope of an organization.
_Avoid_: Invite link, invite token

### Messaging

**Event**:
A record of a fact that has happened in a domain, published to any number of subscribers.
_Avoid_: Message, worker event

**Event family**:
The events about one kind of thing in one domain, published on one topic and ordered by that thing's identifier.
_Avoid_: Event stream, and "topic" for the family itself

**Job**:
A unit of work requested by a domain and performed by exactly one worker.
_Avoid_: Task, command, worker event

**Worker class**:
A kind of job that has its own queue, concurrency limit and sandbox image.
_Avoid_: Job type, worker type

### Notifications

**Notification**:
The record of what one event obliges Notifications to send, with its recipients and template inputs frozen.
_Avoid_: Intent, message

**Notification delivery**:
One notification on its way to one recipient through one channel.
_Avoid_: Delivery on its own, send

**Send attempt**:
One submission of a notification delivery to the mail server.
_Avoid_: Retry, try

**Uncertain send**:
A send attempt that ended without a reply from the mail server that decides whether it accepted the message.
_Avoid_: Failed send, lost email, unknown

### Versions

**Release**:
An immutable, published build of a site, owned by Publishing.
_Avoid_: Using "release" for a version of the product itself

**Delivery map**:
Publishing's projection that tells Public Delivery which release each hostname serves.
_Avoid_: Routing table, active pointer

**Product version**:
A set of deployables tested together and shipped under one version number.
_Avoid_: Release

**Version manifest**:
The list that pins the exact build of every deployable, and the version of the shared contracts, for one product version.
_Avoid_: Release manifest, lock file

**Tooling image**:
The image of one tested set that carries everything an installation needs besides the deployables' own images: the version manifest, the deployment code, the route fragments and the contracts.
_Avoid_: Installer, deploy bundle

**Configuration revision**:
One identified state of the desired configuration.
_Avoid_: Release, config version

**Test baseline**:
The exact version of a third-party product that a deployable is verified against, and the only version of that product that can be approved for production.
_Avoid_: Supported version, target version, reference version
