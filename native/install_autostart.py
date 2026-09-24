#!/usr/bin/env python3
"""Start the Windows floating window at sign-in for the current user."""
import argparse
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from usage_meter.desktop import is_windows

RUN_KEY = r'Software\Microsoft\Windows\CurrentVersion\Run'
VALUE_NAME = 'Codex Usage Meter'


def startup_command(python=sys.executable, root=ROOT):
    windowless = Path(python).with_name('pythonw.exe')
    if not windowless.is_file():
        raise FileNotFoundError(f'Windowless Python not found: {windowless}')
    return subprocess.list2cmdline([str(windowless), str(root / 'floating.py'), 'daemon'])


def install(command=None):
    if not is_windows():
        raise SystemExit('Windows sign-in startup is only available on Windows.')
    import winreg

    command = command or startup_command()
    with winreg.CreateKeyEx(winreg.HKEY_CURRENT_USER, RUN_KEY, 0,
                            winreg.KEY_QUERY_VALUE | winreg.KEY_SET_VALUE) as key:
        try:
            previous, _ = winreg.QueryValueEx(key, VALUE_NAME)
        except FileNotFoundError:
            previous = None
        if previous == command:
            print('Sign-in startup already registered')
            return
        if previous is not None and 'floating.py' not in previous:
            raise RuntimeError('A different startup command uses this name; no changes made')
        winreg.SetValueEx(key, VALUE_NAME, 0, winreg.REG_SZ, command)
    print('Registered Windows sign-in startup for the current user')


def remove():
    if not is_windows():
        raise SystemExit('Windows sign-in startup is only available on Windows.')
    import winreg

    with winreg.CreateKeyEx(winreg.HKEY_CURRENT_USER, RUN_KEY, 0,
                            winreg.KEY_QUERY_VALUE | winreg.KEY_SET_VALUE) as key:
        try:
            previous, _ = winreg.QueryValueEx(key, VALUE_NAME)
        except FileNotFoundError:
            print('Sign-in startup is not registered')
            return
        if 'floating.py' not in previous:
            raise RuntimeError('A different startup command uses this name; no changes made')
        winreg.DeleteValue(key, VALUE_NAME)
    print('Removed Windows sign-in startup for the current user')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--remove', action='store_true', help='remove only this startup entry')
    args = parser.parse_args()
    remove() if args.remove else install()
