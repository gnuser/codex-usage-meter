"""In-memory public posts supplied by the paired Chrome extension."""
import math
import re
import threading
import time

from .reset_signal import assess


class BrowserPosts:
    def __init__(self, clock=time.time):
        self.clock = clock
        self.lock = threading.Lock()
        self.posts = []
        self.fetched = None
        self.error = '等待 Chrome 扩展连接'
        self.complete = False

    def ingest(self, data):
        if not isinstance(data, dict) or not isinstance(data.get('posts'), list):
            raise ValueError('Expected posts')
        posts = data['posts']
        if len(posts) > 3 or type(data.get('complete')) is not bool:
            raise ValueError('Invalid batch')
        normalized = []
        now = self.clock()
        for post in posts:
            if not isinstance(post, dict):
                raise ValueError('Invalid post')
            identifier, text, stamp = post.get('id'), post.get('text'), post.get('publishedAt')
            if (not isinstance(identifier, str) or not re.fullmatch(r'[0-9]{1,25}', identifier)
                    or not isinstance(text, str) or not 0 < len(text) <= 20000
                    or type(stamp) not in (int, float) or not math.isfinite(stamp)
                    or not 0 < stamp <= now + 60):
                raise ValueError('Invalid post')
            normalized.append({'id': identifier, 'text': text, 'publishedAt': stamp,
                               'url': 'https://x.com/thsottiaux/status/' + identifier})
        if len({p['id'] for p in normalized}) != len(normalized):
            raise ValueError('Duplicate posts')
        complete = data['complete'] and len(normalized) == 3
        with self.lock:
            # Failed reads preserve the previous display, but invalidate its prediction.
            if normalized:
                self.posts = sorted(normalized, key=lambda p: (p['publishedAt'], int(p['id'])), reverse=True)
                self.fetched = now
            self.complete = complete
            self.error = None if complete else '页面读取不完整；请检查 X 登录、加载状态或展开长文'

    def snapshot(self):
        with self.lock:
            now = self.clock()
            stale = (not self.complete or self.fetched is None or now - self.fetched > 3600
                     or not self.posts or now - self.posts[0]['publishedAt'] > 72 * 3600)
            signal = assess([] if stale else self.posts, now)
            if stale:
                signal['label'] = '数据待更新 · 暂不预测'
            return {'account': 'thsottiaux', 'source': 'Chrome · x.com',
                    'sourceIsMirror': False, 'latestGuaranteed': False, 'posts': list(self.posts),
                    'fetchedAt': self.fetched, 'loading': False, 'stale': stale,
                    'error': self.error, 'signal': signal}

    def close(self):
        pass
