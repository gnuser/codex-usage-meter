#!/usr/bin/env python3
"""One shared local window, selected only by UserPromptSubmit hooks."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parent


from usage_meter.desktop import runtime_dir, file_lock, is_windows, python_command, background_options


def window_command(folder):
    if is_windows():
        try:
            config = json.loads((folder / 'windows.json').read_text(encoding='utf-8'))
            executable = Path(config['python'])
            if executable.is_file():
                return [python_command(executable), str(ROOT / 'native/windows.py'), str(folder)]
        except (OSError, ValueError, KeyError, TypeError):
            pass
        return None
    binary = folder / 'CodexUsageMeter.app/Contents/MacOS/CodexUsageMeter'
    return [str(binary), str(folder)] if binary.is_file() else None


def atomic_json(path, value):
    temp = path.with_name(path.name + '.' + str(os.getpid()) + '.tmp')
    try:
        with temp.open('w', encoding='utf-8') as stream:
            os.chmod(temp, 0o600)
            json.dump(value, stream, ensure_ascii=False)
        temp.replace(path)
    finally:
        temp.unlink(missing_ok=True)


def select_session(payload, folder, stamp=None):
    # Store no prompt text, transcript path or model context.
    identifier = payload.get('session_id')
    if payload.get('hook_event_name') != 'UserPromptSubmit' or not isinstance(identifier, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,128}', identifier):
        return False
    stamp = time.time_ns() if stamp is None else stamp
    folder.mkdir(parents=True, exist_ok=True, mode=0o700)
    with file_lock(folder / 'selection.lock'):
        target = folder / 'selection.json'
        try:
            previous = json.loads(target.read_text())
        except (OSError, ValueError):
            previous = {}
        if previous.get('submittedAt', 0) > stamp:
            return False
        atomic_json(target, {'thread': identifier, 'submittedAt': stamp})
    return True


def launch(folder):
    if (folder / 'paused').exists():
        return
    if not window_command(folder):
        return  # Build/install once, never during a prompt.
    try:
        with file_lock(folder / 'daemon.lock', blocking=False):
            pass
    except BlockingIOError:
        return
    with (folder / 'window.log').open('a') as log:
        os.chmod(folder / 'window.log', 0o600)
        subprocess.Popen([python_command(), str(ROOT / 'floating.py'), 'daemon'],
                         stdin=subprocess.DEVNULL, stdout=log, stderr=log,
                         close_fds=True, **background_options())


def daemon(folder):
    from meter import Service
    folder.mkdir(parents=True, exist_ok=True, mode=0o700)
    try:
        with file_lock(folder / 'daemon.lock', blocking=False):
            command = window_command(folder)
            if (folder / 'paused').exists() or not command:
                return
            service = Service()
            try:
                atomic_json(folder / 'connection.json', {'url': service.dashboard()})
                subprocess.run(command, check=True, **background_options())
            finally:
                service.close()
                (folder / 'connection.json').unlink(missing_ok=True)
    except BlockingIOError:
        return


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=('hook', 'daemon', 'show'))
    parser.add_argument('--thread')
    args = parser.parse_args()
    folder = runtime_dir()
    if args.command == 'daemon':
        daemon(folder)
    elif args.command == 'show':
        if not args.thread:
            parser.error('show requires --thread')
        folder.mkdir(parents=True, exist_ok=True, mode=0o700)
        (folder / 'paused').unlink(missing_ok=True)
        if select_session({'hook_event_name': 'UserPromptSubmit', 'session_id': args.thread}, folder):
            atomic_json(folder / 'show.json', {'at': time.time_ns()})
            launch(folder)
    else:
        # Silent and fail-open: window errors must never interrupt a user prompt.
        try:
            payload = json.load(sys.stdin)
            if isinstance(payload, dict) and select_session(payload, folder):
                launch(folder)
        except (OSError, ValueError, TypeError):
            pass


if __name__ == '__main__':
    main()
