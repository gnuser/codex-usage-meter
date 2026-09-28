import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from install import install
from meter import Service


class OptionalTiboTests(unittest.TestCase):
    def test_default_service_has_no_tibo_ui_or_endpoints(self):
        with tempfile.TemporaryDirectory() as home:
            service = Service(home, enable_tibo=False)
            base = service.dashboard().split('#')[0].rstrip('/')
            try:
                self.assertIsNone(service.public_posts)
                page = urlopen(base + '/panel').read().decode()
                self.assertNotIn('src="/tibo.js"', page)
                self.assertIn('id="tibo" hidden', page)
                for path, body in [('/tibo.js', None), ('/api/tibo', None),
                                   ('/api/tibo/pair', b'{}'), ('/api/tibo/ingest', b'{}')]:
                    with self.assertRaises(HTTPError) as error:
                        urlopen(Request(base + path, data=body,
                                        headers={'Authorization': 'Bearer ' + service.token}))
                    self.assertEqual(error.exception.code, 404)
            finally:
                service.close()

    def test_packages_run_without_optional_modules_and_can_opt_in(self):
        source = Path(__file__).resolve().parents[1]
        for enabled in (False, True):
            with self.subTest(enabled=enabled), tempfile.TemporaryDirectory() as home:
                target, _, _ = install(source, Path(home), with_tibo=enabled)
                for name in ('browser-extension', 'usage_meter/browser_posts.py',
                             'usage_meter/reset_signal.py', 'web/tibo.js', '.tibo-enabled'):
                    self.assertEqual((target / name).exists(), enabled, name)
                code = ('from meter import Service; s=Service(enable_tibo=' + str(enabled) + '); '
                        'print(s.public_posts is not None); s.close()')
                result = subprocess.run([sys.executable, '-c', code], cwd=target,
                                        capture_output=True, text=True, check=True)
                self.assertEqual(result.stdout.strip(), str(enabled))
