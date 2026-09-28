#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
py="$PWD/ml/.venv/bin/python"
[[ -x "$py" && -f web/.output/server/index.mjs && -f .env ]] || { echo 'Run setup-linux.sh first'; exit 1; }
# Quote values instead of interpreting .env contents as shell commands.
eval "$("$py" -c 'import re,shlex;from dotenv import dotenv_values;print("\n".join("export "+k+"="+shlex.quote(v) for k,v in dotenv_values(".env").items() if v is not None and re.fullmatch("[A-Z_][A-Z_0-9]*",k)))')"
export HF_HOME="${HF_HOME:-$PWD/data/model-cache}"
export EASYOCR_MODULE_PATH="${EASYOCR_MODULE_PATH:-$PWD/data/easyocr}"
export CATALOG_IMAGES_DIR="$PWD/data/catalog/images"
export HF_HUB_OFFLINE=1
mkdir -p data/runtime
docker compose up -d --wait db
port_open() { "$py" -c 'import socket,sys;s=socket.socket();s.settimeout(1);sys.exit(s.connect_ex(("127.0.0.1",int(sys.argv[1]))))' "$1"; }
if ! port_open 8001; then
  nohup "$py" -m uvicorn wine_ml.service:app --host 127.0.0.1 --port 8001 >data/runtime/ml.log 2>&1 &
  echo "$!" >data/runtime/ml.pid
fi
if ! port_open "${PORT:-8080}"; then
  nohup node web/.output/server/index.mjs >data/runtime/web.log 2>&1 &
  echo "$!" >data/runtime/web.pid
fi
"$py" scripts/wait_ready.py --url "http://127.0.0.1:${PORT:-8080}"
