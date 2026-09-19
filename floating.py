#!/usr/bin/env python3
"""One shared local window, selected only by UserPromptSubmit hooks."""
import argparse
import fcntl
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parent


def runtime_dir():
    return Path(os.environ.get('CODEX_USAGE_DATA') or Path.home() / 'Library/Application Support/CodexUsageMeter')


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
    with (folder / 'selection.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
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
    binary = folder / 'CodexUsageMeter.app/Contents/MacOS/CodexUsageMeter'
    if not binary.is_file():
        return  # Installation builds the app once; never compile during a prompt.
    with (folder / 'daemon.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return
    with (folder / 'window.log').open('a') as log:
        os.chmod(folder / 'window.log', 0o600)
        subprocess.Popen([sys.executable, str(ROOT / 'floating.py'), 'daemon'],
                         stdin=subprocess.DEVNULL, stdout=log, stderr=log,
                         start_new_session=True, close_fds=True)


def daemon(folder):
    from meter import Service
    folder.mkdir(parents=True, exist_ok=True, mode=0o700)
    with (folder / 'daemon.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return
        if (folder / 'paused').exists():
            return
        service = Service()
        try:
            atomic_json(folder / 'connection.json', {'url': service.dashboard()})
            subprocess.run([str(folder / 'CodexUsageMeter.app/Contents/MacOS/CodexUsageMeter'), str(folder)], check=True)
        finally:
            service.close()
            (folder / 'connection.json').unlink(missing_ok=True)


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
