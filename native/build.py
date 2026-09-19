#!/usr/bin/env python3
"""Build the small macOS window without third-party dependencies."""
import argparse
from pathlib import Path
import plistlib
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from floating import runtime_dir


def build(folder):
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
