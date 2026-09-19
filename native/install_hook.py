#!/usr/bin/env python3
"""Register a user hook while preserving every other configured hook."""
import argparse
import json
import os
from pathlib import Path
import shlex
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from floating import atomic_json


def install(path):
    exists = path.exists()
    original = path.read_bytes() if exists else b''
    config = json.loads(original) if exists else {}
    if not isinstance(config, dict) or not isinstance(config.get('hooks', {}), dict):
        raise ValueError('Unexpected hooks config shape; no changes made')
    command = shlex.join([sys.executable, str(ROOT / 'floating.py'), 'hook'])
    groups = config.setdefault('hooks', {}).setdefault('UserPromptSubmit', [])
    if not isinstance(groups, list):
        raise ValueError('Unexpected UserPromptSubmit shape; no changes made')
    for group in groups:
        if any(h.get('command') == command for h in group.get('hooks', [])):
            print('Hook already registered')
            return
    groups.append({'hooks': [{'type': 'command', 'command': command, 'timeout': 3}]})
    path.parent.mkdir(parents=True, exist_ok=True)
    if exists:
        backup = path.with_name(path.name + '.usage-meter-backup-' + str(time.time_ns()))
        with backup.open('xb') as stream:
            os.chmod(backup, 0o600)
            stream.write(original)
        print('Backup:', backup)
    atomic_json(path, config)
    print('Registered:', path)
    print('Review and trust the new UserPromptSubmit hook in Codex /hooks before it can run.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--path', type=Path, default=Path(os.environ.get('CODEX_HOME') or Path.home()/'.codex')/'hooks.json')
    install(parser.parse_args().path)
