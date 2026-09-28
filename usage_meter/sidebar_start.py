"""User-invoked sidebar launcher. Never quit Codex or install login hooks."""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time
from urllib.request import build_opener, ProxyHandler
from .public_resets import NoRedirect
from .desktop import background_options, file_lock, is_windows, runtime_dir

ROOT = Path(__file__).resolve().parents[1]


def launch_settings():
    try:
        value = json.loads((ROOT / 'sidebar-config.json').read_text(encoding='utf-8'))
        return value if isinstance(value, dict) else {}
    except (OSError, ValueError):
        return {}


def find_node():
    candidates = [os.environ.get('CODEX_METER_NODE'), launch_settings().get('node'), shutil.which('node'),
                  str(Path.home() / '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')]
    for candidate in candidates:
        if not candidate or not Path(candidate).is_file():
            continue
        try:
            check = subprocess.run([candidate, '-p', 'process.versions.node.split(".")[0]'],
                                   capture_output=True, text=True, timeout=5, **background_options())
            if check.returncode == 0 and int(check.stdout.strip()) >= 24:
                return str(Path(candidate).resolve())
        except (OSError, ValueError, subprocess.TimeoutExpired):
            pass
    raise RuntimeError('Node.js 24+ is required. Install it from nodejs.org, then reopen Codex Usage Meter.')


def find_app():
    override = os.environ.get('CODEX_METER_APP') or launch_settings().get('app')
    if override:
        candidates = [Path(override)]
    elif is_windows():
        local = Path(os.environ.get('LOCALAPPDATA', str(Path.home() / 'AppData/Local')))
        candidates = [local / 'Programs/Codex/Codex.exe', local / 'Programs/ChatGPT/ChatGPT.exe']
        for name in ('Codex.exe', 'ChatGPT.exe'):
            if shutil.which(name):
                candidates.append(Path(shutil.which(name)))
    else:
        candidates = [folder / name for folder in (Path('/Applications'), Path.home() / 'Applications')
                      for name in ('Codex.app', 'ChatGPT.app')]
    for candidate in candidates:
        valid = candidate.is_file() if is_windows() else (candidate / 'Contents/MacOS').is_dir()
        if valid:
            return candidate
    raise RuntimeError('Codex was not found. Set CODEX_METER_APP to its app/executable path and retry.')


def debugging_ready(port):
    try:
        # Ignore HTTP proxies for local discovery. Never print the response or websocket URL.
        with build_opener(ProxyHandler({}), NoRedirect()).open(f'http://127.0.0.1:{port}/json/version', timeout=1) as response:
            data = json.loads(response.read(65536))
        return isinstance(data, dict) and isinstance(data.get('webSocketDebuggerUrl'), str)
    except (OSError, ValueError):
        return False


def app_running(app):
    if is_windows():
        result = subprocess.run(['tasklist', '/FI', f'IMAGENAME eq {app.name}', '/FO', 'CSV', '/NH'],
                                capture_output=True, text=True, timeout=5, **background_options())
        return app.name.lower() in result.stdout.lower()
    return any(subprocess.run(['/usr/bin/pgrep', '-x', name], capture_output=True).returncode == 0
               for name in ('Codex', 'ChatGPT'))


def start(node, app, port, folder):
    if not debugging_ready(port):
        if app_running(app):
            raise RuntimeError('Quit Codex normally first, then open Codex Usage Meter again. Your chats are not closed automatically.')
        flags = ['--remote-debugging-address=127.0.0.1', f'--remote-debugging-port={port}']
        if is_windows():
            subprocess.Popen([str(app), *flags], **background_options())
        else:
            subprocess.run(['/usr/bin/open', '-a', str(app), '--args', *flags], check=True)
        deadline = time.monotonic() + 30
        while not debugging_ready(port):
            if time.monotonic() >= deadline:
                raise RuntimeError('Codex did not expose its local debugging endpoint. This app version may not support sidebar mode.')
            time.sleep(.5)
    stop_file = folder / 'sidebar-stop'
    initial_stop = stop_file.stat().st_mtime_ns if stop_file.exists() else 0
    env = dict(os.environ, CODEX_METER_PYTHON=sys.executable, CODEX_METER_SIDEBAR_PORT=str(port),
               CODEX_METER_STOP_FILE=str(stop_file))
    with (folder / 'sidebar.log').open('a', encoding='utf-8') as log:
        process = subprocess.Popen([node, str(ROOT / 'integrations/sidebar/agent.cjs')], env=env,
                                   stdin=subprocess.DEVNULL, stdout=log, stderr=log, **background_options())
        try:
            while process.poll() is None:
                stamp = stop_file.stat().st_mtime_ns if stop_file.exists() else 0
                if stamp != initial_stop:
                    # The agent observes the same marker and closes its data service first.
                    process.wait(timeout=10)
                    break
                time.sleep(.5)
            code = process.poll()
            if code:
                raise RuntimeError('Sidebar stopped unexpectedly. See sidebar.log in ' + str(folder))
        finally:
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()


def report_error(error, folder):
    path = folder / 'sidebar-error.txt'
    path.write_text('Codex Usage Meter\n\n' + str(error) + '\n', encoding='utf-8')
    if is_windows():
        import ctypes
        ctypes.windll.user32.MessageBoxW(None, str(error), 'Codex Usage Meter', 0x10)
    else:
        subprocess.run(['/usr/bin/open', str(path)], check=False)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--stop', action='store_true')
    args = parser.parse_args()
    folder = runtime_dir()
    folder.mkdir(parents=True, exist_ok=True)
    if args.stop:
        (folder / 'sidebar-stop').touch()
        return
    try:
        if sys.platform not in ('darwin', 'win32'):
            raise RuntimeError('Sidebar launcher supports macOS and native Windows only.')
        if sys.version_info < (3, 10):
            raise RuntimeError('Python 3.10+ is required.')
        node, app = find_node(), find_app()
        port = int(os.environ.get('CODEX_METER_SIDEBAR_PORT', '39222'))
        if not 1024 <= port <= 65535:
            raise ValueError('Invalid sidebar port')
        if args.check:
            print('Sidebar prerequisites OK. No app launched.')
            return
        try:
            with file_lock(folder / 'sidebar.lock', blocking=False):
                start(node, app, port, folder)
        except BlockingIOError:
            return  # One shared service for all client windows.
    except (OSError, RuntimeError, ValueError, subprocess.SubprocessError) as error:
        if args.check:
            raise SystemExit(str(error))
        report_error(error, folder)


if __name__ == '__main__':
    main()
