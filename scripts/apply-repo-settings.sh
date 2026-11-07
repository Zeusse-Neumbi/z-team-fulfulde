#!/usr/bin/env bash

set -euo pipefail

root=$(CDPATH= cd "$(dirname "$0")/.." && pwd)
cd "$root"

repo="${GITHUB_REPOSITORY:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}"

if [ -z "$repo" ]; then
  printf 'Could not determine the GitHub repository. Set GITHUB_REPOSITORY=owner/name.\n' >&2
  exit 1
fi

printf 'Applying repository settings to %s\n' "$repo"

# Squash-only merges, delete merged head branches.
gh api -X PATCH "repos/$repo" \
  -F allow_squash_merge=true \
  -F allow_merge_commit=false \
  -F allow_rebase_merge=false \
  -F delete_branch_on_merge=true \
  -F allow_auto_merge=false >/dev/null

# Keep workflow tokens read-only unless a workflow explicitly needs more.
gh api -X PUT "repos/$repo/actions/permissions/workflow" \
  -f default_workflow_permissions=read \
  -F can_approve_pull_request_reviews=false >/dev/null

# Turn on the repository security features that Dependabot and reporting rely on.
gh api -X PUT "repos/$repo/vulnerability-alerts" >/dev/null
gh api -X PUT "repos/$repo/automated-security-fixes" >/dev/null
gh api -X PUT "repos/$repo/private-vulnerability-reporting" >/dev/null

apply_ruleset() {
  local file=$1
  local name
  name=$(node -e 'const fs=require("node:fs");const data=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(data.name)' "$file")

  local id
  id=$(gh api "repos/$repo/rulesets" --jq ".[] | select(.name == \"$name\") | .id" | head -n 1)

  if [ -n "$id" ]; then
    printf 'Updating ruleset %s (%s)\n' "$name" "$id"
    gh api -X PUT "repos/$repo/rulesets/$id" --input "$file" >/dev/null
  else
    printf 'Creating ruleset %s\n' "$name"
    gh api -X POST "repos/$repo/rulesets" --input "$file" >/dev/null
  fi
}

apply_ruleset .github/rulesets/main-protection.json
apply_ruleset .github/rulesets/release-tags.json

printf 'Repository settings applied.\n'
