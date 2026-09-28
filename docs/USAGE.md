# Use

**English** | [简体中文](USAGE.zh-CN.md)

Open **Codex Usage Meter** to launch Codex with the sidebar enabled.

- **Hover the ring:** show the panel. Move the mouse into it to interact.
- **Click the ring / pin:** keep the same panel open. Click outside, close, or press Esc to dismiss.
- **Account summary:** weekly allowance, reset countdown, available reset credits and first expiry. Exact times are available on hover.
- **Chats:** only conversations active in the last 30 minutes; scroll for more. Click a title to open it, or the arrow for per-model usage. Bars show recent turns; In/Out/Cache show the latest turn. Missing values stay unknown.
- **Reset news:** expand for public announcement sources and forecasts. Forecasts are unconfirmed, and cannot determine your personal reset time or reset-credit expiry.

The public feed uses `https://codex-resets.com/mcp` every five minutes. No login or API key is needed; no conversation or account data is uploaded. The panel polls its local cache independently from account limits.

## Troubleshooting

If the ring is missing, quit Codex normally and reopen through **Codex Usage Meter**. Stop any old terminal-based sidebar service first. Client updates can change the UI and require a plugin update.

If installation or launch fails, read `sidebar-error.txt` / `sidebar.log` in `~/Library/Application Support/CodexUsageMeter` (Mac) or `%LOCALAPPDATA%\CodexUsageMeter` (Windows). Do not share `connection.json` or panel URLs containing keys.

To stop the packaged service, run `python -m usage_meter.sidebar_start --stop` from its installed payload or the source checkout, using the same application-data directory. Quit Codex and reopen its ordinary icon to disable debugging.

The old floating window is paused by installation. It remains an explicit fallback: run `floating.py show --thread ACTUAL_THREAD_ID` from a full source checkout to re-enable it. This is not required for sidebar usage.

[Install](INSTALL.md) · [Technical details](../integrations/sidebar/README.md)
