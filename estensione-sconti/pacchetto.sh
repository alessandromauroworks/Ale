#!/usr/bin/env bash
# Crea dist/cacciasconti-<versione>.zip con i soli file dell'estensione.
set -euo pipefail
cd "$(dirname "$0")"
VERSIONE=$(python3 -c "import json;print(json.load(open('manifest.json'))['version'])")
mkdir -p dist
ZIP="dist/cacciasconti-${VERSIONE}.zip"
rm -f "$ZIP"
zip -r -X "$ZIP" manifest.json background.js cercatore.js tester.js domain.js \
  popup.html popup.css popup.js privacy.html icons recipes >/dev/null
echo "Creato $ZIP"
unzip -l "$ZIP"
