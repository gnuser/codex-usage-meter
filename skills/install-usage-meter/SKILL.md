---
name: install-usage-meter
description: Install or repair the Codex Usage Meter floating window on macOS or Windows, including desktop dependencies, the message hook, and first launch. Use when the user asks to install or set up Codex Usage Meter, not when they only want to query usage.
---

# Install Codex Usage Meter

Complete installation for the user's OS using the project's existing installers. Default to the floating window with a user-level message hook. The optional MCP plugin and Chrome/X integration are not required; install those only when requested. Respond in the user's language.

This skill can be read directly from its public URL before the package is installed. Its repository is `https://github.com/gnuser/codex-usage-meter.git`.

## Locate the source and prerequisites

- Reuse the user's existing checkout when available. A checkout containing this skill has `native/build.py` and `floating.py` two directories above the skill folder. A standalone copy of this skill does not.
- Otherwise clone the repository into a persistent directory such as `~/codex-usage-meter` on macOS or `$HOME\codex-usage-meter` in PowerShell. Quote paths. If the destination exists, verify its identity before reuse; do not overwrite an unrelated directory. Keep local changes and do not reset or update an existing checkout unless needed for the requested repair/update.
- Use Python 3.10+ (`python3` on macOS, `py -3` on Windows). Check Git if cloning, Codex CLI availability, and the desktop platform. Linux/WSL cannot run the native floating window; offer the browser dashboard (`python3 meter.py serve`) and explain that limit.
- macOS needs Xcode Command Line Tools (`xcode-select -p`). If absent, run `xcode-select --install` and tell the user which system installer remains to be completed. Windows needs WebView2 Runtime; use the official Microsoft installer if missing, respecting any OS elevation prompt. Do not report completion while a prerequisite is pending.
- Account allowance requires a signed-in Codex CLI. Missing sign-in does not block local token tracking; report it separately rather than reading authentication files or changing accounts.

## Install from the repository root

Keep the checkout and Windows virtual environment in place: the window and hook use absolute paths into them. Inspect the existing `native/build.py` and `native/install_hook.py` before executing. Use their logic instead of hand-writing native registration or hook configuration.

macOS:

```sh
python3 native/build.py
python3 native/install_hook.py
```

Windows, in native PowerShell:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r native/requirements-windows.txt
.\.venv\Scripts\python.exe native/build.py
.\.venv\Scripts\python.exe native/install_hook.py
```

Reuse a working `.venv` rather than recreating it. The same interpreter must install dependencies, register the Windows window, and register its hook. On macOS, use the same resolved Python for building and the hook too.

Before registering a user-level hook, check whether this installation already uses an enabled plugin hook. Keep one working hook path; do not add another for the same installation. Re-running the hook installer with the same interpreter and path is safe: it preserves existing hooks, backs up changes, and avoids an exact duplicate. If paths changed, inspect and repair only this project's stale entry, preserving other hooks.

Registering a hook does not trust it. Never edit trust state or claim it is automatically approved. Complete the other installation steps, then tell the user once to open Codex CLI's `/hooks`, review and trust the `floating.py hook` entry, and send a message in a new conversation.

## Open and verify

1. Verify the build output: the macOS app bundle or Windows `windows.json` interpreter registration reported by the installer.
2. If the actual Codex thread ID is available from task context, run `python3 floating.py show --thread ACTUAL_THREAD_ID` (Windows: `.\.venv\Scripts\python.exe` in place of `python3`). Replace the placeholder; do not invent an ID or substitute a ChatGPT conversation ID.
3. If the thread ID is unavailable, read only recent catalog metadata:

   ```sh
   python3 -c "from usage_meter.ledger import Ledger; print('\n'.join(s['id']+'  '+s['title'] for s in Ledger().catalog(1)['sessions']))"
   ```

   On Windows use the virtual environment's Python. A returned ID may be used only to initialize the shared recent-conversation window; do not call it the current or foreground conversation. If no local conversation exists, ask the user to send a Codex message after trusting the hook; do not fabricate log data.
4. Check the resulting window or local service health where tools permit. `show` can exit without opening for an invalid ID, so exit code alone is not proof. If only build/registration was verified, state that first-launch verification remains pending. Do not print or share the access key in `connection.json`.

Keep the final handoff short: installed location, whether the window was verified, and only any remaining system-install/sign-in/hook-trust step. Explain how to restore it from the menu bar or tray. Do not claim automatic opening was verified before a trusted hook has actually run.

For repair details or explicitly requested optional integrations, read `docs/REFERENCE.md` in the checkout. If only this skill is available, retrieve the reference from `https://raw.githubusercontent.com/gnuser/codex-usage-meter/main/docs/REFERENCE.md`. Never replace the personal marketplace or unrelated settings to make installation succeed.
