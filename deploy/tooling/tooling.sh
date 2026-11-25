#!/bin/sh
# The commands of the tooling image (ADR 0058) for the single-VM evaluation profile.
#
#   tooling compose <dir>     writes the Compose project into <dir>, with the images that the version
#                             manifest pins; docker compose up then starts it. It needs the Docker
#                             socket mounted, to learn the group that may use it
#   tooling render            creates the certificate authority at the first start, issues Edge's
#                             certificates and renders Edge's configuration into /state
#   tooling confirm           confirms that the running Edge applied the rendered revision, through
#                             its internal and control listeners on the host's loopback address
#   tooling apply             renders, then confirms: a route change
#   tooling certificate <name>  issues a certificate for the workload <name> from the authority
#
# render, confirm and certificate run as the user apisix (uid 636), so that Edge can read what they
# write. render also needs the Docker socket, the host's network and EDGE_IMAGE, the pinned image of
# Edge, because its trial load starts a throwaway Edge through the Docker engine (Edge ADR 0004), and
# confirm needs the host's network (Edge ADR 0005).
set -eu

SET=/opt/contelys
STATE=/state
CA=$STATE/ca
# The authority lives on the evaluation host (ADR 0039), and a certificate it issues lives 90 days and
# is issued again when 30 remain.
CA_DAYS=1825
DAYS=90
RENEW_SECONDS=2592000

fail() {
  echo "tooling: $*" >&2
  exit 1
}

# digest prints the image digest that the version manifest pins for the deployable $1, quoted as the
# layout standard writes it or plain.
digest() {
  sed -n "s/^  $1: {version: [^,]*, digest: \"\{0,1\}\([^,}\"]*\)\"\{0,1\}[,}].*$/\1/p" "$SET/version-manifest.yaml"
}

# gateway prints the address of the default route, which is the Docker host on the default bridge:
# the address that host-gateway names, where the profile's containers reach each other.
gateway() {
  hex=$(awk '$2 == "00000000" { print $3; exit }' /proc/net/route)
  [ -n "$hex" ] || fail "this container has no default route"
  printf '%d.%d.%d.%d\n' "0x${hex#??????}" "0x$(echo "$hex" | cut -c5-6)" "0x$(echo "$hex" | cut -c3-4)" "0x$(echo "$hex" | cut -c1-2)"
}

compose() {
  out=$1
  [ -d "$out" ] || fail "compose: $out is not a directory"
  [ -S /var/run/docker.sock ] || fail "compose: mount the Docker socket with -v /var/run/docker.sock:/var/run/docker.sock:ro, so that the group that may use it is known"
  edge=$(digest edge)
  case $edge in
    sha256:*) ;;
    *) fail "compose: the version manifest pins no image of edge" ;;
  esac
  cp "$SET/compose/compose.yaml" "$SET/compose/instances.yaml" "$out/"
  # The installation file is the evaluator's: it is written once and never replaced.
  [ -e "$out/installation.yaml" ] || cp "$SET/compose/installation.yaml" "$out/"
  {
    echo "TOOLING_IMAGE=$TOOLING_IMAGE"
    echo "EDGE_IMAGE=$REGISTRY/edge@$edge"
    echo "HOST_GATEWAY=$(gateway)"
    echo "DOCKER_GID=$(stat -c %g /var/run/docker.sock)"
  } > "$out/.env"
  # Compose checks every bind source when it creates the containers, before render has run, so the
  # files that render later renames into place exist from the start.
  mkdir -p "$out/state/rendered/edge" "$out/state/secrets"
  touch "$out/state/rendered/config.yaml" "$out/state/secrets/ca.crt"
  chown -R 636:636 "$out/state"
  chmod 700 "$out/state"
  echo "Wrote the Compose project to $out. Start it there with: docker compose up -d"
}

authority() {
  [ -f "$CA/ca.key" ] && return
  mkdir -p "$CA"
  openssl req -x509 -new -noenc -newkey ec -pkeyopt ec_paramgen_curve:P-256 \
    -keyout "$CA/ca.key" -out "$CA/ca.crt" -days "$CA_DAYS" -subj "/CN=Contelys evaluation authority" \
    -addext "basicConstraints=critical,CA:TRUE" -addext "keyUsage=critical,keyCertSign,cRLSign" 2>/dev/null
  chmod 600 "$CA/ca.key"
}

# issue <directory> <file name> <DNS name>... issues a certificate for the names, unless the one in
# place still has more than 30 days to run.
issue() {
  dir=$1
  name=$2
  shift 2
  if [ -f "$dir/$name.crt" ] && openssl x509 -in "$dir/$name.crt" -noout -checkend "$RENEW_SECONDS" >/dev/null; then
    return
  fi
  names=""
  for dns in "$@"; do
    names="${names:+$names,}DNS:$dns"
  done
  mkdir -p "$dir"
  openssl req -x509 -new -noenc -newkey ec -pkeyopt ec_paramgen_curve:P-256 \
    -CA "$CA/ca.crt" -CAkey "$CA/ca.key" -keyout "$dir/$name.key.new" -out "$dir/$name.crt.new" \
    -days "$DAYS" -subj "/CN=$1" -addext "subjectAltName=$names" -addext "basicConstraints=critical,CA:FALSE" \
    -addext "keyUsage=critical,digitalSignature" -addext "extendedKeyUsage=serverAuth,clientAuth" 2>/dev/null
  chmod 600 "$dir/$name.key.new"
  mv "$dir/$name.key.new" "$dir/$name.key"
  mv "$dir/$name.crt.new" "$dir/$name.crt"
}

# setting <key> prints a value of the installation file, which holds one "key: value" per line.
setting() {
  sed -n "s/^$1: *\([^ #]*\).*$/\1/p" /etc/contelys/installation.yaml
}

render() {
  [ -n "${EDGE_IMAGE:-}" ] || fail "render: EDGE_IMAGE names no image of edge"
  authority
  application=$(setting application_hostname)
  authentication=$(setting authentication_hostname)
  [ -n "$application" ] && [ -n "$authentication" ] || fail "render: the installation file names no hostnames"
  issue "$STATE/secrets" application "$application" "$authentication"
  # Edge's own certificate, for the name edge, serves its internal listener.
  issue "$STATE/secrets" edge edge
  cp "$CA/ca.crt" "$STATE/secrets/ca.crt"
  edge render --instances /etc/contelys/instances.yaml --installation /etc/contelys/installation.yaml \
    --fragments "$SET/fragments" --contracts "$SET/contracts" --secrets "$STATE/secrets" --revision "$COMMIT" \
    --image "$EDGE_IMAGE" --out "$STATE/rendered"
}

# confirm reads the fixed-response route of the profile's one Edge instance, named edge in the
# instances file, and the ids that its control listener reports (Edge detailed design, section 03).
confirm() {
  edge confirm --out "$STATE/rendered" --instance edge --revision "$COMMIT" \
    --internal 127.0.0.1:9444 --control 127.0.0.1:9090 --secrets "$STATE/secrets"
}

certificate() {
  authority
  issue "$STATE/certs" "$1" "$1"
  cp "$CA/ca.crt" "$STATE/certs/ca.crt"
}

case "${1:-}" in
  compose) [ $# -eq 2 ] || fail "usage: tooling compose <dir>"; compose "$2" ;;
  render) [ $# -eq 1 ] || fail "usage: tooling render"; render ;;
  confirm) [ $# -eq 1 ] || fail "usage: tooling confirm"; confirm ;;
  # Not render && confirm: within an AND-OR list sh ignores set -e, also in the functions it calls.
  apply) [ $# -eq 1 ] || fail "usage: tooling apply"; render; confirm ;;
  certificate) [ $# -eq 2 ] || fail "usage: tooling certificate <name>"; certificate "$2" ;;
  *) fail "usage: tooling compose <dir> | render | confirm | apply | certificate <name>" ;;
esac
