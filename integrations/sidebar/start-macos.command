#!/bin/zsh
# User-invoked launcher. Never quit an existing client or change its bundle.
set -eu
SIDEBAR_DIR="${0:A:h}"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

fail() {
  print -r -- "$1"
  if [[ -t 0 ]]; then read -r '?Press Enter to close.'; fi
  exit 1
}

NODE_BIN="${CODEX_METER_NODE:-}"
if [[ -z "$NODE_BIN" ]]; then
  for candidate in "$(command -v node || true)" "$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"; do
    if [[ -x "$candidate" ]] && "$candidate" -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 24 ? 0 : 1)' 2>/dev/null; then
      NODE_BIN="$candidate"
      break
    fi
  done
fi
[[ -n "$NODE_BIN" && -x "$NODE_BIN" ]] || fail 'Node.js 24+ is required. Set CODEX_METER_NODE to its executable path.'
"$NODE_BIN" -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 24 ? 0 : 1)' || fail 'Node.js 24+ is required.'
export CODEX_METER_PYTHON="${CODEX_METER_PYTHON:-$(command -v python3 || true)}"
[[ -n "$CODEX_METER_PYTHON" ]] || fail 'Python 3.10+ is required.'
"$CODEX_METER_PYTHON" -c 'import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)' || fail 'Python 3.10+ is required.'

APP_PATH="${CODEX_METER_APP:-}"
if [[ -z "$APP_PATH" ]]; then
  for candidate in /Applications/ChatGPT.app /Applications/Codex.app "$HOME/Applications/ChatGPT.app" "$HOME/Applications/Codex.app"; do
    if [[ -d "$candidate" ]]; then APP_PATH="$candidate"; break; fi
  done
fi
[[ -d "$APP_PATH/Contents/MacOS" ]] || fail 'Codex app not found. Set CODEX_METER_APP to its app path.'
PORT="${CODEX_METER_SIDEBAR_PORT:-39222}"
"$NODE_BIN" -e 'const p=Number(process.argv[1]);process.exit(Number.isInteger(p)&&p>=1024&&p<=65535?0:1)' "$PORT" || fail 'Invalid debugging port.'

if [[ "${1:-}" == --check ]]; then
  print 'Sidebar launcher dependencies OK. No app launched or debugging enabled.'
  exit 0
fi

# Launch flags only take effect after a full quit. Leave running clients alone.
if /usr/bin/pgrep -x ChatGPT >/dev/null || /usr/bin/pgrep -x Codex >/dev/null; then
  fail 'First quit Codex normally (Command+Q), then run this file again. No app was restarted.'
fi
print 'Starting Codex with local-only debugging. Keep this terminal open for sidebar updates.'
print 'Ctrl+C removes the badges. To turn off debugging, quit Codex and reopen it normally.'
/usr/bin/open -a "$APP_PATH" --args --remote-debugging-address=127.0.0.1 "--remote-debugging-port=$PORT"
exec "$NODE_BIN" "$SIDEBAR_DIR/agent.cjs"
