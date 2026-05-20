#!/usr/bin/env bash
# Fetch GitHub Pages traffic stats for every demo repo and write a
# combined snapshot the Mission Control frontend reads.
#
# Requires gh CLI + a token with `Administration: Read` permission on each
# of the demo repos. Set $GITHUB_TOKEN before running.
#
# Run from anywhere; output is fixed to console-app/frontend/public/data/.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$REPO_ROOT/frontend/public/data/github_traffic.json"
OWNER="fivetran-jasonchletsos"

# Keep in sync with console-app/frontend/public/data/demos.json keys.
DEMOS=(
  "tax-assessment-databricks-demo"
  "FinServ-ODI-Demo"
  "Insurance-ODI-Demo"
  "Media-ODI-Demo"
  "RetailEcom-ODI-Demo"
  "TechSaaS-ODI-Demo"
  "SupplyChain-ODI-Demo"
  "LifeSci-ODI-Demo"
  "ODI-Mission-Control"
  "What_Is_ODI_Demo"
  "SAP-ODI-Demo"
  "LinerNotes-ODI-Demo"
  "Peters-Must-See-Movies"
)

echo "Fetching GitHub traffic for ${#DEMOS[@]} repos…"

NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
TMP="$(mktemp)"

echo '{' > "$TMP"
echo "  \"fetched_at\": \"$NOW\"," >> "$TMP"
echo "  \"owner\": \"$OWNER\"," >> "$TMP"
echo '  "demos": [' >> "$TMP"

for i in "${!DEMOS[@]}"; do
  REPO="${DEMOS[$i]}"
  echo "  · $REPO"

  VIEWS_JSON="$(gh api "repos/$OWNER/$REPO/traffic/views" 2>/dev/null || echo '{"count":0,"uniques":0,"views":[]}')"
  PATHS_JSON="$(gh api "repos/$OWNER/$REPO/traffic/popular/paths" 2>/dev/null || echo '[]')"
  REFS_JSON="$(gh api "repos/$OWNER/$REPO/traffic/popular/referrers" 2>/dev/null || echo '[]')"

  echo "    {" >> "$TMP"
  echo "      \"repo\": \"$REPO\"," >> "$TMP"
  echo "      \"views_14d\": $VIEWS_JSON," >> "$TMP"
  echo "      \"popular_paths\": $PATHS_JSON," >> "$TMP"
  echo "      \"top_referrers\": $REFS_JSON" >> "$TMP"
  if [ "$i" -lt $((${#DEMOS[@]} - 1)) ]; then
    echo "    }," >> "$TMP"
  else
    echo "    }" >> "$TMP"
  fi
done

echo '  ]' >> "$TMP"
echo '}' >> "$TMP"

mkdir -p "$(dirname "$OUT")"
mv "$TMP" "$OUT"
echo "Wrote $OUT ($(wc -c < "$OUT") bytes)"
