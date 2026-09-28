from http.server import BaseHTTPRequestHandler
import unittest
from unittest.mock import patch

from usage_meter.loopback import LoopbackHTTPServer


class LoopbackTests(unittest.TestCase):
    def test_numeric_listener_never_resolves_a_hostname(self):
        with patch('socket.getfqdn', side_effect=AssertionError('DNS must not run')):
            with LoopbackHTTPServer(('127.0.0.1', 0), BaseHTTPRequestHandler) as server:
                self.assertEqual(server.server_name, '127.0.0.1')
                self.assertGreater(server.server_port, 0)
