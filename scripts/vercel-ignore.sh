#!/usr/bin/env bash
# Vercel Ignored Build Step helper for the keel monorepo.
#
# Exit 0 = skip the build. Exit 1 = proceed.
# Vercel runs this from each project's Root Directory (apps/web, apps/docs,
# apps/sites). The script always resolves the repo root itself.
#
# Usage (vercel.json ignoreCommand):
#   bash ../../scripts/vercel-ignore.sh web
#   bash ../../scripts/vercel-ignore.sh docs
#   bash ../../scripts/vercel-ignore.sh sites
#
# Dashboard equivalent (only needed if vercel.json is not honored):
#   Settings → Git → Ignored Build Step → Custom, same one-liner as above.
#
# Optional overrides (local testing):
#   VERCEL_IGNORE_FILES=$'apps/docs/foo.md' bash scripts/vercel-ignore.sh web
#   VERCEL_IGNORE_COMPARE='HEAD^ HEAD' bash scripts/vercel-ignore.sh docs

set -uo pipefail

proceed() {
  echo "[vercel-ignore] proceed: $*"
  exit 1
}

skip() {
  echo "[vercel-ignore] skip: $*"
  exit 0
}

APP="${1:-}"
case "$APP" in
web | docs | sites) ;;
*)
  proceed "unknown app '${APP:-}' (expected web|docs|sites)"
  ;;
esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT" || proceed "could not cd to repo root ${REPO_ROOT}"

echo "[vercel-ignore] app=${APP} env=${VERCEL_ENV:-unknown} ref=${VERCEL_GIT_COMMIT_REF:-unknown} root=${REPO_ROOT}"

# True if $1 is under one of the remaining args (exact file or directory prefix).
path_matches() {
  local file="$1"
  shift
  local pattern
  for pattern in "$@"; do
    if [[ "$pattern" == */ ]]; then
      if [[ "$file" == "${pattern}"* || "$file" == "${pattern%/}" ]]; then
        return 0
      fi
    elif [[ "$file" == "$pattern" ]]; then
      return 0
    fi
  done
  return 1
}

CHANGED_FILES=""
if [[ -n "${VERCEL_IGNORE_FILES:-}" ]]; then
  CHANGED_FILES="$VERCEL_IGNORE_FILES"
else
  COMPARE_FROM="HEAD^"
  COMPARE_TO="HEAD"
  if [[ -n "${VERCEL_IGNORE_COMPARE:-}" ]]; then
    # shellcheck disable=SC2086
    set -- $VERCEL_IGNORE_COMPARE
    COMPARE_FROM="$1"
    COMPARE_TO="${2:-HEAD}"
  fi

  if ! git rev-parse --verify --quiet "$COMPARE_FROM" >/dev/null; then
    proceed "missing compare ref ${COMPARE_FROM} (first commit or shallow clone)"
  fi
  if ! git rev-parse --verify --quiet "$COMPARE_TO" >/dev/null; then
    proceed "missing compare ref ${COMPARE_TO}"
  fi

  echo "[vercel-ignore] comparing ${COMPARE_FROM}..${COMPARE_TO}"
  if ! CHANGED_FILES="$(git diff --name-only "$COMPARE_FROM" "$COMPARE_TO")"; then
    proceed "git diff failed"
  fi
fi

if [[ -z "${CHANGED_FILES//[$'\n' ]/}" ]]; then
  skip "empty diff"
fi

echo "[vercel-ignore] changed files:"
printf '%s\n' "$CHANGED_FILES" | sed 's/^/[vercel-ignore]   /'

WEB_SKIP_ONLY=(
  "apps/docs/"
  "apps/sites/"
)

# Shared workspace / install inputs that affect every Vercel app.
WORKSPACE_PATHS=(
  "pnpm-lock.yaml"
  "pnpm-workspace.yaml"
  "package.json"
  "turbo.json"
  ".npmrc"
)

DOCS_PATHS=(
  "apps/docs/"
  "tooling/typescript/"
  "patches/"
  "${WORKSPACE_PATHS[@]}"
)

SITES_PATHS=(
  "apps/sites/"
  "packages/site-blocks-core/"
  "packages/site-blocks-workspaces/"
  "tooling/typescript/"
  "${WORKSPACE_PATHS[@]}"
)

all_match() {
  local file
  while IFS= read -r file; do
    [[ -z "$file" ]] && continue
    path_matches "$file" "$@" || return 1
  done <<<"$CHANGED_FILES"
  return 0
}

first_match() {
  local file
  while IFS= read -r file; do
    [[ -z "$file" ]] && continue
    if path_matches "$file" "$@"; then
      printf '%s' "$file"
      return 0
    fi
  done <<<"$CHANGED_FILES"
  return 1
}

case "$APP" in
web)
  if all_match "${WEB_SKIP_ONLY[@]}"; then
    skip "diff is only apps/docs and/or apps/sites"
  fi
  proceed "web-relevant path changed (apps/web, packages/, lockfile, or workspace config)"
  ;;
docs)
  if MATCH="$(first_match "${DOCS_PATHS[@]}")"; then
    proceed "docs-relevant path changed (${MATCH})"
  fi
  skip "no docs, docs packages, lockfile, or workspace-config changes"
  ;;
sites)
  if MATCH="$(first_match "${SITES_PATHS[@]}")"; then
    proceed "sites-relevant path changed (${MATCH})"
  fi
  skip "no sites, site-blocks, lockfile, or workspace-config changes"
  ;;
esac

# Never skip if control flow is wrong — especially a production web deploy.
if [[ "$APP" == "web" && ( "${VERCEL_ENV:-}" == "production" || "${VERCEL_GIT_COMMIT_REF:-}" == "main" ) ]]; then
  proceed "fallback: build production web rather than skip"
fi
proceed "fallback: unsure, building"
