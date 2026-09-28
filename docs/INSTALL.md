# Install

**English** | [简体中文](INSTALL.zh-CN.md) · [Home](../README.md)

You need **Python 3.10+**, Git, and Codex. Sign into Codex CLI to see account allowance.

## Let Codex install it

Send this message to Codex:

> Install Codex Usage Meter by following this skill: https://raw.githubusercontent.com/gnuser/codex-usage-meter/main/skills/install-usage-meter/SKILL.md

It handles the platform setup and first launch. Approve the message hook once in `/hooks` for automatic opening. The manual steps below are an alternative.

## 1. Download

```sh
git clone https://github.com/gnuser/codex-usage-meter.git
cd codex-usage-meter
```

Run the following commands here. Keep this directory after installation.

## 2. Install the window

### macOS

Install Xcode Command Line Tools if needed (`xcode-select --install`), then run:

```sh
python3 native/build.py
python3 native/install_hook.py
```

### Windows

Use native PowerShell, not WSL. Install [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/) if missing, then run:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r native/requirements-windows.txt
.\.venv\Scripts\python.exe native/build.py
.\.venv\Scripts\python.exe native/install_autostart.py
.\.venv\Scripts\python.exe native/install_hook.py
```

Keep `.venv`; the window uses it. The autostart step registers the window for the current Windows user at sign-in, without administrator privileges. It does not require Codex CLI hooks, so it also works for desktop-only users. The hook remains available for opening the window after a CLI message.

To disable sign-in startup later, run `.\.venv\Scripts\python.exe native/install_autostart.py --remove`.

## 3. Start

On Windows, the window opens at the next sign-in. For immediate opening, use [Open manually](REFERENCE.md#open-manually).

In Codex CLI, open **`/hooks`** and trust the **SessionStart** and **UserPromptSubmit** entries pointing to **`floating.py hook`**. Starting or resuming a conversation launches the window; sending a message is also a fallback. Opening Codex without starting/resuming a conversation is not a session event. For an existing installation, rerun the hook installer above to add the startup hook.


That's it. You do not need the optional Codex plugin for the floating window.

[How to use it](USAGE.md) · [Open manually](REFERENCE.md#open-manually) · [Optional plugin / Tibo setup](REFERENCE.md#optional-codex-plugin)

The standard installation excludes Tibo and the Chrome extension. For the experimental optional package, use `python3 install.py --with-tibo` (add `--enable` if needed). When running from source, set `CODEX_USAGE_TIBO=1` before starting the service to opt in.
