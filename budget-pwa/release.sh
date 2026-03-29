#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Pairly Release Script
#
# Usage: ./release.sh [patch|minor|major]
#   patch (default) — 1.0.0 → 1.0.1
#   minor           — 1.0.0 → 1.1.0
#   major           — 1.0.0 → 2.0.0
#
# What it does:
#   1. Bumps APP_VERSION in app.js
#   2. Bumps CACHE_NAME in sw.js (pairly-vN)
#   3. Commits the version bump on the current branch
#   4. Creates / force-updates the `production` branch
#   5. Pushes `production` to origin
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

BUMP="${1:-patch}"

# ── 1. Read current version from app.js ──────────────────────
CURRENT=$(grep -oP "(?<=APP_VERSION = ')[^']+" budget-pwa/app.js)
if [[ -z "$CURRENT" ]]; then
  echo "❌ Could not read APP_VERSION from budget-pwa/app.js"
  exit 1
fi
echo "Current version: $CURRENT"

IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"

case "$BUMP" in
  major) MAJOR=$((MAJOR+1)); MINOR=0; PATCH=0 ;;
  minor) MINOR=$((MINOR+1)); PATCH=0 ;;
  patch) PATCH=$((PATCH+1)) ;;
  *)
    echo "❌ Unknown bump type: $BUMP (use patch|minor|major)"
    exit 1
    ;;
esac

NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"
echo "New version:     $NEW_VERSION"

# ── 2. Bump APP_VERSION in app.js ────────────────────────────
sed -i "s/APP_VERSION = '$CURRENT'/APP_VERSION = '$NEW_VERSION'/" budget-pwa/app.js

# ── 3. Bump CACHE_NAME in sw.js (pairly-vN) ──────────────────
# Extract the current numeric suffix
CURRENT_CACHE=$(grep -oP "(?<=CACHE_NAME\s{8}= ')pairly-v\K[0-9]+" budget-pwa/sw.js || true)
if [[ -n "$CURRENT_CACHE" ]]; then
  NEXT_CACHE=$((CURRENT_CACHE+1))
  sed -i "s/pairly-v${CURRENT_CACHE}/pairly-v${NEXT_CACHE}/" budget-pwa/sw.js
  echo "Cache: pairly-v${CURRENT_CACHE} → pairly-v${NEXT_CACHE}"
else
  echo "⚠️  Could not parse CACHE_NAME — skipping sw.js bump"
fi

# ── 4. Stage and commit on the current branch ────────────────
git add budget-pwa/app.js budget-pwa/sw.js
git commit -m "chore: release v${NEW_VERSION}"

echo "✅ Committed v${NEW_VERSION} on $(git branch --show-current)"

# ── 5. Push to production branch ─────────────────────────────
PROD_BRANCH="production"
CURRENT_BRANCH=$(git branch --show-current)

git push origin "${CURRENT_BRANCH}:${PROD_BRANCH}" --force-with-lease \
  || git push origin "${CURRENT_BRANCH}:${PROD_BRANCH}" --force

echo "✅ Pushed to $PROD_BRANCH"
echo ""
echo "🚀 Release v${NEW_VERSION} is live on the production branch."
echo "   Users will see the update banner next time they open the app."
