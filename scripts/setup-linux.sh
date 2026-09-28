#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
mode=${1:---cpu}
case "$mode" in --cpu) torch_index=https://download.pytorch.org/whl/cpu;; --cuda) torch_index=https://download.pytorch.org/whl/cu128;; *) echo 'Usage: bash scripts/setup-linux.sh --cpu|--cuda [dataset.zip]'; exit 2;; esac
for cmd in python3 node npm docker; do command -v "$cmd" >/dev/null || { echo "Missing dependency: $cmd"; exit 1; }; done
if [[ ! -f .env ]]; then cp .env.example .env; fi
python3 -m venv ml/.venv
py="$PWD/ml/.venv/bin/python"
"$py" -m pip install --upgrade pip
"$py" -m pip install 'torch==2.11.0' 'torchvision==0.26.0' --index-url "$torch_index"
"$py" -m pip install -c ml/constraints.txt -e 'ml[dev]'
if [[ -n ${2:-} ]]; then
  command -v 7zz >/dev/null || { echo 'Install the official 7-Zip console (7zz, RAR support), then retry.'; exit 1; }
  "$py" scripts/prepare_dataset.py --archive "$2"
fi
[[ -f data/raw/strapi_output0709.csv ]] || { echo 'Dataset missing. Pass the organizer ZIP as the second argument.'; exit 1; }
export HF_HOME="$PWD/data/model-cache"
export EASYOCR_MODULE_PATH="$PWD/data/easyocr"
if [[ "$mode" == --cuda ]]; then export DEVICE=cuda; else export DEVICE=cpu; fi
docker compose up -d --wait db
"$py" scripts/migrate_db.py
"$py" ml/scripts/build_catalog.py
"$py" ml/scripts/load_catalog.py
"$py" ml/scripts/build_index.py --batch 4
(cd web && npm ci && npm run typecheck && npm test && npm run build)
echo 'Setup complete. Run: bash scripts/start-linux.sh'
