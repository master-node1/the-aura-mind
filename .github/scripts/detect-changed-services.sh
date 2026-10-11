#!/usr/bin/env bash
# Decide which services the CI/CD pipeline should act on.
#
# A "service" is any directory services/<name>/ that contains a Dockerfile and
# has a matching infra/terraform/service/services/<name>.tfvars.json.
#
# Inputs (environment variables):
#   BASE_SHA          Commit to diff from. Empty or all-zero => every service.
#   HEAD_SHA          Commit to diff to (default: HEAD).
#   REQUESTED         Optional override: "all" or a comma/space separated list
#                     of service names. When set, the git diff is ignored.
#   GITHUB_OUTPUT     When set, results are appended there for GitHub Actions.
#
# Outputs:
#   services  JSON array of service names, e.g. ["auth-service"]
#   matrix    JSON object usable as strategy.matrix:
#             {"include":[{"service":..,"runtime":..,"port":..,"health_path":..}]}
#   count     Number of selected services.
set -euo pipefail

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

TFVARS_DIR="infra/terraform/service/services"
HEAD_SHA="${HEAD_SHA:-HEAD}"
BASE_SHA="${BASE_SHA:-}"
REQUESTED="${REQUESTED:-}"

# Files whose change affects every service's build or deployment.
GLOBAL_PATTERNS=(
  '^\.github/workflows/ci-cd\.yml$'
  '^\.github/scripts/'
  '^infra/terraform/service/[^/]+\.tf$'
  '^infra/terraform/service/environments/'
  '^infra/helm/'
)

log() { echo "$*" >&2; }

all_services() {
  local dir name
  for dir in services/*/; do
    name=$(basename "$dir")
    [[ -f "$dir/Dockerfile" ]] || continue
    if [[ ! -f "$TFVARS_DIR/$name.tfvars.json" ]]; then
      log "::error::services/$name has a Dockerfile but no $TFVARS_DIR/$name.tfvars.json"
      exit 1
    fi
    echo "$name"
  done
}

mapfile -t known < <(all_services)
is_known() {
  local s
  for s in "${known[@]}"; do [[ "$s" == "$1" ]] && return 0; done
  return 1
}

selected=()
if [[ -n "${REQUESTED// /}" ]]; then
  if [[ "${REQUESTED// /}" == "all" ]]; then
    selected=("${known[@]}")
  else
    for s in ${REQUESTED//,/ }; do
      if ! is_known "$s"; then
        log "::error::Unknown service '$s'. Known services: ${known[*]}"
        exit 1
      fi
      selected+=("$s")
    done
  fi
  log "Using requested services: ${selected[*]}"
elif [[ -z "$BASE_SHA" || "$BASE_SHA" =~ ^0+$ ]]; then
  log "No base commit (new branch or first push): selecting all services."
  selected=("${known[@]}")
elif ! changed=$(git diff --name-only "$BASE_SHA" "$HEAD_SHA" 2>/dev/null); then
  log "::warning::Cannot diff $BASE_SHA..$HEAD_SHA (history rewritten?): selecting all services."
  selected=("${known[@]}")
else
  global=false
  declare -A hit=()
  while IFS= read -r file; do
    [[ -n "$file" ]] || continue
    for pattern in "${GLOBAL_PATTERNS[@]}"; do
      if [[ "$file" =~ $pattern ]]; then
        log "Global change: $file"
        global=true
      fi
    done
    if [[ "$file" =~ ^services/([^/]+)/ || "$file" =~ ^$TFVARS_DIR/([^/]+)\.tfvars\.json$ ]]; then
      name="${BASH_REMATCH[1]}"
      if is_known "$name"; then hit[$name]=1; fi
    fi
  done <<< "$changed"

  if [[ "$global" == true ]]; then
    selected=("${known[@]}")
  else
    for s in "${known[@]}"; do
      [[ -n "${hit[$s]:-}" ]] && selected+=("$s")
    done
  fi
fi

# De-duplicate while keeping order.
declare -A seen=()
unique=()
for s in "${selected[@]}"; do
  [[ -n "${seen[$s]:-}" ]] && continue
  seen[$s]=1
  unique+=("$s")
done

runtime_of() {
  if [[ -f "services/$1/package.json" ]]; then echo node
  elif [[ -f "services/$1/requirements.txt" ]]; then echo python
  else echo static
  fi
}

entries="[]"
for s in "${unique[@]}"; do
  entries=$(jq -c \
    --arg service "$s" \
    --arg runtime "$(runtime_of "$s")" \
    --slurpfile cfg "$TFVARS_DIR/$s.tfvars.json" \
    '. + [{service: $service, runtime: $runtime,
           port: $cfg[0].container_port, health_path: $cfg[0].health_check_path}]' \
    <<< "$entries")
done

services=$(jq -c '[.[].service]' <<< "$entries")
matrix=$(jq -c '{include: .}' <<< "$entries")
count=$(jq 'length' <<< "$entries")

log "Selected $count service(s): $services"
echo "services=$services"
echo "matrix=$matrix"
echo "count=$count"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "services=$services"
    echo "matrix=$matrix"
    echo "count=$count"
  } >> "$GITHUB_OUTPUT"
fi
