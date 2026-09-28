import os
from pathlib import Path
import unittest
from unittest.mock import patch

from usage_meter.account import codex_executable


class MacCliDiscoveryTests(unittest.TestCase):
    def discover(self, available, executable=True):
        with patch.dict(os.environ, {}, clear=True), \
             patch('usage_meter.account.shutil.which', return_value=None), \
             patch('usage_meter.account.is_windows', return_value=False), \
             patch('usage_meter.account.sys.platform', 'darwin'), \
             patch('usage_meter.account.Path.home', return_value=Path('/home/test')), \
             patch('usage_meter.account.Path.is_file', autospec=True, side_effect=lambda p: str(p) == available), \
             patch('usage_meter.account.os.access', return_value=executable):
            return codex_executable()

    def test_nested_and_legacy_app_layouts(self):
        for app in ('ChatGPT.app', 'Codex.app'):
            for folder in ('/Applications', '/home/test/Applications'):
                for relative in ('codex-cli/CodexCLI.app/Contents/MacOS/codex', 'codex'):
                    candidate = str(Path(folder) / app / 'Contents/Resources' / relative)
                    self.assertEqual(self.discover(candidate), candidate)

    def test_missing_or_nonexecutable_cli_is_unknown(self):
        self.assertIsNone(self.discover('missing'))
        self.assertIsNone(self.discover(str(Path('/Applications/ChatGPT.app/Contents/Resources/codex')), False))

    def test_explicit_path_takes_priority(self):
        with patch.dict(os.environ, {'CODEX_USAGE_CODEX': '/custom/codex'}):
            self.assertEqual(codex_executable(), '/custom/codex')
