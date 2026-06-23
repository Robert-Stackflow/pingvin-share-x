#!/usr/bin/env bash
#
# Package the whole project into a tar.gz archive.
#
# Keeps source, config and the .git history; excludes dependencies, build
# output and runtime data (node_modules, .next, dist, logs, etc.).
#
# Usage:
#   scripts/package-project.sh [output.tar.gz]
#
# If no output path is given, the archive is written to
#   ../pingvin-share-x-<git-short-sha-or-date>.tar.gz
# (one level above the project root, so it isn't bundled into itself).

set -euo pipefail

# Resolve the project root (parent of this script's directory).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_NAME="$(basename "$PROJECT_ROOT")"

# Determine the output archive path.
if [[ $# -ge 1 ]]; then
  OUTPUT="$1"
else
  if git -C "$PROJECT_ROOT" rev-parse --short HEAD >/dev/null 2>&1; then
    TAG="$(git -C "$PROJECT_ROOT" rev-parse --short HEAD)"
  else
    TAG="$(date +%Y%m%d-%H%M%S)"
  fi
  OUTPUT="$(dirname "$PROJECT_ROOT")/${PROJECT_NAME}-${TAG}.tar.gz"
fi

# Paths to exclude (relative to the archive's top-level dir, which is the
# project folder name). .git is intentionally kept.
EXCLUDES=(
  "*/node_modules"
  "*/.next"
  "*/out"
  "*/dist"
  "*/build"
  "*/coverage"
  "*/.turbo"
  "*/backend/data"
  "*/data"
  "*/docs/build"
  "*/docs/.docusaurus"
  "*/docs/.cache-loader"
  "*.tsbuildinfo"
  "*.log"
  "*/.DS_Store"
  "*/temp"
)

EXCLUDE_ARGS=()
for pattern in "${EXCLUDES[@]}"; do
  EXCLUDE_ARGS+=(--exclude="$pattern")
done

echo "Project : $PROJECT_ROOT"
echo "Archive : $OUTPUT"
echo "Excludes: ${EXCLUDES[*]}"
echo

# Archive from the parent dir so the project folder name is the top-level
# entry inside the tarball. --exclude patterns are matched against that path.
tar -czf "$OUTPUT" \
  -C "$(dirname "$PROJECT_ROOT")" \
  "${EXCLUDE_ARGS[@]}" \
  "$PROJECT_NAME"

SIZE="$(du -h "$OUTPUT" | cut -f1)"
echo "Done. ${SIZE}  ->  $OUTPUT"
