import json
import tempfile
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from meter import Service
from usage_meter.browser_posts import BrowserPosts


class BrowserPostsTests(unittest.TestCase):
    def batch(self):
        return {'complete': True, 'posts': [
            {'id': str(n), 'text': 'We will reset Codex tomorrow.', 'publishedAt': 1000-n}
            for n in range(1, 4)]}

    def test_failure_and_expiry_invalidate_prediction_without_erasing_posts(self):
        now = [1000]
        reader = BrowserPosts(clock=lambda: now[0])
        reader.ingest(self.batch())
        self.assertEqual(reader.snapshot()['signal']['state'], 'announced')
        reader.ingest({'posts': [], 'complete': False})
        self.assertEqual(len(reader.snapshot()['posts']), 3)
        self.assertEqual(reader.snapshot()['signal']['state'], 'unknown')
        reader.ingest(self.batch())
        now[0] += 3601
        self.assertTrue(reader.snapshot()['stale'])
        self.assertEqual(reader.snapshot()['signal']['state'], 'unknown')

    def test_invalid_input(self):
        reader = BrowserPosts(clock=lambda: 1000)
        for value in (None, [], {'posts': []}, {'posts': [], 'complete': 1}):
            with self.assertRaises(ValueError): reader.ingest(value)
        for field, value in [('id', '1/x'), ('publishedAt', float('nan')),
                             ('publishedAt', True), ('publishedAt', 5000), ('text', '')]:
            batch = self.batch()
            batch['posts'][0][field] = value
            with self.assertRaises(ValueError): reader.ingest(batch)
        batch = self.batch()
        batch['posts'][1] = batch['posts'][0]
        with self.assertRaises(ValueError): reader.ingest(batch)

    def test_scoped_key_rotation_and_http_authentication(self):
        with tempfile.TemporaryDirectory() as home:
            service = Service(home, enable_tibo=True)
            base = service.dashboard().split('#')[0].rstrip('/')
            def post(path, key, data):
                return json.load(urlopen(Request(base+path, data=json.dumps(data).encode(),
                    headers={'Authorization': 'Bearer '+key, 'Content-Type': 'application/json'})))
            try:
                with self.assertRaises(HTTPError) as error:
                    post('/api/tibo/pair', 'wrong', {})
                self.assertEqual(error.exception.code, 401)
                key = post('/api/tibo/pair', service.token, {})['token']
                post('/api/tibo/ingest', key, self.batch())
                with self.assertRaises(HTTPError):
                    urlopen(Request(base+'/api/account', headers={'Authorization': 'Bearer '+key}))
                with self.assertRaises(HTTPError):
                    post('/api/tibo/pair', key, {})
                with self.assertRaises(HTTPError) as error:
                    post('/api/tibo/ingest', key, {'posts': None})
                self.assertEqual(error.exception.code, 400)
                post('/api/tibo/pair', service.token, {})
                with self.assertRaises(HTTPError): post('/api/tibo/ingest', key, self.batch())
            finally: service.close()


if __name__ == '__main__': unittest.main()
