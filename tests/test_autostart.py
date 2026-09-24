import subprocess
import sys
import tempfile
import unittest
from contextlib import nullcontext
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from native.install_autostart import VALUE_NAME, install, remove, startup_command


class AutostartTests(unittest.TestCase):
    def test_command_uses_windowless_python_and_quotes_paths(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder) / 'Meter Source'
            root.mkdir()
            python = Path(folder) / 'Python Venv/python.exe'
            python.parent.mkdir()
            python.with_name('pythonw.exe').touch()
            self.assertEqual(startup_command(python, root), subprocess.list2cmdline([
                str(python.with_name('pythonw.exe')), str(root/'floating.py'), 'daemon']))

    def test_install_is_idempotent_and_preserves_unrelated_entry(self):
        values = {}

        def query(_, name):
            if name not in values:
                raise FileNotFoundError
            return values[name], 1

        def set_value(_, name, __, ___, value):
            values[name] = value

        registry = SimpleNamespace(HKEY_CURRENT_USER=1, KEY_QUERY_VALUE=1,
                                   KEY_SET_VALUE=2, REG_SZ=1,
                                   CreateKeyEx=lambda *args: nullcontext(object()),
                                   QueryValueEx=query, SetValueEx=set_value,
                                   DeleteValue=lambda _, name: values.pop(name))
        with patch.dict(sys.modules, {'winreg': registry}), \
             patch('native.install_autostart.is_windows', return_value=True):
            install('"C:\\meter\\pythonw.exe" "C:\\meter\\floating.py" daemon')
            self.assertIn(VALUE_NAME, values)
            install(values[VALUE_NAME])
            remove()
            self.assertNotIn(VALUE_NAME, values)
            values[VALUE_NAME] = 'unrelated.exe'
            with self.assertRaises(RuntimeError):
                install('new command')
            with self.assertRaises(RuntimeError):
                remove()
            self.assertEqual(values[VALUE_NAME], 'unrelated.exe')


if __name__ == '__main__':
    unittest.main()
