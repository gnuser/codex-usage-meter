#!/usr/bin/env python3
"""Install a per-user sidebar launcher, without admin rights or native compilation."""
import hashlib
import json
import os
from pathlib import Path
import plistlib
import shlex
import shutil
import sys

if sys.version_info < (3, 10):
    raise SystemExit('Python 3.10+ is required.')

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from usage_meter.desktop import is_windows, runtime_dir
from usage_meter.sidebar_start import find_node, find_app

# Explicit allowlist: never package recordings, caches, credentials, Git or local config.
FILES = ['meter.py', 'usage_meter/__init__.py', 'usage_meter/account.py', 'usage_meter/ledger.py',
         'usage_meter/loopback.py', 'usage_meter/public_resets.py', 'usage_meter/desktop.py',
         'usage_meter/sidebar_start.py', 'installers/install_sidebar.py']
DIRECTORIES = ['web', 'integrations/sidebar']


def payload_files(source):
    paths = [Path(name) for name in FILES]
    for name in DIRECTORIES:
        paths.extend(p.relative_to(source) for p in (source / name).rglob('*')
                     if p.is_file() and not p.is_symlink() and p.suffix in ('.js', '.cjs', '.css', '.html', '.md', '.command'))
    paths.append(Path('integrations/sidebar/vendor/LICENSE'))
    return sorted(set(paths))


def install(source=ROOT, folder=None, applications=None, settings=None):
    folder = Path(folder or runtime_dir())
    paths = payload_files(source)
    digest = hashlib.sha256()
    for path in paths:
        digest.update(str(path).encode())
        digest.update((source / path).read_bytes())
    target = folder / 'sidebar' / digest.hexdigest()[:16]
    target.mkdir(parents=True, exist_ok=True)
    for path in paths:
        destination = target / path
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source / path, destination)
    (target / 'sidebar-config.json').write_text(json.dumps(settings or {}), encoding='utf-8')
    if is_windows():
        # A desktop .cmd launches a windowless Python supervisor and exits immediately.
        destination = Path(applications or Path.home() / 'Desktop') / 'Codex Usage Meter.cmd'
        if destination.exists() and 'Codex Usage Meter launcher' not in destination.read_text(encoding='utf-8'):
            raise FileExistsError('Refusing to overwrite an unrelated shortcut')
        pythonw = Path(sys.executable).with_name('pythonw.exe')
        if not pythonw.exists():
            raise RuntimeError('pythonw.exe is required. Install Python from python.org.')
        # Percent expansion in batch files must be escaped; paths cannot contain quotes.
        safe = lambda p: str(p).replace('%', '%%')
        content = '@echo off\nchcp 65001 >nul\nrem Codex Usage Meter launcher\nset "CODEX_USAGE_DATA=' + safe(folder) + '"\ncd /d "' + safe(target) + '"\nstart "" "' + safe(pythonw) + '" -m usage_meter.sidebar_start\n'
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(content, encoding='utf-8')
    else:
        destination = Path(applications or Path.home() / 'Applications') / 'Codex Usage Meter.app'
        plist = destination / 'Contents/Info.plist'
        if destination.exists():
            if not plist.exists() or plistlib.loads(plist.read_bytes()).get('CFBundleIdentifier') != 'local.codex.usage-meter.sidebar':
                raise FileExistsError('Refusing to overwrite an unrelated application')
        executable = destination / 'Contents/MacOS/launcher'
        executable.parent.mkdir(parents=True, exist_ok=True)
        executable.write_text('#!/bin/sh\nexport CODEX_USAGE_DATA=' + shlex.quote(str(folder)) + '\ncd ' + shlex.quote(str(target)) + '\nexec ' + shlex.quote(sys.executable) + ' -m usage_meter.sidebar_start\n')
        executable.chmod(0o755)
        plist.write_bytes(plistlib.dumps({'CFBundleExecutable': 'launcher', 'CFBundleIdentifier': 'local.codex.usage-meter.sidebar',
                                         'CFBundleName': 'Codex Usage Meter', 'CFBundlePackageType': 'APPL', 'LSUIElement': True,
                                         'CFBundleVersion': '2'}))
    # Existing hooks remain intact but are paused; no trust settings are changed.
    (folder / 'sidebar-stop').touch()
    (folder / 'paused').touch()
    (folder / 'sidebar-mode').touch()
    return destination


if __name__ == '__main__':
    try:
        if sys.platform not in ('darwin', 'win32'):
            raise RuntimeError('This installer supports macOS and native Windows only.')
        settings = {'node': find_node(), 'app': str(find_app())}
        print('Installed:', install(settings=settings))
        print('Quit the old floating window and Codex normally, then open Codex Usage Meter.')
        print('Sidebar uses a local debugging endpoint. No hooks, Chrome extension or terminal are needed.')
    except (OSError, ValueError, RuntimeError) as error:
        raise SystemExit(str(error))
