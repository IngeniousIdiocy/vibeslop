#!/usr/bin/env bash
#
# run_mcp_server.sh
# -----------------
# Bootstrap + launch script for the Banking‑Complaints MCP server.
#
# Usage:
#   ./run_mcp_server.sh            # create/refresh .venv and start server
#   ./run_mcp_server.sh --reload   # same, but auto‑reloads on code changes
#   ./run_mcp_server.sh --fresh    # delete existing .venv and recreate
#
# ---------------------------------------------------------------------------

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$PROJECT_ROOT/.venv"

# ---------------------------------------------------------------------------
# 1. Pick a Python interpreter (prefer 3.11, then 3.10, fallback to python3)
# ---------------------------------------------------------------------------
find_python() {
  for bin in python3.11 python3.10 python3; do
    if command -v "$bin" >/dev/null 2>&1; then
      "$bin" - <<'PY' || continue
import sys
major, minor = sys.version_info[:2]
sys.exit(0 if (major, minor) >= (3, 10) else 1)
PY
      if [[ $? -eq 0 ]]; then
        echo "$bin"
        return
      fi
    fi
  done
  echo >&2 "❌ No Python ≥3.10 found. Install python@3.11 via Homebrew."
  exit 1
}

PYTHON_BIN="$(find_python)"

# Flags
RELOAD=false
FRESH=false
for arg in "$@"; do
  case "$arg" in
    --reload) RELOAD=true ;;
    --fresh)  FRESH=true ;;
    *) ;;
  esac
done

# ---------------------------------------------------------------------------
# 2. (Re)create virtual environment if needed
# ---------------------------------------------------------------------------
create_venv() {
  echo "🔧 Creating virtual environment with $PYTHON_BIN ..."
  "$PYTHON_BIN" -m venv "$VENV_DIR"
}

needs_fresh_env() {
  [[ ! -d "$VENV_DIR" ]] && return 0
  if [[ "$FRESH" == true ]]; then
    return 0
  fi
  VENV_PY="$VENV_DIR/bin/python"
  [[ ! -x "$VENV_PY" ]] && return 0
  # Check interpreter version
  MAJOR=$("$VENV_PY" -c "import sys; print(sys.version_info.major)")
  MINOR=$("$VENV_PY" -c "import sys; print(sys.version_info.minor)")
  [[ $MAJOR -lt 3 || $MINOR -lt 10 ]] && return 0
  return 1
}

if needs_fresh_env; then
  rm -rf "$VENV_DIR"
  create_venv
fi

# shellcheck source=/dev/null
source "$VENV_DIR/bin/activate"

# ---------------------------------------------------------------------------
# 3. Install / upgrade dependencies
# ---------------------------------------------------------------------------
echo "📦 Installing/upgrading dependencies ..."
python -m pip install --quiet --upgrade pip
python -m pip install --quiet -r "$PROJECT_ROOT/requirements.txt"

# ---------------------------------------------------------------------------
# 4. Launch the MCP server
# ---------------------------------------------------------------------------
if $RELOAD; then
  # Requires `watchfiles` (already in requirements.txt)
  echo "🚀 Starting MCP server in auto‑reload mode on http://localhost:8000 ..."
  exec watchfiles --filter python "fastmcp run $PROJECT_ROOT/server.py --transport sse --port 8000"
else
  echo "🚀 Starting MCP server on http://localhost:8000 ..."
  exec fastmcp run "$PROJECT_ROOT/server.py" --transport sse --port 8000
fi