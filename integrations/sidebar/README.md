# Optional sidebar mode (experimental)

**English** | [简体中文](README.zh-CN.md)

Reuses Codex Usage Badge's quota rings, project colors and per-conversation blue indicators, with Codex Usage Meter's existing local accounting and account API. Hover a conversation indicator for cumulative tokens and current-turn input, output and cache share. Numbers use whole K/M/B units. Unknown records stay unknown; remote conversations are not attributed to local logs.

The bridge is separate from the default floating window. It requires Node.js 24+, Python 3.10+, and a Codex instance **already started with an explicitly enabled loopback debugging endpoint**. It does not change the app bundle, install a login watcher, quit/relaunch Codex, or enable debugging itself. Client UI updates may break placement. The official app's internal selectors are not a supported extension API.

Any local process able to access the debugging port may control the client. Do not expose or forward it to the network. Enable it only after reviewing that tradeoff. The bridge accepts loopback targets only, and sends no panel access keys into the renderer.

From the repository root, after enabling the debugging endpoint yourself:

```sh
node integrations/sidebar/agent.cjs
```

Defaults: debugging port `39222`, Python `python3` on macOS and `python` on Windows. Override with `CODEX_METER_SIDEBAR_PORT` and `CODEX_METER_PYTHON` (a single executable path). The agent starts a private local meter service only while it finds a compatible client window. It does not need the floating window or trusted hooks. Ctrl+C stops its service and removes injected UI when the client is reachable. A client reload also removes it.

Automated tests and a simulated narrow-rail preview are verified; compatibility with each real client release is not guaranteed. A missing compatible client or debugging endpoint leaves the agent waiting. No automatic client restart is attempted.

## macOS launcher

After opting in to local debugging, quit Codex normally with **Command+Q**, then double-click `start-macos.command` in this folder (or run it from Terminal). It selects Node.js 24+ from your PATH or the available Codex runtime, opens Codex with the loopback debugging flags, and runs the bridge in that terminal. Keep the terminal open. It refuses to restart an already-running client and installs no persistent startup item.

Run `./integrations/sidebar/start-macos.command --check` to check prerequisites without opening anything. Override the executable with `CODEX_METER_NODE` or the app location with `CODEX_METER_APP` if necessary. Ctrl+C removes the badges; to disable the debugging endpoint itself, quit Codex and open it normally.

## Source attribution

Adapted from [jaykinhoo9/codex-usage-badge](https://github.com/jaykinhoo9/codex-usage-badge), commit `1597242967aa027888f28f6ad9b6fe4def0f21b6`, under [MIT](vendor/LICENSE). The four vendored files retain their component structure and license. Local modifications add English labels, whole-number units, input/output/cache details, a fixed 38px vertical layout, reset countdowns, and connection lifecycle hardening. Reset-credit expiry stays in the tooltip to avoid increasing height. The upstream account reader, token database reader, and installation/relaunch helpers are not included. Statistics come from this project's existing Python service.

Quota rings include a live reset countdown in days (e.g. `2.5d`); conversation badges show whole-number cumulative tokens without hovering.

Do not run this bridge alongside the original Usage Badge injector: they share component identifiers. Thread reads are bounded and cached briefly; large lists populate over multiple refresh cycles.
