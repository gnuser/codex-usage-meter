"""Read-only official app-server JSON-RPC adapter (no private HTTP APIs)."""
import json
import os
import queue
import shutil
import subprocess
import threading
import time


class AppServer:
    def __init__(self, command=None, home=None, timeout=20):
        executable = os.environ.get('CODEX_USAGE_CODEX') or shutil.which('codex')
        if command is None:
            if not executable:
                raise RuntimeError('未找到 codex；请设置 CODEX_USAGE_CODEX 为可执行文件路径')
            command = [executable, 'app-server']
        env = os.environ.copy()
        if home is not None:
            env['CODEX_HOME'] = str(home)
        self.timeout, self.seq = timeout, 0
        self.messages = queue.Queue()
        self.process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                        stderr=subprocess.DEVNULL, text=True, encoding='utf-8', env=env)
        self.reader = threading.Thread(target=self._read, daemon=True)
        self.reader.start()
        try:
            self.request('initialize', {'clientInfo': {'name': 'codex_usage_meter', 'version': '1.3.0'}})
            self.send({'method': 'initialized', 'params': {}})
        except Exception:
            self.close()
            raise

    def _read(self):
        for line in self.process.stdout:
            try:
                self.messages.put(json.loads(line))
            except ValueError:
                continue
        self.messages.put(None)

    def send(self, value):
        self.process.stdin.write(json.dumps(value) + '\n')
        self.process.stdin.flush()

    def request(self, method, params=None):
        if method not in ('initialize', 'account/rateLimits/read', 'account/usage/read'):
            raise ValueError('Only read-only usage methods are permitted')
        self.seq += 1
        self.send({'id': self.seq, 'method': method, 'params': params or {}})
        end = time.monotonic() + self.timeout
        while True:
            remaining = end - time.monotonic()
            if remaining <= 0:
                raise RuntimeError('App Server 查询超时')
            try:
                message = self.messages.get(timeout=remaining)
            except queue.Empty as exc:
                raise RuntimeError('App Server 查询超时') from exc
            if message is None:
                raise RuntimeError('App Server 已退出：请检查 Codex 登录、配置和本地状态目录权限')
            if message.get('id') == self.seq and 'method' not in message:
                if 'error' in message:
                    error = message['error']
                    # Do not return arbitrary server text that could contain credentials.
                    raise RuntimeError(f'官方接口不可用（错误码 {error.get("code", "unknown")}）；可能为版本、认证或权限限制')
                return message.get('result')
            if 'method' in message and 'id' in message:
                self.send({'id': message['id'], 'error': {'code': -32601, 'message': 'Read-only client'}})

    def close(self):
        if self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait()
        self.reader.join(timeout=1)
        for stream in (self.process.stdin, self.process.stdout):
            try:
                stream.close()
            except OSError:
                pass


def account_snapshot(home=None, thread_id=None, factory=AppServer):
    result = {'source': 'official_app_server', 'fetchedAt': time.time(), 'errors': {},
              'limits': None, 'usage': None, 'threadEstimate': None}
    client = None
    try:
        client = factory(home=home)
        requests = [('limits', 'account/rateLimits/read', {}), ('usage', 'account/usage/read', {})]
        if thread_id:
            requests.append(('threadEstimate', 'account/usage/read', {'threadId': thread_id}))
        for key, method, params in requests:
            try:
                result[key] = client.request(method, params)
            except (RuntimeError, OSError) as exc:
                result['errors'][key] = str(exc)
    except (RuntimeError, OSError) as exc:
        result['errors']['connection'] = str(exc)
    finally:
        if client:
            client.close()
    return result
