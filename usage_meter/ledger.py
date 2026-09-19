"""Read local usage and, for the selected conversation, user/assistant messages."""
import hashlib
from contextlib import closing
import json
import math
import os
import re
import sqlite3
import threading
import time
from pathlib import Path

FIELDS = ('input_tokens', 'cached_input_tokens', 'cache_write_input_tokens',
          'output_tokens', 'reasoning_output_tokens', 'total_tokens')
CAMEL = ('inputTokens', 'cachedInputTokens', 'cacheWriteInputTokens',
         'outputTokens', 'reasoningOutputTokens', 'totalTokens')


def number(value):
    return value if type(value) is int and value >= 0 else None


def usage(value):
    value = value if isinstance(value, dict) else {}
    return {k: number(value.get(k, value.get(c))) for k, c in zip(FIELDS, CAMEL)}


def add(rows):
    rows = list(rows)
    return {k: sum(r[k] for r in rows) if rows and all(r.get(k) is not None for r in rows) else None
            for k in FIELDS}


def subtract(a, b):
    return {k: a[k] - b[k] if a[k] is not None and b[k] is not None and a[k] >= b[k] else None
            for k in FIELDS}


def fingerprint(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def model_breakdown(events):
    groups = {}
    for event in events:
        # A gap may cover several models; do not assign the whole gap to the last model.
        name = event.get('model') if event.get('quality') == 'last_reported_call' else None
        name = name or '模型未知 / 区间无法归因'
        groups.setdefault(name, []).append(event['usage'])
    return [{'model': name, 'usage': add(rows), 'records': len(rows)} for name, rows in groups.items()]


def message_text(payload):
    parts = []
    for item in payload.get('content', []):
        if not isinstance(item, dict):
            continue
        if item.get('type') in ('input_text', 'output_text', 'text') and isinstance(item.get('text'), str):
            parts.append(item['text'])
        elif item.get('type') in ('input_image', 'image'):
            parts.append('[图片附件：本地日志未提供可展示正文]')
    return '\n\n'.join(parts)


def preview(text):
    if '## My request:' in text:
        text = text.rsplit('## My request:', 1)[1]
    return ' '.join(text.split())[:120]


def read_titles(home, thread_ids=None):
    titles = {}
    index = home / 'session_index.jsonl'
    try:
        with index.open(encoding='utf-8') as stream:
            for line in stream:
                try:
                    row = json.loads(line)
                    if isinstance(row, dict) and row.get('id') and row.get('thread_name') and (thread_ids is None or row['id'] in thread_ids):
                        titles[row['id']] = row['thread_name']
                except ValueError:
                    continue
    except (OSError, UnicodeError):
        pass
    for path in sorted(home.glob('state_*.sqlite')):
        try:
            with closing(sqlite3.connect(path.as_uri() + '?mode=ro', uri=True, timeout=.2)) as db:
                columns = {r[1] for r in db.execute('PRAGMA table_info(threads)')}
                if not {'id', 'title'}.issubset(columns):
                    continue
                query = "SELECT id, COALESCE(NULLIF(name,''),title) FROM threads" if 'name' in columns else 'SELECT id,title FROM threads'
                params = list(thread_ids) if thread_ids is not None else []
                if thread_ids is not None:
                    if not params:
                        continue
                    query += ' WHERE id IN (' + ','.join('?' for _ in params) + ')'
                for key, title in db.execute(query, params):
                    if title:
                        titles[key] = title
        except sqlite3.Error:
            continue
    return titles


def parse(path, include_messages=False):
    result = {'id': path.stem, 'source': str(path), 'total': usage(None), 'events': [],
              'turns': [], 'warnings': [], 'updatedAt': '', 'localLimits': None, 'parentId': None,
              'title': '', 'titleSource': 'first_message_preview'}
    previous, turn, model, previous_turn = None, None, None, None
    seen_totals = set()
    turn_order = {}
    messages, fallback = {}, {}
    pending = []
    try:
        with path.open(encoding='utf-8') as stream:
            for line_no, line in enumerate(stream, 1):
                # Reading while Codex appends: retry incomplete tail on next scan.
                if not line.endswith('\n'):
                    result['warnings'].append('文件末尾尚未写完，等待下次刷新')
                    break
                try:
                    row = json.loads(line)
                    if not isinstance(row, dict):
                        raise ValueError()
                    payload = row.get('payload') or {}
                    if not isinstance(payload, dict):
                        raise ValueError()
                except ValueError:
                    result['warnings'].append(f'第 {line_no} 行格式异常，已跳过')
                    continue
                kind = row.get('type')
                stamp = row.get('timestamp') if isinstance(row.get('timestamp'), str) else ''
                if kind == 'session_meta':
                    result['id'] = str(payload.get('id') or payload.get('session_id') or result['id'])
                    result['parentId'] = payload.get('forked_from_id') or payload.get('parent_thread_id')
                if kind == 'turn_context':
                    turn = payload.get('turn_id')
                    model = payload.get('model')
                    if isinstance(turn, str):
                        turn_order.setdefault(turn, [])
                if kind == 'event_msg' and payload.get('type') == 'task_started':
                    turn = payload.get('turn_id') or turn
                    if isinstance(turn, str):
                        turn_order.setdefault(turn, [])
                if isinstance(turn, str) and pending:
                    for msg in pending:
                        destination = messages if msg['source'] == 'response_item' else fallback
                        destination.setdefault(turn, []).append(msg)
                    pending = []
                role, text, origin = None, '', None
                if kind == 'response_item' and payload.get('type') == 'message' and payload.get('role') in ('user', 'assistant'):
                    role, text, origin = payload['role'], message_text(payload), 'response_item'
                elif kind == 'event_msg' and payload.get('type') in ('user_message', 'agent_message'):
                    role = 'user' if payload['type'] == 'user_message' else 'assistant'
                    text, origin = payload.get('message', ''), 'event_msg'
                if role and isinstance(text, str) and text:
                    if role == 'user' and not result['title']:
                        result['title'] = preview(text)
                    if include_messages:
                        msg = {'role': role, 'text': text, 'timestamp': stamp, 'line': line_no,
                               'phase': payload.get('phase'), 'source': origin, 'preview': preview(text)}
                        if isinstance(turn, str):
                            destination = messages if origin == 'response_item' else fallback
                            destination.setdefault(turn, []).append(msg)
                        else:
                            pending.append(msg)
                if kind != 'event_msg' or payload.get('type') != 'token_count':
                    continue
                if isinstance(payload.get('rate_limits'), dict):
                    result['localLimits'] = {'source': 'local_log_snapshot', 'observedAt': stamp,
                                             'snapshot': payload['rate_limits']}
                info = payload.get('info')
                if not isinstance(info, dict):
                    continue
                total, last = usage(info.get('total_token_usage')), usage(info.get('last_token_usage'))
                if total['total_tokens'] is None:
                    result['warnings'].append(f'第 {line_no} 行缺少累计 token，无法可靠去重，未计入')
                    continue
                result['total'], result['updatedAt'] = total, stamp
                if total['total_tokens'] == 0:
                    previous, previous_turn = total, turn
                    continue
                sig = fingerprint(total)
                if sig in seen_totals:
                    previous = total
                    continue
                seen_totals.add(sig)
                quality = 'last_reported_call'
                if previous is None:
                    delta = last
                    if total != last:
                        result['warnings'].append('首条累计值含先前用量；仅最后一次调用计入可归因小计')
                elif total['total_tokens'] < previous['total_tokens']:
                    result['warnings'].append('累计计数回退，可能恢复/回滚；该区间未计入可归因小计')
                    previous, previous_turn = total, turn
                    continue
                else:
                    delta = subtract(total, previous)
                    if delta != last:
                        quality = 'interval_delta'
                        result['warnings'].append('累计差额与 last 不同：按区间显示，不冒充单次模型调用')
                attribution = turn
                if quality == 'interval_delta' and previous_turn != turn:
                    attribution = None
                    result['warnings'].append('跨轮次区间无法精确归因：只计入本机小计，不计入单轮')
                previous, previous_turn = total, turn
                if delta['total_tokens'] is None:
                    continue
                event = {'key': fingerprint([stamp, total, last]), 'timestamp': stamp,
                         'turnId': attribution, 'model': model, 'usage': delta, 'lastReported': last,
                         'quality': quality, 'line': line_no}
                result['events'].append(event)
                if isinstance(attribution, str):
                    turn_order.setdefault(attribution, []).append(event)
        result['turns'] = [{'id': key, 'usage': add(e['usage'] for e in events),
                            'records': len(events), 'models': model_breakdown(events)} for key, events in turn_order.items()]
        if include_messages:
            for item in result['turns']:
                key = item['id']
                primary = messages.get(key, [])
                roles = {m['role'] for m in primary}
                combined = primary + [m for m in fallback.get(key, []) if m['role'] not in roles]
                item['messages'] = sorted(combined, key=lambda m: m['line'])
                users = [m for m in item['messages'] if m['role'] == 'user']
                explicit = next((m for m in users if '## My request:' in m['text']), None)
                first_reply = next((m['line'] for m in item['messages'] if m['role'] == 'assistant'), float('inf'))
                leading = [m for m in users if m['line'] < first_reply]
                request = explicit or (leading[-1] if leading else users[0] if users else None)
                item['preview'] = preview(request['text']) if request else '未记录用户消息'
            result['unattributedMessages'] = pending
    except (OSError, UnicodeError) as exc:
        result['warnings'].append(f'日志不可读：{type(exc).__name__}')
    result['warnings'] = list(dict.fromkeys(result['warnings']))
    result['observedUsage'] = add(e['usage'] for e in result['events'])
    result['models'] = model_breakdown(result['events'])
    return result


class Ledger:
    def __init__(self, home=None):
        self.home = Path(home or os.environ.get('CODEX_HOME') or Path.home() / '.codex').expanduser()
        self.cache = {}
        self.lock = threading.Lock()

    def catalog(self, limit=10):
        """List names/IDs from standard rollout paths and title metadata, never log bodies."""
        if type(limit) is not int or not 1 <= limit <= 100:
            raise ValueError('limit must be between 1 and 100')
        found = {}
        for folder in ('sessions', 'archived_sessions'):
            for path in (self.home / folder).rglob('*.jsonl'):
                match = re.search(r'([0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12})$', path.stem)
                if not match or path.is_symlink():
                    continue
                try:
                    identifier, stamp = match.group(1), path.stat().st_mtime
                    found[identifier] = max(stamp, found.get(identifier, 0))
                except OSError:
                    continue
        # Exclude internal reviewers/subagents before titles enter the UI.
        for database in sorted(self.home.resolve().glob('state_*.sqlite')):
            try:
                with closing(sqlite3.connect(database.as_uri() + '?mode=ro', uri=True, timeout=.2)) as db:
                    columns = {r[1] for r in db.execute('PRAGMA table_info(threads)')}
                    if {'id', 'source'}.issubset(columns):
                        for identifier, source in db.execute('SELECT id,source FROM threads'):
                            if source not in ('cli', 'vscode', 'app-server', 'appServer', 'desktop'):
                                found.pop(identifier, None)
            except sqlite3.Error:
                continue
        ordered = sorted(found, key=found.get, reverse=True)[:limit]
        titles = read_titles(self.home.resolve(), set(ordered)) if ordered else {}
        return {'sessions': [{'id': key, 'title': ' '.join((titles.get(key) or '未命名会话').split())[:100], 'updatedAt': found[key]} for key in ordered],
                'hasMore': len(found) > limit}

    def snapshot(self, thread_id=None, limit=1, *, exact=False, include_messages=True):
        if type(limit) is not int or not 1 <= limit <= 1000:
            raise ValueError('limit must be an integer between 1 and 1000')
        if exact and (not isinstance(thread_id, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,128}', thread_id)):
            raise ValueError('Exact selection requires a valid thread id')
        with self.lock:
            sessions, errors, candidates = {}, [], []
            # Enumerate only filenames/stat metadata; never open unloaded logs.
            for folder in ('sessions', 'archived_sessions'):
                root = self.home / folder
                if not root.exists():
                    continue
                for path in root.rglob('*.jsonl'):
                    if exact and path.stem != thread_id and not path.stem.endswith('-' + thread_id):
                        continue
                    if path.is_symlink():
                        continue
                    try:
                        st = path.stat()
                        candidates.append((st.st_mtime_ns, str(path), path, (st.st_ino, st.st_size, st.st_mtime_ns)))
                    except OSError:
                        errors.append('部分日志在扫描时移动或不可读')
            candidates.sort(reverse=True)
            # Deduplicate standard rollout filenames before opening archive copies.
            files, ids = [], set()
            for candidate in candidates:
                match = re.search(r'([0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12})$', candidate[2].stem)
                identifier = match.group(1) if match else str(candidate[2])
                if identifier not in ids:
                    ids.add(identifier)
                    files.append(candidate)
            loaded_paths = set()
            consumed = 0
            for _, _, path, sig in files:
                if len(sessions) >= limit:
                    break
                consumed += 1
                loaded_paths.add(path)
                if path not in self.cache or self.cache[path][0] != sig:
                    self.cache[path] = sig, parse(path)
                # Refresh LRU order so alternating panel requests reuse parsed logs.
                cached = self.cache.pop(path)
                self.cache[path] = cached
                item = cached[1]
                if not exact or item['id'] == thread_id:
                    sessions.setdefault(item['id'], item)
            # Retain a bounded working set across exact per-session requests.
            capacity = max(32, len(loaded_paths))
            self.cache = dict(list(self.cache.items())[-capacity:])
            ordered = list(sessions.values())
            unique = {}
            for session in ordered:
                for event in session['events']:
                    unique.setdefault(event['key'], event['usage'])
            # Auto-select latest only for an unselected dashboard, never label it current task.
            selected_id = thread_id or (ordered[0]['id'] if ordered else None)
            selected = sessions.get(selected_id)
            titles = read_titles(self.home.resolve(), set(sessions)) if sessions else {}
            ordered = [dict(s, title=titles.get(s['id']) or s['title'] or '未命名会话',
                            titleSource='local_metadata' if s['id'] in titles else 'first_message_preview') for s in ordered]
            if selected:
                selected = parse(Path(selected['source']), include_messages=True) if include_messages else dict(selected)
                selected['title'] = titles.get(selected_id) or selected['title'] or '未命名会话'
                selected['titleSource'] = 'local_metadata' if selected_id in titles else 'first_message_preview'
            return {'generatedAt': time.time(), 'scope': '仅已加载会话；非全部本机或账号用量',
                    'selectedId': selected_id, 'selected': selected,
                    'sessions': [{k: v for k, v in s.items() if k not in ('events', 'turns')} for s in ordered],
                    'observedTotal': add(unique.values()), 'observedRecords': len(unique),
                    'errors': errors, 'files': len(loaded_paths),
                    'pagination': {'limit': limit, 'loaded': len(ordered), 'hasMore': consumed < len(files),
                                   'nextLimit': min(limit + 3, 1000)},
                    'coverage': '仅统计已加载会话。未加载日志不读取正文、不参与累计；缺失用量不补猜。'}


def normalize_limits(response):
    if not isinstance(response, dict):
        return []
    buckets = response.get('rateLimitsByLimitId')
    if not isinstance(buckets, dict) or not buckets:
        value = response.get('rateLimits', response)
        buckets = {value.get('limitId') or value.get('limit_id') or 'unknown': value} if isinstance(value, dict) else {}
    output = []
    for key, value in buckets.items():
        if not isinstance(value, dict):
            continue
        for window in ('primary', 'secondary'):
            w = value.get(window)
            if not isinstance(w, dict):
                continue
            used = w.get('usedPercent', w.get('used_percent'))
            valid = type(used) in (int, float) and math.isfinite(used)
            output.append({'limitId': key, 'window': window, 'usedPercent': used if valid else None,
                           'remainingPercent': max(0, min(100, 100-used)) if valid else None,
                           'windowDurationMins': w.get('windowDurationMins', w.get('window_minutes')),
                           'resetsAt': w.get('resetsAt', w.get('resets_at'))})
    return output
