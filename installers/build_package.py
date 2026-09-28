#!/usr/bin/env python3
"""Build a small cross-platform, source-only installation ZIP."""
import argparse
from pathlib import Path
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'installers'))
from install_sidebar import payload_files


def build(output):
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
        for path in payload_files(ROOT):
            archive.write(ROOT / path, 'CodexUsageMeter/' + path.as_posix())
        for name in ('Install.command', 'Install.cmd', 'README.txt'):
            archive.write(ROOT / 'installers' / name, 'CodexUsageMeter/' + name)
    return output


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=ROOT / 'dist/CodexUsageMeter.zip')
    print(build(parser.parse_args().output))
