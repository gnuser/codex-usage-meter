"""Quota reads must not wait for the slower daily analytics API."""
import unittest
from usage_meter.account import account_snapshot


class AccountRefreshTests(unittest.TestCase):
    def test_limits_only_skips_analytics_and_returns_reset_changes(self):
        class Client:
            calls = []
            closed = 0
            def __init__(self, **kwargs):
                pass
            def request(self, method, params):
                self.calls.append(method)
                if method != 'account/rateLimits/read':
                    raise AssertionError('Quota refresh must not request analytics')
                return {'rateLimitResetCredits': {'availableCount': 3}}
            def close(self):
                Client.closed += 1
        result = account_snapshot(thread_id='example', factory=Client, include_usage=False)
        self.assertEqual(result['limits']['rateLimitResetCredits']['availableCount'], 3)
        self.assertEqual(Client.calls, ['account/rateLimits/read'])
        self.assertEqual(Client.closed, 1)
        self.assertEqual(result['errors'], {})
        self.assertIsNone(result['usage'])
