---
name: install-usage-meter
description: Install or repair the compact Codex Usage Meter sidebar panel and its per-user launcher on macOS or Windows. Use for setup requests, not usage queries.
---

# Install Codex Usage Meter

Default to the unified sidebar panel. Do not build or install the legacy floating window, message hooks, Windows login startup, Chrome extension, or optional MCP plugin unless explicitly requested.

Reuse an existing checkout of `https://github.com/gnuser/codex-usage-meter.git`; otherwise clone it. Preserve local changes. The installer is `installers/install_sidebar.py` at the repository root. Downloaded ZIPs also contain it, with `Install.command` / `Install.cmd` wrappers.

Check Python 3.10+, Node.js 24+, and the Codex desktop app. macOS can reuse Node bundled with Codex. Missing prerequisites need to be installed from their official sources; this package does not include runtimes. Linux/WSL are not supported by this installer. Account limits require existing Codex sign-in; do not read or alter credentials.

Explain that sidebar mode enables a local debugging endpoint, depends on the client's UI, and should never be exposed or forwarded. Installation does not quit the client or enable login startup. Do not bypass computer-use restrictions by running the injector through a different tool.

Run `python3 installers/install_sidebar.py` on macOS, or `py -3 installers/install_sidebar.py` in native Windows. It copies an allowlisted payload into user application data and creates a launcher at `~/Applications/Codex Usage Meter.app` or `~/Desktop/Codex Usage Meter.cmd`. If detection fails, use `CODEX_METER_APP` for the app/executable path and `CODEX_METER_NODE` for Node. The installer persists these resolved paths for the launcher. Windows Store installs may require an accessible executable path supplied by the user.

Old floating hooks are paused without changing their trust settings or deleting unrelated hooks. Ask the user to quit the old floating window and any terminal running the old sidebar agent. Codex must be quit normally once if it was not started with debugging. Then the user opens **Codex Usage Meter** instead of the ordinary Codex icon. No terminal needs to remain open. Do not force-quit a running client.

Verify the installed files and prerequisite check. Only report the sidebar visible after observing it using an allowed UI tool; otherwise state that launch verification is pending. Never print panel keys, websocket URLs, or conversation contents during installation. Errors are recorded in `sidebar-error.txt`, service logs in `sidebar.log`, under the user's `CodexUsageMeter` application-data directory.

Updating uses the same installer and preserves logs. It signals a previously packaged launcher to stop; the user reopens the new launcher. An old manually started agent must be stopped separately. Details: [installation](../../docs/INSTALL.md). If the skill was read remotely, use `https://raw.githubusercontent.com/gnuser/codex-usage-meter/main/docs/INSTALL.md`.
