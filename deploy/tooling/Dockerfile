# check=skip=CopyIgnoredFile
# The allowlist in Dockerfile.dockerignore decides what COPY . brings in.

# contelys/tooling: what an installation needs besides the deployables' images (ADR 0058), taken
# from the commits that the submodule pointers record. Built from the root of the parent repository.
# Until a CI job builds it for every commit on main (issue 02), build it locally:
#
#   docker build -f deploy/tooling/Dockerfile --build-arg COMMIT="$(git rev-parse HEAD)" \
#     --tag "contelys/tooling:$(git rev-parse HEAD)" .
#
# It carries what rendering needs so far: Edge's renderer, the version manifest, the route fragments
# and the OpenAPI contracts of the set, the Compose profile and OpenSSL for the evaluation profile's
# certificate authority. ansible-core and Identity's realm join with issue 02 and Identity's ticket 22.

# Edge's renderer, built from Edge's sub-repository (ADR 0067).
FROM golang:1.27.0-trixie@sha256:df98008ecd2b0ecc9f0a94d1b07e3564a9c92b555369b33d9b5f60d0765b2db7 AS renderer
WORKDIR /src
COPY platform/edge/go.mod platform/edge/go.sum ./
RUN GOWORK=off go mod download
COPY platform/edge/cmd ./cmd
COPY platform/edge/internal ./internal
RUN CGO_ENABLED=0 GOWORK=off go build -trimpath -o /out/edge ./cmd/edge

# The route fragment of every deployable that has one, at <slug>/route-fragment.yaml.
FROM debian:trixie-slim@sha256:8aa5a7bf5a1955bddbe7d74fcdd0b91ab30e74362a8b73af672b0481b35b44a0 AS fragments
COPY . /set
RUN mkdir -p /out/fragments && \
    for fragment in /set/services/*/route-fragment.yaml /set/platform/*/route-fragment.yaml /set/apps/*/route-fragment.yaml; do \
      [ -f "$fragment" ] || continue; \
      slug="$(basename "$(dirname "$fragment")")"; \
      mkdir -p "/out/fragments/$slug" && cp "$fragment" "/out/fragments/$slug/"; \
    done

FROM debian:trixie-slim@sha256:8aa5a7bf5a1955bddbe7d74fcdd0b91ab30e74362a8b73af672b0481b35b44a0
RUN apt-get update && apt-get install --yes --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
# The commit of the parent repository that the image was built from, which is the configuration
# revision; the image's own reference, which the Compose profile runs; and the registry of the
# deployables' images until the organization exists (D2).
ARG COMMIT=unknown
ARG TOOLING_IMAGE=contelys/tooling:${COMMIT}
ARG REGISTRY=ghcr.io/ancyloce
ENV COMMIT=${COMMIT} TOOLING_IMAGE=${TOOLING_IMAGE} REGISTRY=${REGISTRY}
COPY --from=renderer /out/edge /usr/local/bin/edge
COPY --from=fragments /out/fragments /opt/contelys/fragments
COPY version-manifest.yaml /opt/contelys/version-manifest.yaml
# The renderer checks every path of a fragment against its deployable's contract (Edge ADR 0004).
COPY contracts/openapi /opt/contelys/contracts
COPY deploy/compose/compose.yaml deploy/compose/instances.yaml deploy/compose/installation.yaml /opt/contelys/compose/
COPY deploy/tooling/tooling.sh /usr/local/bin/tooling
ENTRYPOINT ["/usr/local/bin/tooling"]
