'use strict';
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.hash.slice(1)),
  key = params.get('key');
const nativeControl = window.webkit?.messageHandlers?.usageControl;
const node = (tag, text, cls) => {
  const el = document.createElement(tag);
  if (text != null) el.textContent = text;
  if (cls) el.className = cls;
  return el;
};
const fmt = UsageCharts.compact;
let busy = false,
  timer,
  quotaBusy = false,
  lastQuotaAttempt = 0,
  quotaData = null;
function status(text) {
  $('status').textContent = text;
  $('status').hidden = !text;
}
function bindToggle(card, toggle) {
  const update = () => {
    const expanded = card.dataset.expanded === 'true';
    toggle.textContent = expanded ? '▾' : '▸';
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.setAttribute('aria-label', (expanded ? '收起' : '展开') + '模型用量');
    toggle.title = expanded ? '收起模型用量' : '展开模型用量';
  };
  toggle.onclick = () => {
    card.dataset.expanded = String(card.dataset.expanded !== 'true');
    update();
  };
  update();
}
async function request(path, signal) {
  const res = await fetch(path, { headers: { Authorization: 'Bearer ' + key }, signal });
  if (!res.ok) throw Error('读取失败');
  return res.json();
}
async function refresh(force = false) {
  if (busy || !key || (!force && document.hidden)) return;
  renderResetSummary();
  if (Date.now() - lastQuotaAttempt >= 300000) refreshQuota();
  busy = true;
  clearTimeout(timer);
  const controller = new AbortController(),
    timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const data = await request('/api/threads?limit=100', controller.signal);
    const sessions = data.sessions.filter((s) => s.updatedAt * 1000 >= Date.now() - 30 * 60 * 1000);
    const cards = [];
    for (const session of sessions) {
      const card = node('article', null, 'session-card');
      card.dataset.session = session.id;
      const link = node('a', session.title, 'session-title');
      link.href = 'codex://threads/' + encodeURIComponent(session.id);
      link.title = '打开对话：' + session.title;
      link.onclick = async (e) => {
        if (nativeControl) {
          e.preventDefault();
          nativeControl.postMessage({ action: 'openThread', thread: session.id });
        } else if (window.pywebview?.api?.open_thread) {
          e.preventDefault();
          try {
            await window.pywebview.api.open_thread(session.id);
          } catch (error) {
            status('无法打开对话，请确认已安装 Codex');
          }
        }
      };
      card.append(link);
      try {
        const payload = await request(
            '/api/panel?' + new URLSearchParams({ thread: session.id }),
            controller.signal,
          ),
          item = payload.selected;
        if (item && item.id !== session.id) throw Error('会话不匹配');
        const turns = item?.turns || [],
          values = turns.map((t) => UsageCharts.metric(t.usage)),
          max = Math.max(0, ...values.map((v) => v ?? 0));
        const summary = node(
          'div',
          '本轮 ' +
            fmt(turns.at(-1)?.usage.total_tokens) +
            ' · 累计 ' +
            fmt(item?.total.total_tokens),
          'session-totals',
        );
        summary.title = 'tokens · ' + (item?.warnings?.join('；') || '用量以日志记录为准');
        card.append(summary);
        const current = turns.at(-1)?.usage || {};
        const io = node(
          'div',
          '本轮 输入 ' + fmt(current.input_tokens) + ' · 输出 ' + fmt(current.output_tokens),
          'session-io',
        );
        const details = node('div', null, 'model-details');
        details.setAttribute('aria-label', '本会话各模型累计用量');
        details.append(node('div', '模型累计 · tokens', 'model-heading'));
        for (const m of item?.models || []) {
          const row = node('div', null, 'model-row');
          row.append(
            node('div', m.model, 'model-name'),
            node(
              'div',
              'input ' + fmt(m.usage?.input_tokens) + ' · output ' + fmt(m.usage?.output_tokens),
            ),
          );
          details.append(row);
        }
        if (!item?.models?.length) details.append(node('div', '暂无模型用量记录'));
        const toggle = node('button', '▸', 'model-toggle');
        toggle.type = 'button';
        bindToggle(card, toggle);
        card.append(io, toggle, details);
        const bars = node('div', null, 'mini-bars');
        bars.setAttribute('aria-label', '最近 10 轮用量，各会话独立缩放');
        turns.forEach((t, i) => {
          const col = node(
            'button',
            null,
            'column' +
              (i === turns.length - 1 ? ' latest' : '') +
              (values[i] == null ? ' unknown' : ''),
          );
          col.type = 'button';
          col.title =
            '第 ' +
            t.number +
            ' 轮：' +
            (values[i] == null ? '未记录' : values[i].toLocaleString('zh-CN') + ' tokens');
          col.setAttribute('aria-label', col.title);
          const fill = node('span', null, 'fill');
          fill.style.height = (max && values[i] != null ? (values[i] / max) * 100 : 0) + '%';
          col.append(fill);
          bars.append(col);
        });
        card.append(bars);
      } catch (error) {
        if (error.name === 'AbortError') throw error;
        card.append(node('div', '用量暂不可用', 'session-totals'));
      }
      cards.push(card);
    }
    // Retain each article and its expansion state across polling.
    const existing = new Map(
      Array.from($('sessionCards').children).map((c) => [c.dataset.session, c]),
    );
    const retained = cards.map((card) => {
      const old = existing.get(card.dataset.session);
      if (!old) return card;
      const previousToggle = Array.from(old.children).find((n) => n.className === 'model-toggle');
      const children = Array.from(card.children).map((n) =>
        n.className === 'model-toggle' && previousToggle ? previousToggle : n,
      );
      // Insert replacements around the existing toggle; never detach the focused button.
      for (let i = 0; i < children.length; i++) {
        const current = old.children[i];
        if (current === children[i]) continue;
        if (current && !children.includes(current)) old.replaceChild(children[i], current);
        else old.insertBefore(children[i], current || null);
      }
      while (old.children.length > children.length) old.lastElementChild.remove();
      const toggle = previousToggle || children.find((n) => n.className === 'model-toggle');
      if (toggle) bindToggle(old, toggle);
      return old;
    });
    if (
      retained.length !== $('sessionCards').children.length ||
      retained.some((c, i) => c !== $('sessionCards').children[i])
    )
      $('sessionCards').replaceChildren(...retained);
    $('activityCount').textContent = '活跃 ' + sessions.length;
    $('activityCount').title =
      '最近 30 分钟活跃会话 · 更新于 ' + new Date().toLocaleTimeString('zh-CN') + ' · 点击刷新';
    status(sessions.length ? '' : '暂无活跃会话');
  } catch (error) {
    status('更新失败 · 将重试');
  } finally {
    clearTimeout(timeout);
    busy = false;
    if (!document.hidden) timer = setTimeout(() => refresh(), 5000);
  }
}
function renderResetSummary() {
  const view = QuotaSummary.summarize(quotaData);
  $('resetSummary').textContent = view.details;
  $('resetStatus').textContent = view.status;
  $('quotaSummary').textContent = view.summary;
  $('quotaSummary').title = '账号共享额度 · 点击展开/收起重置详情';
  $('resetSummary').hidden = !window.showResetDetails;
  $('quotaSummary').setAttribute('aria-expanded', String(!!window.showResetDetails));
  if (document.title === view.title) return;
  document.title = view.title;
  if (nativeControl) nativeControl.postMessage({ action: 'setTitle', title: view.title });
  else if (window.pywebview?.api?.set_title)
    window.pywebview.api.set_title(view.title).catch(() => {});
}
async function refreshQuota() {
  if (quotaBusy || !key) return;
  quotaBusy = true;
  lastQuotaAttempt = Date.now();
  const controller = new AbortController(),
    timeout = setTimeout(() => controller.abort(), 70000);
  try {
    const data = await request('/api/account', controller.signal);
    quotaData = data;
    renderResetSummary();
  } catch (error) {
    quotaData = null;
    renderResetSummary();
  } finally {
    clearTimeout(timeout);
    quotaBusy = false;
  }
}
$('quotaSummary').onclick = () => {
  window.showResetDetails = !window.showResetDetails;
  renderResetSummary();
};
window.refreshUsage = async () => {
  window.refreshTibo?.();
  await refresh(true);
};
$('activityCount').onclick = () => window.refreshUsage();
window.addEventListener('pywebviewready', () => {
  document.title = '';
  renderResetSummary();
});
window.addEventListener('focus', () => window.refreshUsage());
window.addEventListener('pageshow', () => window.refreshUsage());
document.addEventListener('visibilitychange', () => {
  clearTimeout(timer);
  if (!document.hidden) refresh();
});
window.addEventListener('pagehide', () => clearTimeout(timer));
if (key) {
  refresh();
  refreshQuota();
} else status('请重新打开面板');
