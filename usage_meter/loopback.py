"""HTTP listener for numeric loopback addresses, without DNS at startup."""
from http.server import ThreadingHTTPServer
from socketserver import TCPServer


class LoopbackHTTPServer(ThreadingHTTPServer):
    def server_bind(self):
        # HTTPServer normally calls getfqdn(), which can stall on offline or CI
        # hosts. Our listener and Host checks use the literal loopback address.
        TCPServer.server_bind(self)
        self.server_name, self.server_port = self.server_address[:2]
