# Install

**English** | [简体中文](INSTALL.zh-CN.md)

The default is now a compact sidebar panel. No floating window, hook trust, native build, or open terminal is needed.

[Download the latest installation package](https://github.com/gnuser/codex-usage-meter/releases/latest)

1. Install **Python 3.10+** and **Node.js 24+** if missing. macOS can reuse the Codex bundled Node runtime when present.
2. Extract `CodexUsageMeter.zip`, then double-click **Install.command** (Mac) or **Install.cmd** (Windows).
3. Quit Codex, the old floating window, and any old sidebar terminal normally. Open **Codex Usage Meter** from `~/Applications` (Mac) or your Desktop (Windows).

The installer copies the files into your user application-data directory. You can discard the extracted ZIP afterward; keep Python and Node installed. Updating: repeat the same steps with a new package. Existing session logs are untouched.

This is a source installation package, not a standalone signed/notarized binary. Download protection may require approving the installer in macOS Privacy & Security. The launcher enables a **local-only debugging endpoint** and never force-quits Codex. Do not expose or forward that endpoint. Open Codex using the new launcher for sidebar mode; quitting and opening the ordinary Codex icon disables debugging. Client updates may break this experimental integration.

If Codex cannot be found, set `CODEX_METER_APP` to its `.app` or executable path. Windows Store installations may need an accessible executable specified explicitly. Failures show an error message/file; diagnostic logs are `sidebar.log` in the `CodexUsageMeter` application-data directory.

## From source / one-message installation

Ask Codex to follow [the installation skill](../skills/install-usage-meter/SKILL.md), or run from the repository:

```sh
python3 installers/install_sidebar.py
```

Windows: `py -3 installers/install_sidebar.py`. To build the ZIP: `python3 installers/build_package.py`. CI runs provide the ZIP in the Actions artifacts.

[Usage](USAGE.md) · [Legacy floating window](REFERENCE.md)
