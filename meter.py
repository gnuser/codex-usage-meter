#!/usr/bin/env python3
"""Codex Usage Meter CLI, MCP server and loopback dashboard."""
import argparse
import json
import secrets
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from usage_meter.account import account_snapshot
from usage_meter.browser_posts import BrowserPosts
from usage_meter.ledger import Ledger, normalize_limits

ROOT = Path(__file__).resolve().parent


class Service:
    def __init__(self, home=None):
        self.ledger = Ledger(home)
        self.public_posts = BrowserPosts()
        self.browser_token = None
        self.server = None
        self.token = secrets.token_urlsafe(32)
        self.lock = threading.Lock()

    def dashboard(self, thread_id=None, view="full"):
        if view not in ("full", "panel") or (view == "panel" and not thread_id):
            raise ValueError("Panel requires an explicit thread_id")
        with self.lock:
            if self.server is None:
                self.server = create_server(self)
                threading.Thread(target=self.server.serve_forever, daemon=True).start()
        from urllib.parse import urlencode
        fragment = urlencode({'key': self.token, 'thread': thread_id or ''})
        path = '/panel' if view == 'panel' else '/'
        return f'http://127.0.0.1:{self.server.server_port}{path}#{fragment}'

    def close(self):
        self.public_posts.close()
        if self.server:
            self.server.shutdown()
            self.server.server_close()


def create_server(service, port=0):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def reply(self, status, value, mime='application/json; charset=utf-8'):
            body = value if isinstance(value, bytes) else json.dumps(value, ensure_ascii=False).encode()
            self.send_response(status)
            self.send_header('Content-Type', mime)
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Referrer-Policy', 'no-referrer')
            self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'")
            self.end_headers()
            self.wfile.write(body)

        def do_POST(self):
            if self.headers.get('Host') != f'127.0.0.1:{self.server.server_port}':
                return self.reply(403, {'error': 'Invalid Host'})
            path = urlsplit(self.path).path
            if path not in ('/api/tibo/pair', '/api/tibo/ingest'):
                return self.reply(404, {'error': 'Not found'})
            token = service.token if path.endswith('/pair') else service.browser_token
            if not token or not secrets.compare_digest(self.headers.get('Authorization', ''), 'Bearer ' + token):
                return self.reply(401, {'error': 'Invalid key'})
            try:
                length = int(self.headers.get('Content-Length', '0'))
                if not 0 < length <= 262144 or self.headers.get('Transfer-Encoding'):
                    raise ValueError('Invalid body size')
                self.connection.settimeout(5)
                data = json.loads(self.rfile.read(length))
                if path.endswith('/pair'):
                    with service.lock:
                        service.browser_token = secrets.token_urlsafe(32)
                        return self.reply(200, {'token': service.browser_token})
                service.public_posts.ingest(data)
                return self.reply(200, {'ok': True})
            except (ValueError, OSError):
                return self.reply(400, {'error': 'Invalid public-post payload'})

        def do_GET(self):
            expected = f'127.0.0.1:{self.server.server_port}'
            if self.headers.get('Host') != expected:
                return self.reply(403, {'error': 'Invalid Host'})
            url = urlsplit(self.path)
            assets = {'/panel': ('panel.html', 'text/html; charset=utf-8'),
                      '/panel.js': ('panel.js', 'text/javascript; charset=utf-8'),
                      '/panel-size.js': ('panel-size.js', 'text/javascript; charset=utf-8'),
                      '/panel.css': ('panel.css', 'text/css; charset=utf-8'),
                      '/tibo.js': ('tibo.js', 'text/javascript; charset=utf-8'),
                      '/quota-summary.js': ('quota-summary.js', 'text/javascript; charset=utf-8'),
                      '/': ('index.html', 'text/html; charset=utf-8'),
                      '/chart-math.js': ('chart-math.js', 'text/javascript; charset=utf-8'),
                      '/app.js': ('app.js', 'text/javascript; charset=utf-8'),
                      '/style.css': ('style.css', 'text/css; charset=utf-8')}
            if url.path in assets:
                name, mime = assets[url.path]
                return self.reply(200, (ROOT / 'web' / name).read_bytes(), mime)
            if not secrets.compare_digest(self.headers.get('Authorization', ''), 'Bearer ' + service.token):
                return self.reply(401, {'error': 'Missing dashboard key'})
            query = parse_qs(url.query)
            thread_id = query.get('thread', [None])[0]
            if thread_id and (len(thread_id) > 128 or not all(c.isalnum() or c in '-_' for c in thread_id)):
                return self.reply(400, {'error': 'Invalid thread id'})
            if url.path == '/api/tibo':
                return self.reply(200, service.public_posts.snapshot())
            if url.path == '/api/threads':
                try:
                    return self.reply(200, service.ledger.catalog(int(query.get('limit', ['10'])[0])))
                except ValueError as exc:
                    return self.reply(400, {'error': str(exc)})
            if url.path == '/api/panel':
                try:
                    data = service.ledger.snapshot(thread_id, exact=True, include_messages=False)
                except ValueError as exc:
                    return self.reply(400, {'error': str(exc)})
                selected = data['selected']
                if selected:
                    selected = {k: selected[k] for k in ('id', 'title', 'total', 'models', 'updatedAt', 'warnings')} | {
                        'turns': [dict(t, number=i + 1) for i, t in enumerate(data['selected']['turns'])][-10:]}
                return self.reply(200, {'generatedAt': data['generatedAt'], 'selected': selected, 'errors': data['errors']})
            if url.path == '/api/snapshot':
                try:
                    limit = int(query.get('limit', ['1'])[0])
                    result = service.ledger.snapshot(thread_id, limit=limit, exact=query.get('scope') == ['thread'])
                except ValueError as exc:
                    return self.reply(400, {'error': str(exc)})
                return self.reply(200, result)
            if url.path == '/api/account':
                account = account_snapshot(service.ledger.home, thread_id)
                account['windows'] = normalize_limits(account['limits'])
                return self.reply(200, account)
            return self.reply(404, {'error': 'Not found'})
    return ThreadingHTTPServer(('127.0.0.1', port), Handler)


TOOL_DEFS = [
    {'name': 'usage_snapshot', 'description': 'Read local Codex token accounting. Pass the actual current thread_id; omission lists threads and does not guess the current conversation.',
     'inputSchema': {'type': 'object', 'properties': {'thread_id': {'type': 'string'}}, 'additionalProperties': False}},
    {'name': 'usage_account', 'description': 'Read official account rate limits and token activity via Codex app-server; optional per-thread server ESTIMATE, never exact billing.',
     'inputSchema': {'type': 'object', 'properties': {'thread_id': {'type': 'string'}}, 'additionalProperties': False}},
    {'name': 'usage_dashboard', 'description': 'Open a local interactive usage dashboard. Returns a private loopback URL. Pass actual current thread_id when known.',
     'inputSchema': {'type': 'object', 'properties': {'thread_id': {'type': 'string'}}, 'additionalProperties': False}},
]
TOOL_DEFS[2]['inputSchema']['properties']['view'] = {'type': 'string', 'enum': ['full', 'panel'], 'default': 'full', 'description': 'panel: compact auto-refresh list of sessions active in the last 30 minutes; requires current thread_id as launch context.'}
for definition in TOOL_DEFS:
    definition['annotations'] = {'readOnlyHint': True, 'destructiveHint': False, 'openWorldHint': False}
TOOL_DEFS[0]['inputSchema']['properties']['limit'] = {'type': 'integer', 'minimum': 1, 'maximum': 1000, 'default': 1, 'description': 'Start with 1 latest session; increase by 3 only when requested.'}
TOOL_DEFS[0]['description'] = 'Read only the latest 1 local session by default. Explicitly increase limit by 3 to load more. Latest session is not necessarily the current task.'


def dispatch(service, request):
    method, params = request.get('method'), request.get('params') or {}
    if method == 'initialize':
        version = params.get('protocolVersion')
        return {'protocolVersion': version if version in ('2024-11-05', '2025-03-26', '2025-06-18', '2025-11-25') else '2024-11-05',
                'capabilities': {'tools': {}}, 'serverInfo': {'name': 'codex-usage-meter', 'version': '1.3.0'}}
    if method == 'ping':
        return {}
    if method == 'tools/list':
        return {'tools': TOOL_DEFS}
    if method == 'tools/call':
        args = params.get('arguments') or {}
        thread_id = args.get('thread_id')
        allowed = {'thread_id', 'limit'} if params.get('name') == 'usage_snapshot' else ({'thread_id', 'view'} if params.get('name') == 'usage_dashboard' else {'thread_id'})
        if set(args) - allowed or (thread_id is not None and not isinstance(thread_id, str)):
            raise ValueError('Invalid arguments')
        name = params.get('name')
        if name == 'usage_snapshot':
            result = service.ledger.snapshot(thread_id, limit=args.get('limit', 1))
        elif name == 'usage_account':
            result = account_snapshot(service.ledger.home, thread_id)
            result['windows'] = normalize_limits(result['limits'])
        elif name == 'usage_dashboard':
            result = {'url': service.dashboard(thread_id, args.get('view', 'full')), 'note': '仅本机访问；MCP 进程退出后链接失效。'}
        else:
            raise ValueError('Unknown tool')
        return {'content': [{'type': 'text', 'text': json.dumps(result, ensure_ascii=False)}],
                'structuredContent': result, 'isError': False}
    raise LookupError('Method not found')


def mcp(service):
    try:
        for line in sys.stdin:
            request = None
            try:
                request = json.loads(line)
                if not isinstance(request, dict):
                    raise ValueError('Expected JSON-RPC object')
                if 'id' not in request:
                    continue
                response = {'jsonrpc': '2.0', 'id': request['id'], 'result': dispatch(service, request)}
            except Exception as exc:
                response = {'jsonrpc': '2.0', 'id': request.get('id') if isinstance(request, dict) else None,
                            'error': {'code': -32601 if isinstance(exc, LookupError) else -32602,
                                      'message': str(exc)}}
            print(json.dumps(response, ensure_ascii=False), flush=True)
    finally:
        service.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--home', help='Codex state directory (default CODEX_HOME or ~/.codex)')
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('mcp')
    for command in ('snapshot', 'account', 'serve'):
        cmd = sub.add_parser(command)
        cmd.add_argument('--thread', help='Exact thread ID; never inferred from recency')
        if command == 'snapshot':
            cmd.add_argument('--limit', type=int, default=1, help='Load latest N sessions (default 1)')
        if command == 'serve':
            cmd.add_argument('--port', type=int, default=0)
            cmd.add_argument('--view', choices=('full', 'panel'), default='full')
    args = parser.parse_args()
    service = Service(args.home)
    if args.command == 'mcp':
        mcp(service)
    elif args.command == 'snapshot':
        print(json.dumps(service.ledger.snapshot(args.thread, limit=args.limit), ensure_ascii=False, indent=2))
    elif args.command == 'account':
        result = account_snapshot(service.ledger.home, args.thread)
        result['windows'] = normalize_limits(result['limits'])
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        if args.view == 'panel' and not args.thread:
            parser.error('--view panel requires --thread')
        service.server = create_server(service, args.port)
        from urllib.parse import urlencode
        route = '/panel' if args.view == 'panel' else '/'
        print(f'http://127.0.0.1:{service.server.server_port}{route}#' + urlencode({'key': service.token, 'thread': args.thread or ''}), flush=True)
        try:
            service.server.serve_forever()
        except KeyboardInterrupt:
            pass
        finally:
            service.server.server_close()


if __name__ == '__main__':
    main()
