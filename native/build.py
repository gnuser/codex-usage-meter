#!/usr/bin/env python3
"""Build the native macOS window or register the Windows Python window."""
import argparse
from pathlib import Path
import plistlib
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from floating import runtime_dir, atomic_json
from usage_meter.desktop import is_windows


def build(folder):
    folder.mkdir(parents=True, exist_ok=True, mode=0o700)
    if is_windows():
        # Dependencies must be installed into the interpreter used by the window.
        import importlib.util
        missing = [name for name in ('webview', 'pystray', 'PIL') if importlib.util.find_spec(name) is None]
        if missing:
            raise SystemExit('Install Windows dependencies first: python -m pip install -r native/requirements-windows.txt')
        atomic_json(folder / 'windows.json', {'python': sys.executable})
        print(folder / 'windows.json')
        return
    app = folder / 'CodexUsageMeter.app'
    contents = app / 'Contents'
    binary = contents / 'MacOS/CodexUsageMeter'
    binary.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['swiftc', '-module-cache-path', str(folder / 'module-cache'),
                    str(ROOT / 'native/UsageWindow.swift'), '-o', str(binary),
                    '-framework', 'AppKit', '-framework', 'WebKit'], check=True)
    with (contents / 'Info.plist').open('wb') as stream:
        plistlib.dump({'CFBundleExecutable': 'CodexUsageMeter', 'CFBundleIdentifier': 'local.codex.usage-meter',
                      'CFBundleName': 'Codex 用量', 'CFBundlePackageType': 'APPL',
                      'CFBundleVersion': '1', 'LSUIElement': True,
                      'NSAppTransportSecurity': {'NSAllowsLocalNetworking': True}}, stream)
    print(app)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=runtime_dir())
    build(parser.parse_args().output)
