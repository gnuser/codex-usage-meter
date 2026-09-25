#!/usr/bin/env python3
"""Register a user hook while preserving every other configured hook."""
import argparse
import json
import os
from pathlib import Path
import shlex
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from floating import atomic_json
from usage_meter.desktop import is_windows


def install(path):
    exists = path.exists()
    original = path.read_bytes() if exists else b''
    config = json.loads(original) if exists else {}
    if not isinstance(config, dict) or not isinstance(config.get('hooks', {}), dict):
        raise ValueError('Unexpected hooks config shape; no changes made')
    args = [sys.executable, str(ROOT / 'floating.py'), 'hook']
    command = subprocess.list2cmdline(args) if is_windows() else shlex.join(args)
    changed = False
    for event in ('UserPromptSubmit', 'SessionStart'):
        groups = config.setdefault('hooks', {}).setdefault(event, [])
        if not isinstance(groups, list):
            raise ValueError(f'Unexpected {event} shape; no changes made')
        if any(h.get('command') == command for group in groups for h in group.get('hooks', [])):
            continue
        group = {'hooks': [{'type': 'command', 'command': command, 'timeout': 3}]}
        if event == 'SessionStart':
            group['matcher'] = 'startup|resume'
        groups.append(group)
        changed = True
    if not changed:
        print('Hooks already registered')
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    if exists:
        backup = path.with_name(path.name + '.usage-meter-backup-' + str(time.time_ns()))
        with backup.open('xb') as stream:
            os.chmod(backup, 0o600)
            stream.write(original)
        print('Backup:', backup)
    atomic_json(path, config)
    print('Registered:', path)
    print('Review and trust the UserPromptSubmit and SessionStart hooks in Codex /hooks before it can run.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--path', type=Path, default=Path(os.environ.get('CODEX_HOME') or Path.home()/'.codex')/'hooks.json')
    install(parser.parse_args().path)
