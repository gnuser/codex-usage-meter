import importlib.util
import plistlib
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile

from usage_meter import sidebar_start

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('sidebar_install', ROOT / 'installers/install_sidebar.py')
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)


class SidebarInstallTests(unittest.TestCase):
    def test_allowlist_and_mac_install(self):
        files = installer.payload_files(ROOT)
        self.assertIn(Path('integrations/sidebar/popover.js'), files)
        self.assertIn(Path('integrations/sidebar/vendor/LICENSE'), files)
        self.assertFalse(any('.git' in p.parts or p.suffix in ('.mp4', '.wav', '.m4a') for p in files))
        with tempfile.TemporaryDirectory() as tmp, patch.object(installer, 'is_windows', return_value=False):
            folder, apps = Path(tmp) / 'runtime', Path(tmp) / "User's Apps"
            app = installer.install(ROOT, folder, apps)
            self.assertEqual(plistlib.loads((app / 'Contents/Info.plist').read_bytes())['CFBundleIdentifier'], 'local.codex.usage-meter.sidebar')
            self.assertTrue((folder / 'sidebar-mode').exists())
            self.assertTrue((folder / 'paused').exists())
            self.assertEqual(installer.install(ROOT, folder, apps), app)
            self.assertEqual(len(list((folder / 'sidebar').iterdir())), 1)
            (app / 'Contents/Info.plist').write_bytes(plistlib.dumps({'CFBundleIdentifier': 'other'}))
            with self.assertRaises(FileExistsError):
                installer.install(ROOT, folder, apps)

    def test_windows_shortcut_and_persisted_settings(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            python = root / 'python.exe'
            python.touch()
            python.with_name('pythonw.exe').touch()
            settings = {'node': 'C:/node/node.exe', 'app': 'C:/Codex/Codex.exe'}
            with patch.object(installer, 'is_windows', return_value=True), patch.object(installer.sys, 'executable', str(python)):
                launcher = installer.install(ROOT, root / 'runtime', root / 'Desktop', settings)
            content = launcher.read_text(encoding='utf-8')
            self.assertIn('pythonw.exe', content)
            self.assertIn('CODEX_USAGE_DATA=', content)
            import json
            config = next((root / 'runtime/sidebar').glob('*/sidebar-config.json'))
            self.assertEqual(json.loads(config.read_text()), settings)

    def test_node_validation_and_app_override(self):
        with tempfile.TemporaryDirectory() as tmp:
            node = Path(tmp) / 'node'
            node.touch()
            with patch.dict('os.environ', {'CODEX_METER_NODE': str(node)}), patch.object(sidebar_start.subprocess, 'run') as run:
                run.return_value.returncode = 0
                run.return_value.stdout = '24\n'
                self.assertEqual(sidebar_start.find_node(), str(node.resolve()))
            app = Path(tmp) / 'Codex.app'
            (app / 'Contents/MacOS').mkdir(parents=True)
            with patch.dict('os.environ', {'CODEX_METER_APP': str(app)}), patch.object(sidebar_start, 'is_windows', return_value=False):
                self.assertEqual(sidebar_start.find_app(), app)

    def test_running_codex_is_never_terminated(self):
        with patch.object(sidebar_start, 'debugging_ready', return_value=False), patch.object(sidebar_start, 'app_running', return_value=True), patch.object(sidebar_start.subprocess, 'Popen') as popen:
            with self.assertRaisesRegex(RuntimeError, 'Quit Codex normally'):
                sidebar_start.start('node', Path('/Codex.app'), 39222, Path('/unused'))
            popen.assert_not_called()

    def test_package_build(self):
        import subprocess
        import sys
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / 'package.zip'
            subprocess.run([sys.executable, str(ROOT / 'installers/build_package.py'), '--output', str(output)], check=True, capture_output=True)
            with zipfile.ZipFile(output) as archive:
                names = archive.namelist()
                self.assertIn('CodexUsageMeter/Install.command', names)
                self.assertIn('CodexUsageMeter/Install.cmd', names)
                self.assertIn('CodexUsageMeter/usage_meter/sidebar_start.py', names)
                self.assertNotIn('CodexUsageMeter/floating.py', names)
                self.assertFalse(any('..' in Path(name).parts for name in names))
                archive.extractall(Path(tmp) / 'extract')
            import os
            env = dict(os.environ, CODEX_HOME=str(Path(tmp) / 'empty-home'), CODEX_USAGE_TIBO='0')
            check = subprocess.run([sys.executable, 'meter.py', 'snapshot'], cwd=Path(tmp) / 'extract/CodexUsageMeter',
                                   env=env, capture_output=True, text=True, timeout=10)
            self.assertEqual(check.returncode, 0, check.stderr)
