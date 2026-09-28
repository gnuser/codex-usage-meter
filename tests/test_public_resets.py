import json
import threading
import unittest

from usage_meter.public_resets import PublicResets, decode_response, normalize


class PublicResetTests(unittest.TestCase):
    def test_json_and_sse_and_errors(self):
        message = json.dumps({'id': 2, 'result': {'content': []}})
        for body in (message, ': keepalive\r\n\r\nevent: message\r\ndata: ' + message + '\r\n\r\n'):
            self.assertEqual(decode_response(body.encode(), 2), {'content': []})
        for body in ('{"id":2,"error":{}}', '{"id":3,"result":{}}'):
            with self.assertRaises(ValueError):
                decode_response(body.encode(), 2)

    def test_only_public_fields_and_valid_dates(self):
        result = normalize({'latest_reset': {'announced_at': '2026-09-26T18:17:54.000Z',
                                             'text': 'untrusted text'},
                            'active_watch': {'expires_at': 'bad', 'forecast_window': 'around event'},
                            'scheduled_reset': {}})
        self.assertGreater(result['latestAt'], 0)
        self.assertIsNone(result['watchUntil'])
        self.assertTrue(result['scheduled'])
        self.assertNotIn('text', result)
        self.assertIsNone(normalize({'latest_reset': {'announced_at': '2026-09-26'}})['latestAt'])

    def test_background_cache_failure_and_close(self):
        entered, release, finished = threading.Event(), threading.Event(), threading.Event()
        now = [1000]
        calls = []
        def fetch():
            calls.append(1)
            entered.set()
            release.wait(2)
            return {'latestAt': 99}
        cache = PublicResets(fetch, lambda: now[0])
        original = cache._refresh
        def refresh():
            original()
            finished.set()
        cache._refresh = refresh
        self.assertEqual(cache.snapshot()['status'], 'loading')
        self.assertTrue(entered.wait(1))
        cache.snapshot()
        self.assertEqual(len(calls), 1)
        release.set()
        self.assertTrue(finished.wait(2))
        self.assertEqual(cache.snapshot()['status'], 'ok')
        cache.snapshot()['status'] = 'tampered'
        self.assertEqual(cache.snapshot()['status'], 'ok')
        def fail():
            raise OSError('offline')
        cache.fetch = fail
        now[0] += 301
        finished.clear()
        cache.snapshot()
        self.assertTrue(finished.wait(2))
        self.assertEqual(cache.snapshot()['status'], 'unavailable')
        self.assertNotIn('latestAt', cache.snapshot())
        cache.close()
        now[0] += 1000
        cache.snapshot()
        self.assertFalse(cache.busy)
