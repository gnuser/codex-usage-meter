"""Windows WebView2 window with a tray recovery path; GUI imports stay lazy."""
from concurrent.futures import ThreadPoolExecutor
import json
import math
import os
from pathlib import Path
import re
import sys
import threading
import time
from urllib.parse import parse_qs, urlencode, urlsplit, urlunsplit
from urllib.request import Request, urlopen

if __package__:
    from .window_position import codex_window_position
else:
    from window_position import codex_window_position

UUID = re.compile(r'[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}')


def connection_url(folder):
    data = json.loads((folder / 'connection.json').read_text(encoding='utf-8'))
    url = urlsplit(data['url'])
    key = parse_qs(url.fragment).get('key', [''])[0]
    if url.scheme != 'http' or url.hostname != '127.0.0.1' or not url.port or not key or url.username or url.password:
        raise ValueError('Invalid local usage connection')
    return urlunsplit((url.scheme, url.netloc, '/panel', '', urlencode({'key': key})))


def quota_text(windows, now=None):
    now = time.time() if now is None else now
    valid = []
    for window in windows:
        value, reset = window.get('remainingPercent'), window.get('resetsAt')
        if not isinstance(value, (int, float)) or not math.isfinite(value) or not 0 <= value <= 100:
            continue
        if isinstance(reset, (int, float)) and reset <= now:
            continue
        valid.append(value)
    return f'{min(valid):.2f}%' if valid else '—'


class Bridge:
    def __init__(self, panel_url, opener=None):
        self._panel_url = panel_url
        self._opener = opener or os.startfile
        self._window = None

    def _require_local_page(self):
        if self._window is None or self._window.get_current_url() != self._panel_url:
            raise ValueError('Untrusted page')

    def set_title(self, title):
        if not isinstance(title, str) or len(title) > 180:
            raise ValueError('Invalid title')
        self._require_local_page()
        self._window.set_title(title)
        return True

    def fit_height(self, height, viewport_height, available_height, available_top=0):
        values = (height, viewport_height, available_height)
        if any(type(v) not in (int, float) or not math.isfinite(v) or v <= 0 for v in values):
            raise ValueError('Invalid window dimensions')
        if type(available_top) not in (int, float) or not math.isfinite(available_top):
            raise ValueError('Invalid screen origin')
        self._require_local_page()
        window = self._window
        chrome = max(0, min(100, window.height - viewport_height))
        target = max(100, min(480, available_height * 0.6, math.ceil(height + chrome)))
        if abs(window.height - target) >= 2:
            x, y = window.x, max(available_top, min(window.y + window.height - target, available_top + available_height - target))
            window.resize(window.width, int(target))
            window.move(x, y)
        return True

    def open_post(self, url):
        if not isinstance(url, str) or not re.fullmatch(r'https://x\.com/thsottiaux/status/[0-9]+', url):
            raise ValueError('Invalid public post')
        self._require_local_page()
        self._opener(url)
        return True

    def open_thread(self, identifier):
        # Do not expose arbitrary shell commands, URLs, or files to the webview.
        if not isinstance(identifier, str) or not UUID.fullmatch(identifier):
            raise ValueError('Invalid conversation')
        self._require_local_page()
        self._opener('codex://threads/' + identifier)
        return True


class Desktop:
    def __init__(self, folder, panel_url):
        self.folder, self.panel_url = folder, panel_url
        self.window = self.icon = None
        self.stopped = threading.Event()
        self.tray_ready = threading.Event()
        self.quitting = False
        self.summary = 'Codex · 活跃 — · 剩余 —'
        self.count, self.windows = None, []
        self.show_stamp = self.read_show()

    def read_show(self):
        try:
            return json.loads((self.folder / 'show.json').read_text(encoding='utf-8')).get('at')
        except (OSError, ValueError):
            return None

    def request(self, path):
        url = urlsplit(self.panel_url)
        key = parse_qs(url.fragment)['key'][0]
        request = Request(urlunsplit((url.scheme, url.netloc, path.split('?')[0], path.partition('?')[2], '')),
                          headers={'Authorization': 'Bearer ' + key})
        with urlopen(request, timeout=75 if path == '/api/account' else 10) as response:
            return json.load(response)

    def show(self, *_):
        self.window.restore()
        self.window.show()
        self.refresh_panel()

    def refresh_panel(self):
        try:
            self.window.run_js("window.refreshUsage?.()")
        except Exception:
            pass  # Loading or closing; the next heartbeat will retry.

    def hide(self, *_):
        if self.tray_ready.is_set():
            self.window.hide()
        else:
            # If the tray is unavailable, retain the taskbar recovery button.
            self.window.minimize()

    def closing(self):
        if self.quitting:
            return True
        self.hide()
        return False

    def quit(self, *_):
        (self.folder / 'paused').touch()
        self.quitting = True
        self.stopped.set()
        self.window.destroy()

    def run_tray(self):
        try:
            def ready(icon):
                icon.visible = True
                self.tray_ready.set()
            self.icon.run(setup=ready)
        finally:
            self.tray_ready.clear()

    def poll(self):
        pool = ThreadPoolExecutor(max_workers=2)
        active = quota = None
        next_active = next_quota = next_panel = 0
        try:
            while not self.stopped.wait(1):
                stamp = self.read_show()
                if stamp is not None and stamp != self.show_stamp:
                    self.show_stamp = stamp
                    self.show()
                now = time.time()
                if now >= next_panel:
                    next_panel = now + 5
                    # A native heartbeat recovers web timers suspended while minimized.
                    self.refresh_panel()
                if active is not None and active.done():
                    try:
                        self.count = sum(s['updatedAt'] >= now - 1800 for s in active.result()['sessions'])
                    except Exception:
                        self.count = None
                    active = None
                if quota is not None and quota.done():
                    try:
                        self.windows = quota.result().get('windows', [])
                    except Exception:
                        self.windows = []
                    quota = None
                if active is None and now >= next_active:
                    active = pool.submit(self.request, '/api/threads?limit=100'); next_active = now + 15
                if quota is None and now >= next_quota:
                    quota = pool.submit(self.request, '/api/account'); next_quota = now + 300
                summary = f'Codex · 活跃 {self.count if self.count is not None else "—"} · 剩余 {quota_text(self.windows, now)}'
                if summary != self.summary:
                    self.summary = summary
                    self.icon.title = summary
                    self.icon.update_menu()
        finally:
            pool.shutdown(wait=False, cancel_futures=True)


def main(folder):
    if sys.platform != 'win32':
        raise SystemExit('This window requires Windows 10/11 and WebView2.')
    import webview
    import pystray
    from PIL import Image, ImageDraw

    panel_url = connection_url(folder)
    app = Desktop(folder, panel_url)
    bridge = Bridge(panel_url)
    webview.settings['ALLOW_DOWNLOADS'] = False
    webview.settings['ALLOW_FILE_URLS'] = False
    window = webview.create_window('Codex 用量', panel_url, js_api=bridge, width=260, height=170,
                                   min_size=(240, 100), on_top=True, focus=False, background_color='#1b1d21')
    app.window = bridge._window = window
    image = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    for x, height in ((4, 10), (12, 22), (20, 16)):
        draw.rounded_rectangle((x, 28-height, x+6, 28), radius=2, fill='#6bb69b')
    app.icon = pystray.Icon('CodexUsageMeter', image, app.summary, menu=pystray.Menu(
        pystray.MenuItem(lambda item: app.summary, None, enabled=False),
        pystray.MenuItem('显示用量', app.show, default=True),
        pystray.MenuItem('收起', app.hide),
        pystray.MenuItem('退出并暂停自动打开', app.quit)))
    window.events.closing += app.closing
    window.events.closed += app.stopped.set
    def started():
        try:
            position = codex_window_position()
            if position is not None:
                window.move(*position)
        except (OSError, ValueError):
            pass  # Placement is optional; never prevent the tray and refresh loop starting.
        threading.Thread(target=app.run_tray, daemon=True).start()
        threading.Thread(target=app.poll, daemon=True).start()
    try:
        webview.start(started, gui='edgechromium', private_mode=True)
    finally:
        app.stopped.set()
        app.icon.stop()


if __name__ == '__main__':
    main(Path(sys.argv[1]))
