#!/usr/bin/env bash
# HEAD-check every painting URL in data/mysteries.json via curl. Reports
# broken URLs (non-2xx final status, or non-image content-type).
set -uo pipefail

cd "$(dirname "$0")/.."

# Extract all painting URLs with their (artist | title | mystery id).
python3 -c '
import json
d = json.load(open("data/mysteries.json"))
for s in d.values():
    for m in s["mysteries"]:
        for p in m["paintings"]:
            print(m["id"] + "|" + p["artist"] + "|" + p["title"] + "|" + p["url"])
' > /tmp/lr-painting-rows.txt

total=$(wc -l < /tmp/lr-painting-rows.txt)
echo "Checking $total paintings (this can take a couple of minutes)..."

ok=0
bad=0
> /tmp/lr-painting-broken.txt

check_one() {
  local row="$1"
  IFS='|' read -r mid artist title url <<< "$row"
  # -L follow redirects, -s silent, -o discard body, -m timeout
  result=$(curl -sL -o /dev/null -m 20 \
    -A "LuxRosariiPaintingChecker/1.0 (testing image links)" \
    -w "%{http_code}|%{content_type}" "$url" 2>/dev/null)
  status="${result%%|*}"
  ctype="${result##*|}"
  if [[ "$status" == "200" && "$ctype" == image/* ]]; then
    echo "OK"
  else
    echo "BAD|$mid|$artist|$title|$status|$ctype|$url"
  fi
}

export -f check_one

# Run in parallel — xargs -P keeps it fast without melting Wikimedia.
> /tmp/lr-painting-results.txt
while IFS= read -r row; do
  echo "$row"
done < /tmp/lr-painting-rows.txt | xargs -d '\n' -I{} -P 12 bash -c 'check_one "$@"' _ {} > /tmp/lr-painting-results.txt
results=$(cat /tmp/lr-painting-results.txt)

ok=$(echo "$results" | grep -c "^OK$" || true)
bad_lines=$(echo "$results" | grep -E "^BAD\|" || true)
bad=$(echo "$bad_lines" | grep -c "^BAD" || true)

echo ""
echo "OK:     $ok / $total"
echo "Broken: $bad"

if [[ -n "$bad_lines" ]]; then
  echo ""
  echo "--- Broken URLs ---"
  echo "$bad_lines" | while IFS='|' read -r tag mid artist title status ctype url; do
    printf "  %-14s  %-30s  %s\n" "$mid" "$artist" "$title"
    printf "                  status=%s  ctype=%s\n" "$status" "$ctype"
    printf "                  %s\n" "$url"
  done
fi

[[ $bad -eq 0 ]]
