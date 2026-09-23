# Installation

**English** | [简体中文](INSTALL.zh-CN.md)

[Home](../README.md) · [Usage guide](USAGE.md) · [Video overview](media/getting-started.mp4)

Try the browser dashboard first, or install the floating window for ongoing use. **Neither requires installing the Codex plugin.** The plugin and Tibo monitor are optional.

## Requirements

| Setup | Requirements |
| --- | --- |
| Browser dashboard | Python 3.10+ and local Codex conversation logs |
| macOS floating window | The above, plus Xcode Command Line Tools |
| Windows floating window | Native Windows 10/11 Python, WebView2 Runtime, and the dependencies below |
| Account allowance | A working, signed-in Codex CLI |
| Conversation links | Codex desktop app |
| Optional Tibo monitor | Chrome signed into X, plus this repository's extension |

Download with Git, or choose **Code → Download ZIP** on [GitHub](https://github.com/gnuser/codex-usage-meter) and extract it:

```sh
git clone https://github.com/gnuser/codex-usage-meter.git
cd codex-usage-meter
```

**Run the following commands from this directory. Keep it in place after installation.**

## Browser dashboard

macOS:

```sh
python3 meter.py serve
```

Windows PowerShell:

```powershell
py -3 meter.py serve
```

Open the complete URL printed in the terminal. Leave the terminal running; press `Ctrl+C` to stop. Initially, only the latest conversation is loaded; load more from the page.

You should see the dashboard and existing local conversations. If there are no logs yet, complete a conversation turn in Codex first.

The URL's `#key=…` is a temporary access key. **Do not share it or include it in screenshots.** Use the new URL after restarting the service.

## Floating window

### macOS

Check your environment:

```sh
python3 --version
codex --version
xcode-select -p
```

If build tools are missing, run `xcode-select --install` and finish the system installation first.

Build the window and register automatic opening:

```sh
python3 native/build.py
python3 native/install_hook.py
```

In Codex CLI, open `/hooks`, review and trust the new entry pointing to this project's `floating.py hook`. Then start a new conversation and send a message.

The window should open with recently active conversations. The app is installed at `~/Library/Application Support/CodexUsageMeter/CodexUsageMeter.app`; its background scripts still depend on the source directory.

### Windows 10 / 11

Use **native PowerShell**, not WSL. Install [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/) if it is missing.

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r native/requirements-windows.txt
.\.venv\Scripts\python.exe native/build.py
.\.venv\Scripts\python.exe native/install_hook.py
```

You do not need to activate the virtual environment. Keep `.venv` in place.

Trust the new hook in Codex CLI's `/hooks`, then send a message in a new conversation. The window should appear; its close button hides it in the system tray.

### Open manually

To skip automatic opening, first list recent conversations and copy the ID at the start of the desired row:

```sh
python3 -c "from usage_meter.ledger import Ledger; print('\n'.join(s['id']+'  '+s['title'] for s in Ledger().catalog(10)['sessions']))"
python3 floating.py show --thread YOUR_CODEX_THREAD_ID
```

On Windows, replace `python3` with `.\.venv\Scripts\python.exe`. Replace `YOUR_CODEX_THREAD_ID` with an actual ID.

This also restores a missing window or resumes paused automatic opening. The window still shows all conversations active in the last 30 minutes, not just the supplied ID.

## Optional Codex plugin

Install the plugin if you want to ask Codex directly about conversation usage.

macOS:

```sh
python3 install.py --enable
```

Windows:

```powershell
.\.venv\Scripts\python.exe install.py --enable
```

The installer copies the plugin to `~/plugins/codex-usage-meter`, registers it in your personal marketplace, and attempts to enable it. Create a new Codex task and ask: “Show token usage for this conversation.”

The plugin includes a hook. If using that hook, skip `native/install_hook.py` above to avoid duplicate registration. You still need the desktop window installed and the hook trusted. If you already registered a user-level hook, remove only this project's duplicate entry.

The installer does not overwrite an existing plugin directory. Follow [Update and uninstall](../README.md#update-and-uninstall) if it already exists.

## Optional Tibo monitor

1. Sign into X in Chrome and confirm [Tibo's profile](https://x.com/thsottiaux) opens.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Select **Load unpacked** and choose this repository's `browser-extension` directory.
4. With the floating window running, get its **background service** URL:

   ```sh
   python3 -c "import json; from floating import runtime_dir; print(json.loads((runtime_dir()/'connection.json').read_text())['url'])"
   ```

   On Windows, replace `python3` with `.\.venv\Scripts\python.exe`. If the file does not exist, open the floating window first.

5. Click the Chrome extension icon, paste the complete URL, and choose **Connect and start**.
6. Wait for **Updated**, then expand the Tibo row in the window. New data may take about 30 seconds to appear in the panel.

Use the floating window's URL above. Running `meter.py serve` separately starts a different service; pairing with it will not update the existing floating window.

The extension refreshes every 30 minutes; **Refresh now** runs it manually. Keep Chrome and the dedicated X tab open. Pair again after restarting the usage service. Do not share the connection URL. Only the latest three original posts are considered; replies, self-replies, and reposts are excluded.

## Verify installation

- Send a message in a new conversation: the window appears. Conversations without updates in the last 30 minutes are excluded.
- Click a conversation's triangle to expand model input/output usage; the height adjusts.
- Hide the window and restore it from the menu bar or tray.
- If allowance is `—`, check Codex CLI sign-in. Local token accounting works independently.

Next: [Usage guide](USAGE.md). See the [README](../README.md) for configuration, updates, and uninstallation.
