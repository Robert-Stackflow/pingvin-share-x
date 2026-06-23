#!/usr/bin/env bash
#
# Package the whole project into a .zip archive.
#
# Keeps source, config and the .git history; excludes dependencies, build
# output and runtime data (node_modules, .next, dist, logs, etc.).
#
# Uses `zip -X` and excludes macOS metadata (.DS_Store, ._* AppleDouble,
# __MACOSX) so the archive stays clean when unpacked on Linux/Windows.
#
# Usage:
#   scripts/package-project.sh [output.zip]
#
# If no output path is given, the archive is written to
#   ../pingvin-share-x-<git-short-sha-or-date>.zip
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
  OUTPUT="$(dirname "$PROJECT_ROOT")/${PROJECT_NAME}-${TAG}.zip"
fi
# Normalise to an absolute path (zip is run from the parent dir).
case "$OUTPUT" in
  /*) ;;
  *) OUTPUT="$PWD/$OUTPUT" ;;
esac

# Glob patterns to exclude (matched against the path inside the zip, which is
# prefixed by the project folder name). .git is intentionally kept.
EXCLUDES=(
  "$PROJECT_NAME/*/node_modules/*"
  "$PROJECT_NAME/*/.next/*"
  "$PROJECT_NAME/*/out/*"
  "$PROJECT_NAME/*/dist/*"
  "$PROJECT_NAME/*/build/*"
  "$PROJECT_NAME/*/coverage/*"
  "$PROJECT_NAME/*/.turbo/*"
  "$PROJECT_NAME/backend/data/*"
  "$PROJECT_NAME/data/*"
  "$PROJECT_NAME/docs/build/*"
  "$PROJECT_NAME/docs/.docusaurus/*"
  "$PROJECT_NAME/docs/.cache-loader/*"
  "$PROJECT_NAME/*.tsbuildinfo"
  "$PROJECT_NAME/*.log"
  "$PROJECT_NAME/*/.DS_Store"
  "$PROJECT_NAME/.DS_Store"
  "$PROJECT_NAME/*/temp/*"
)

echo "Project : $PROJECT_ROOT"
echo "Archive : $OUTPUT"
echo "Excludes: ${EXCLUDES[*]}"
echo

# Remove a stale archive so zip doesn't update it in place.
rm -f "$OUTPUT"

# Zip from the parent dir so the project folder name is the top-level entry.
#   -r  recurse   -y  store symlinks as-is   -q  quiet   -X  no extra file attrs
cd "$(dirname "$PROJECT_ROOT")"
zip -ryqX "$OUTPUT" "$PROJECT_NAME" -x "${EXCLUDES[@]}"

SIZE="$(du -h "$OUTPUT" | cut -f1)"
echo "Done. ${SIZE}  ->  $OUTPUT"
