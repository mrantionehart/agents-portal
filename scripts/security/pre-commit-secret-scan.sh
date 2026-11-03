#!/usr/bin/env sh
# Opt-in pre-commit hook: block a commit that would add a real credential.
#
# Install (per clone — hooks are not shared by git):
#   ln -sf ../../scripts/security/pre-commit-secret-scan.sh .git/hooks/pre-commit
#
# It runs the same scanner CI runs (scripts/security/scan-secrets.mjs) over the
# tracked+staged files, so what passes here passes in CI. The CI job is the
# enforced gate; this hook just catches it before the push.
set -e
root=$(git rev-parse --show-toplevel)
exec node "$root/scripts/security/scan-secrets.mjs"
