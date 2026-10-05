#!/usr/bin/env bash
# Prints the CHANGELOG.md section for one tag, without its "## [tag] - date" heading.
#
#   .github/scripts/changelog-section.sh v0.10.1 [CHANGELOG.md]
#
# Exits 1 when the tag has no section, or the section is empty, so a release cannot go
# out without notes. Used by .github/workflows/release.yml.
set -euo pipefail

tag="${1:?usage: changelog-section.sh <tag> [changelog]}"
file="${2:-CHANGELOG.md}"

section="$(awk -v tag="$tag" '
  /^## \[/ {
    if (found) exit
    # "## [v0.10.1] - 2026-08-11" -> "v0.10.1"
    name = $0
    sub(/^## \[/, "", name)
    sub(/\].*$/, "", name)
    if (name == tag) { found = 1; next }
  }
  # Link reference definitions at the bottom of the file end the last section.
  found && /^\[[^]]+\]: / { exit }
  found { print }
' "$file")"

# Trim leading and trailing blank lines.
section="$(printf '%s\n' "$section" | sed -e '/./,$!d' | tac | sed -e '/./,$!d' | tac)"

if [ -z "$section" ]; then
  echo "CHANGELOG: no section for ${tag} in ${file}. Add '## [${tag}] - YYYY-MM-DD' before tagging." >&2
  exit 1
fi

printf '%s\n' "$section"
