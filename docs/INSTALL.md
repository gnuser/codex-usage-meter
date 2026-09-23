# Install

**English** | [简体中文](INSTALL.zh-CN.md) · [Home](../README.md)

You need **Python 3.10+**, Git, and Codex. Sign into Codex CLI to see account allowance.

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
.\.venv\Scripts\python.exe native/install_hook.py
```

Keep `.venv`; the window uses it.

## 3. Start

In Codex CLI, open **`/hooks`** and trust the new entry pointing to **`floating.py hook`**. Create a new conversation and send a message. The window should appear.

That's it. You do not need the optional Codex plugin for the floating window.

[How to use it](USAGE.md) · [Open manually](REFERENCE.md#open-manually) · [Optional plugin / Tibo setup](REFERENCE.md#optional-codex-plugin)
