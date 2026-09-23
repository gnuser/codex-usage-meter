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
    toggle.setAttribute('aria-label', (expanded ? 'Collapse' : 'Expand') + ' model usage');
    toggle.title = expanded ? 'Collapse model usage' : 'Expand model usage';
  };
  toggle.onclick = () => {
    card.dataset.expanded = String(card.dataset.expanded !== 'true');
    update();
  };
  update();
}
async function request(path, signal) {
  const res = await fetch(path, { headers: { Authorization: 'Bearer ' + key }, signal });
  if (!res.ok) throw Error('Read failed');
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
      link.title = 'Open conversation: ' + session.title;
      link.onclick = async (e) => {
        if (nativeControl) {
          e.preventDefault();
          nativeControl.postMessage({ action: 'openThread', thread: session.id });
        } else if (window.pywebview?.api?.open_thread) {
          e.preventDefault();
          try {
            await window.pywebview.api.open_thread(session.id);
          } catch (error) {
            status('Unable to open conversation. Check that Codex is installed.');
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
        if (item && item.id !== session.id) throw Error('Conversation mismatch');
        const turns = item?.turns || [],
          values = turns.map((t) => UsageCharts.metric(t.usage)),
          max = Math.max(0, ...values.map((v) => v ?? 0));
        const summary = node(
          'div',
          'Turn ' +
            fmt(turns.at(-1)?.usage.total_tokens) +
            ' · Total ' +
            fmt(item?.total.total_tokens),
          'session-totals',
        );
        summary.title = 'tokens · ' + (item?.warnings?.join('；') || 'Usage as recorded in local logs');
        card.append(summary);
        const current = turns.at(-1)?.usage || {};
        const io = node(
          'div',
          'In ' + fmt(current.input_tokens) + ' · Out ' + fmt(current.output_tokens),
          'session-io',
        );
        const details = node('div', null, 'model-details');
        details.setAttribute('aria-label', 'Model totals for this conversation');
        details.append(node('div', 'Model totals · tokens', 'model-heading'));
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
        if (!item?.models?.length) details.append(node('div', 'No model usage recorded'));
        const toggle = node('button', '▸', 'model-toggle');
        toggle.type = 'button';
        bindToggle(card, toggle);
        card.append(io, toggle, details);
        const bars = node('div', null, 'mini-bars');
        bars.setAttribute('aria-label', 'Last 10 turns; each conversation scales independently');
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
            'Turn ' +
            t.number +
            ': ' +
            (values[i] == null ? 'Not recorded' : values[i].toLocaleString('en-US') + ' tokens');
          col.setAttribute('aria-label', col.title);
          const fill = node('span', null, 'fill');
          fill.style.height = (max && values[i] != null ? (values[i] / max) * 100 : 0) + '%';
          col.append(fill);
          bars.append(col);
        });
        card.append(bars);
      } catch (error) {
        if (error.name === 'AbortError') throw error;
        card.append(node('div', 'Usage unavailable', 'session-totals'));
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
    $('activityCount').textContent = 'Active ' + sessions.length;
    $('activityCount').title =
      'Active in the last 30 minutes · Updated ' + new Date().toLocaleTimeString('en-US') + ' · Click to refresh';
    status(sessions.length ? '' : 'No recent activity');
  } catch (error) {
    status('Update failed · Retrying');
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
  $('quotaSummary').title = 'Account allowance · Show or hide reset details';
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
} else status('Please reopen the panel');
