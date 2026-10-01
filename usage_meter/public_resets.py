"""Read-only, cached public announcements from the Codex Resets MCP.

Only fixed protocol messages leave this process; account/session data never does.
"""
import copy
import json
import threading
import time
from datetime import datetime
from urllib.request import Request, build_opener, HTTPRedirectHandler

ENDPOINT = 'https://codex-resets.com/mcp'
SOURCE = 'https://codex-resets.com'
MAX_BYTES = 1024 * 1024


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def decode_response(raw, request_id):
    text = raw.decode('utf-8')
    messages = [text] if text.lstrip().startswith('{') else [
        '\n'.join(line[5:].lstrip() for line in block.splitlines() if line.startswith('data:'))
        for block in text.replace('\r\n', '\n').split('\n\n')]
    for message in messages:
        if not message:
            continue
        value = json.loads(message)
        if value.get('id') == request_id:
            if 'error' in value or not isinstance(value.get('result'), dict):
                raise ValueError('MCP request failed')
            return value['result']
    raise ValueError('MCP response missing')


def fetch_status():
    opener = build_opener(NoRedirect())
    headers = {'User-Agent': 'codex-usage-meter/1.4.0', 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream'}

    def send(method, params, request_id=None):
        payload = {'jsonrpc': '2.0', 'method': method, 'params': params}
        if request_id is not None:
            payload['id'] = request_id
        request = Request(ENDPOINT, data=json.dumps(payload).encode(), headers=headers)
        with opener.open(request, timeout=8) as response:
            session = response.headers.get('Mcp-Session-Id')
            if session:
                headers['Mcp-Session-Id'] = session
            raw = response.read(MAX_BYTES + 1)
        if len(raw) > MAX_BYTES:
            raise ValueError('MCP response too large')
        return decode_response(raw, request_id) if request_id is not None else None

    init = send('initialize', {'protocolVersion': '2025-03-26', 'capabilities': {},
                              'clientInfo': {'name': 'codex-usage-meter', 'version': '1.4.0'}}, 1)
    version = init.get('protocolVersion')
    if version != '2025-03-26':
        raise ValueError('Unsupported MCP protocol')
    headers['MCP-Protocol-Version'] = version
    send('notifications/initialized', {})
    result = send('tools/call', {'name': 'get_status', 'arguments': {}}, 2)
    if result.get('isError'):
        raise ValueError('Reset tool failed')
    data = result.get('structuredContent')
    if not isinstance(data, dict):
        data = next((json.loads(item['text']) for item in result.get('content', [])
                     if item.get('type') == 'text'), None)
    if not isinstance(data, dict) or not isinstance(data.get('data'), dict):
        raise ValueError('Invalid reset status')
    return normalize(data['data'])


def timestamp(value):
    try:
        date = datetime.fromisoformat(value.replace('Z', '+00:00'))
        return date.timestamp() if date.tzinfo is not None else None
    except (AttributeError, ValueError, OverflowError, TypeError):
        return None


def normalize(data):
    latest = data.get('latest_reset') or {}
    watch = data.get('active_watch') or {}
    if not isinstance(latest, dict) or not isinstance(watch, dict):
        raise ValueError('Invalid reset records')
    forecast = watch.get('forecast_window')
    return {'latestAt': timestamp(latest.get('announced_at')),
            'scheduled': isinstance(data.get('scheduled_reset'), dict),
            'watchUntil': timestamp(watch.get('expires_at')),
            'forecast': forecast[:500] if isinstance(forecast, str) else None}


class PublicResets:
    """Lazy background refresh: never delay local usage or retry on every poll."""
    def __init__(self, fetch=fetch_status, clock=time.time):
        self.fetch, self.clock = fetch, clock
        self.lock = threading.Lock()
        self.value = {'source': SOURCE, 'status': 'loading'}
        self.next_refresh = 0
        self.busy = False
        self.closed = False

    def snapshot(self):
        with self.lock:
            if not self.closed and not self.busy and self.clock() >= self.next_refresh:
                self.busy = True
                threading.Thread(target=self._refresh, daemon=True).start()
            return copy.deepcopy(self.value)

    def _refresh(self):
        try:
            value = {**self.fetch(), 'source': SOURCE, 'status': 'ok', 'checkedAt': self.clock()}
            delay = 300
        except Exception:
            value = {'source': SOURCE, 'status': 'unavailable'}
            delay = 60
        with self.lock:
            if not self.closed:
                self.value = value
                self.next_refresh = self.clock() + delay
            self.busy = False

    def close(self):
        with self.lock:
            self.closed = True
