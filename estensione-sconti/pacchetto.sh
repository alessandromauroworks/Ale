#!/usr/bin/env bash
# Crea due pacchetti in dist/: uno per Chrome/Edge/Brave/Opera e uno per Firefox (manifest adattato).
set -euo pipefail
cd "$(dirname "$0")"
VERSIONE=$(python3 -c "import json;print(json.load(open('manifest.json'))['version'])")
mkdir -p dist
FILE="manifest.json background.js cercatore.js tester.js domain.js estrattore.js popup.html popup.css popup.js privacy.html CHANGELOG.md icons recipes"
costruisci() { # $1 = chrome | firefox
  local TMP; TMP=$(mktemp -d)
  mkdir -p "$TMP/p"
  # shellcheck disable=SC2086
  cp -r $FILE "$TMP/p/"
  python3 - "$1" "$TMP/p/manifest.json" <<'PY'
import json, sys
tipo, path = sys.argv[1], sys.argv[2]
m = json.load(open(path))
if tipo == "chrome":
    m["background"] = {"service_worker": "background.js"}
    m.pop("browser_specific_settings", None)
    m["content_scripts"][0].pop("match_origin_as_fallback", None) if False else None
else:
    m["background"] = {"scripts": m["background"]["scripts"]}
json.dump(m, open(path, "w"), indent=2, ensure_ascii=False)
PY
  local ZIP="dist/cacciasconti-${VERSIONE}-$1.zip"
  rm -f "$ZIP"
  (cd "$TMP/p" && zip -r -X "$OLDPWD/$ZIP" . >/dev/null)
  rm -rf "$TMP"
  echo "Creato $ZIP"
}
rm -f dist/cacciasconti-${VERSIONE}.zip
costruisci chrome
costruisci firefox
unzip -l "dist/cacciasconti-${VERSIONE}-chrome.zip" | tail -25
