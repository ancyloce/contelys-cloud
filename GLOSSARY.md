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

**Credential**:
What a caller presents at Edge to prove who it is.
_Avoid_: Bearer, token on its own

**Internal token**:
A short-lived signed statement of who is calling, issued by Identity once a caller is authenticated and verified by every domain service that receives it.
_Avoid_: Session token, access token

**Workload token**:
A short-lived token that Identity issues to a deployable for a call made with no user, limited to one target deployable and to the operations that caller may perform.
_Avoid_: Service token, machine token

**Ticket**:
A single-use, short-lived pass that lets a browser open one real-time connection.
_Avoid_: Token, session

### Messaging

**Event**:
A record of a fact that has happened in a domain, published to any number of subscribers.
_Avoid_: Message, worker event

**Job**:
A unit of work requested by a domain and performed by exactly one worker.
_Avoid_: Task, command, worker event

**Worker class**:
A kind of job that has its own queue, concurrency limit and sandbox image.
_Avoid_: Job type, worker type

### Versions

**Release**:
An immutable, published build of a site, owned by Publishing.
_Avoid_: Using "release" for a version of the product itself

**Product version**:
A set of deployables tested together and shipped under one version number.
_Avoid_: Release

**Version manifest**:
The list that pins the exact build of every deployable, and the version of the shared contracts, for one product version.
_Avoid_: Release manifest, lock file

**Configuration revision**:
One identified state of the desired configuration.
_Avoid_: Release, config version
