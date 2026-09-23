import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch

from floating import atomic_json, window_command
from usage_meter.desktop import file_lock, runtime_dir, background_options
from native.windows import Bridge, Desktop, connection_url, quota_text


class WindowsTests(unittest.TestCase):
    def test_windows_paths_and_background_flags(self):
        with patch('usage_meter.desktop.is_windows', return_value=True), patch.dict(os.environ, {'LOCALAPPDATA': '/tmp/local-data'}, clear=True):
            self.assertEqual(runtime_dir(), Path('/tmp/local-data/CodexUsageMeter'))
            self.assertIn('creationflags', background_options())
            self.assertNotIn('start_new_session', background_options())

    def test_windows_install_required_and_uses_registered_python(self):
        with tempfile.TemporaryDirectory() as name, patch('floating.is_windows', return_value=True):
            folder = Path(name)
            self.assertIsNone(window_command(folder))
            atomic_json(folder/'windows.json', {'python': sys.executable})
            command = window_command(folder)
            self.assertTrue(command[1].endswith('native/windows.py') or command[1].endswith('native\\windows.py'))
            self.assertEqual(command[-1], str(folder))

    def test_cross_process_lock_excludes_and_releases(self):
        with tempfile.TemporaryDirectory() as name:
            path = Path(name)/'lock'
            script = "from usage_meter.desktop import file_lock; import sys\ntry:\n with file_lock(sys.argv[1],blocking=False):pass\nexcept BlockingIOError:sys.exit(7)"
            with file_lock(path):
                result = subprocess.run([sys.executable, '-c', script, str(path)], capture_output=True)
                self.assertEqual(result.returncode, 7, result.stderr)
            result = subprocess.run([sys.executable, '-c', script, str(path)], capture_output=True)
            self.assertEqual(result.returncode, 0, result.stderr)

    def test_connection_only_accepts_authenticated_loopback(self):
        with tempfile.TemporaryDirectory() as name:
            folder = Path(name)
            atomic_json(folder/'connection.json', {'url':'http://127.0.0.1:1234/#key=secret'})
            self.assertEqual(connection_url(folder), 'http://127.0.0.1:1234/panel#key=secret')
            for url in ('https://example.com/#key=x', 'http://127.0.0.1:1234/', 'http://user@127.0.0.1:1234/#key=x'):
                atomic_json(folder/'connection.json', {'url':url})
                with self.assertRaises(ValueError): connection_url(folder)

    def test_bridge_rejects_commands_and_untrusted_pages(self):
        opener = Mock()
        bridge = Bridge('http://127.0.0.1:1234/panel#key=x', opener)
        bridge._window = Mock()
        bridge._window.get_current_url.return_value = bridge._panel_url
        identifier = '00000000-0000-0000-0000-000000000001'
        self.assertTrue(bridge.open_thread(identifier))
        opener.assert_called_once_with('codex://threads/'+identifier)
        for value in ('https://example.com', '../file', 'cmd.exe', None):
            with self.assertRaises(ValueError): bridge.open_thread(value)
        bridge._window.get_current_url.return_value = 'https://example.com'
        with self.assertRaises(ValueError): bridge.open_thread(identifier)
        self.assertEqual(opener.call_count, 1)

    def test_title_bridge_checks_origin_and_payload(self):
        bridge = Bridge('http://127.0.0.1:1/panel#key=x', opener=Mock())
        bridge._window = Mock()
        bridge._window.get_current_url.return_value = bridge._panel_url
        self.assertTrue(bridge.set_title('周45% · 4天后重置'))
        for value in (None, 'x' * 181):
            with self.assertRaises(ValueError): bridge.set_title(value)
        bridge._window.get_current_url.return_value = 'https://example.com'
        with self.assertRaises(ValueError): bridge.set_title('untrusted')
        bridge._window.set_title.assert_called_once()

    def test_auto_height_keeps_bottom_and_checks_origin(self):
        bridge = Bridge('http://127.0.0.1:1/panel#key=x', opener=Mock())
        window = bridge._window = Mock(width=240, height=200, x=800, y=600)
        window.get_current_url.return_value = bridge._panel_url
        bridge.fit_height(300, 170, 900)
        window.resize.assert_called_with(240, 330)
        window.move.assert_called_with(800, 470)
        bridge.fit_height(50, 170, 900)
        window.resize.assert_called_with(240, 100)
        bridge.fit_height(9000, 170, 900)
        window.resize.assert_called_with(240, 480)
        window.y = 10
        bridge.fit_height(400, 170, 900)
        window.move.assert_called_with(800, 0)
        window.y = -890
        bridge.fit_height(400, 170, 900, -900)
        window.move.assert_called_with(800, -900)
        for value in (None, True, -1, float('nan')):
            with self.assertRaises(ValueError): bridge.fit_height(value, 170, 900)
        window.get_current_url.return_value = 'https://example.com'
        with self.assertRaises(ValueError): bridge.fit_height(100, 170, 900)

    def test_public_post_bridge_restricts_destination(self):
        opener = Mock()
        bridge = Bridge('http://127.0.0.1:1/panel#key=x', opener=opener)
        bridge._window = Mock()
        bridge._window.get_current_url.return_value = bridge._panel_url
        self.assertTrue(bridge.open_post('https://x.com/thsottiaux/status/123'))
        for value in ('https://evil.example/', 'https://x.com/other/status/123',
                      'https://x.com/thsottiaux/status/123?redirect=evil', None):
            with self.assertRaises(ValueError): bridge.open_post(value)
        bridge._window.get_current_url.return_value = 'https://evil.example/'
        with self.assertRaises(ValueError): bridge.open_post('https://x.com/thsottiaux/status/123')
        opener.assert_called_once()

    def test_placement_respects_work_area(self):
        from native.window_position import bottom_right
        self.assertEqual(bottom_right((0, 0, 1000, 800), (0, 0, 1000, 760), 260, 170), (728, 590))
        self.assertEqual(bottom_right((-1400, 0, -400, 800), (-1400, 0, 0, 760), 260, 170), (-672, 590))
        self.assertEqual(bottom_right((-500, -500, 100, 100), (0, 0, 1000, 760), 260, 170), (0, 0))

    def test_closing_keeps_recovery_path_and_quit_pauses(self):
        with tempfile.TemporaryDirectory() as name:
            app = Desktop(Path(name), 'http://127.0.0.1:1/panel#key=x')
            app.window = Mock()
            self.assertFalse(app.closing())
            app.window.minimize.assert_called_once()
            app.window.hide.assert_not_called()
            app.tray_ready.set()
            self.assertFalse(app.closing())
            app.window.hide.assert_called_once()
            app.quit()
            self.assertTrue((Path(name)/'paused').exists())
            self.assertTrue(app.closing())
            app.window.destroy.assert_called_once()

    def test_independent_quota_windows_and_expiry(self):
        self.assertEqual(quota_text([{'remainingPercent':90},{'remainingPercent':23.5}],100), '23.50%')
        self.assertEqual(quota_text([{'remainingPercent':1,'resetsAt':99},{'remainingPercent':90}],100), '90.00%')
        self.assertEqual(quota_text([{'remainingPercent':None},{'remainingPercent':float('nan')}]), '—')

    def test_windows_plugin_install_has_native_mcp_and_hook_commands(self):
        from install import install
        with tempfile.TemporaryDirectory() as name, patch('usage_meter.desktop.is_windows', return_value=True):
            target, _, _ = install(Path(__file__).resolve().parents[1], Path(name))
            config = json.loads((target/'.mcp.json').read_text(encoding='utf-8'))['mcpServers']['usage-meter']
            self.assertEqual(config['command'], sys.executable)
            self.assertEqual(config['args'], [str(target/'meter.py'), 'mcp'])
            hook = json.loads((target/'hooks/hooks.json').read_text(encoding='utf-8'))['hooks']['UserPromptSubmit'][0]['hooks'][0]['command']
            self.assertEqual(hook, subprocess.list2cmdline([sys.executable, str(target/'floating.py'), 'hook']))
            self.assertFalse((target/'.git').exists())

if __name__ == '__main__': unittest.main()
