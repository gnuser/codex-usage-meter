#!/usr/bin/env python3
"""Register this package in the default personal marketplace, without overwriting plugins."""
import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / 'tools'))
from create_basic_plugin import load_validated_marketplace, update_marketplace_json


def install(source, home, *, with_tibo=False):
    target = home / 'plugins' / 'codex-usage-meter'
    marketplace = home / '.agents' / 'plugins' / 'marketplace.json'
    if target.exists():
        raise FileExistsError(f'{target} 已存在；不会覆盖。更新方式见 README。')
    payload = load_validated_marketplace(marketplace, None, 'codex-usage-meter', False)
    # Prepare the complete package before adding it to the marketplace.
    optional = () if with_tibo else ('browser-extension', 'browser_posts.py', 'reset_signal.py', 'tibo.js', '.tibo-enabled')
    shutil.copytree(source, target, ignore=shutil.ignore_patterns(*optional, '__pycache__', '*.pyc', '.DS_Store', '.git', '.venv', 'venv', 'module-cache', '*.app'))
    if with_tibo:
        (target / '.tibo-enabled').touch()
    from usage_meter.desktop import is_windows
    if is_windows():
        config_path = target / '.mcp.json'
        config = json.loads(config_path.read_text(encoding='utf-8'))
        config['mcpServers']['usage-meter'].update(command=sys.executable, args=[str(target / 'meter.py'), 'mcp'])
        config_path.write_text(json.dumps(config, ensure_ascii=False, indent=2), encoding='utf-8')
        hook_path = target / 'hooks/hooks.json'
        hooks = json.loads(hook_path.read_text(encoding='utf-8'))
        for event in ('UserPromptSubmit', 'SessionStart'):
            hooks['hooks'][event][0]['hooks'][0]['command'] = subprocess.list2cmdline([sys.executable, str(target / 'floating.py'), 'hook'])
        hook_path.write_text(json.dumps(hooks, ensure_ascii=False, indent=2), encoding='utf-8')
    else:
        (target / 'bin' / 'launch').chmod(0o755)
    update_marketplace_json(marketplace, None, 'codex-usage-meter', 'AVAILABLE', 'ON_INSTALL', 'Productivity', False)
    return target, marketplace, payload['name']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--enable', action='store_true', help='Also run codex plugin add after registration')
    parser.add_argument('--with-tibo', action='store_true', help='Include the optional experimental Tibo integration')
    args = parser.parse_args()
    target, marketplace, name = install(ROOT, Path.home(), with_tibo=args.with_tibo)
    print(f'插件文件：{target}\n个人市场：{marketplace}')
    if args.enable:
        import os
        codex = os.environ.get('CODEX_USAGE_CODEX') or shutil.which('codex')
        if not codex:
            raise SystemExit('已注册；未找到 codex。请设置 CODEX_USAGE_CODEX 或在 Codex 插件界面启用。')
        subprocess.run([codex, 'plugin', 'add', f'codex-usage-meter@{name}'], check=True)
    else:
        print(f'启用：codex plugin add codex-usage-meter@{name}')
    print('启用后新建一个任务，使用“打开用量仪表”。')


if __name__ == '__main__':
    main()
