// Self-contained renderer passed into the badge bootstrap; no access keys or network.
function createUsagePopover(panel, onClose, onPin, createCharts) {
  const el = (tag, text, cls) => {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  };
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Usage');
  const style = el('style');
  style.textContent = `
    #codex-usage-tooltip { width:320px; max-height:calc(100vh - 16px); overflow:auto; pointer-events:auto; white-space:normal; padding:10px; }
    #codex-usage-tooltip button, #codex-usage-tooltip a { font:inherit; color:inherit; }
    #codex-usage-tooltip button { cursor:pointer; background:none; border:0; padding:3px 6px; border-radius:4px; }
    #codex-usage-tooltip .up-head button { display:inline-flex; align-items:center; justify-content:center; width:24px; height:24px; padding:0; vertical-align:middle; }
    #codex-usage-tooltip .up-head button svg { transition:transform 120ms ease; transform:rotate(35deg); }
    #codex-usage-tooltip .up-head button[aria-pressed="true"] svg { transform:rotate(0deg); fill:color-mix(in srgb,currentColor 15%,transparent); }
    #codex-usage-tooltip button:hover { background:#8882; }
    #codex-usage-tooltip :focus-visible { outline:2px solid var(--tip-info); outline-offset:2px; }
    #codex-usage-tooltip .up-head, #codex-usage-tooltip .up-line { display:flex; align-items:center; justify-content:space-between; gap:8px; }
    #codex-usage-tooltip .up-head { margin-bottom:10px; padding-bottom:8px; border-bottom:1px solid #8883; font-weight:600; font-size:14px; }
    #codex-usage-tooltip .up-sub { color:inherit; opacity:.65; font-size:11px; }
    #codex-usage-tooltip .up-quota { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:3px 8px; align-items:center; }
    #codex-usage-tooltip .up-period { grid-column:1 / -1; font-size:12px; }
    #codex-usage-tooltip .up-remaining { font-size:19px; font-weight:600; line-height:1.25; }
    #codex-usage-tooltip .up-reset { color:var(--tip-info); text-align:right; font-size:12px; }
    #codex-usage-tooltip .up-expiry { color:var(--tip-warning); text-align:right; font-size:11px; }
    #codex-usage-tooltip .up-extra { margin-top:6px; font-size:11px; opacity:.8; }
    #codex-usage-tooltip .up-session-line { display:grid; grid-template-columns:6px minmax(0,1fr) 40px 14px; column-gap:6px; align-items:center; }
    #codex-usage-tooltip .up-dot { width:6px; height:6px; border-radius:50%; background:var(--tip-normal); align-self:start; margin-top:5px; }
    #codex-usage-tooltip .up-session-text { min-width:0; }
    #codex-usage-tooltip .up-session-text .up-link { display:block; }
    #codex-usage-tooltip .up-news-note { margin:4px 0 0 14px; font-size:11px; opacity:.65; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

    #codex-usage-tooltip .up-section { border-top:1px solid #8884; margin-top:9px; padding-top:9px; }
    #codex-usage-tooltip .up-list { max-height:216px; overflow:auto; overscroll-behavior:contain; }
    #codex-usage-tooltip .up-card { box-sizing:border-box; min-height:72px; padding:9px 0; border-bottom:1px solid #8882; }
    #codex-usage-tooltip .up-card:last-child { border:0; }
    #codex-usage-tooltip .up-link { text-decoration:none; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; min-width:0; }
    #codex-usage-tooltip .up-link:hover { text-decoration:underline; }
    #codex-usage-tooltip .up-total { margin:3px 0 1px; opacity:.7; font-size:11px; }
    #codex-usage-tooltip .up-io { white-space:nowrap; font-size:11px; opacity:.8; }
    #codex-usage-tooltip .up-models { margin:7px 0 0; padding-left:8px; border-left:2px solid #8884; }
    #codex-usage-tooltip .up-model { white-space:pre-line; font-size:11px; margin:5px 0; overflow-wrap:anywhere; }
    #codex-usage-tooltip .up-news summary { cursor:pointer; color:var(--tip-warning); list-style:none; display:flex; justify-content:space-between; }
    #codex-usage-tooltip .up-news summary::-webkit-details-marker { display:none; }
    #codex-usage-tooltip .up-news summary::after { content:"⌄"; }
    #codex-usage-tooltip .up-news[open] summary::after { content:"⌃"; }
    #codex-usage-tooltip .up-news-body { white-space:pre-line; font-size:11px; opacity:.8; margin-top:6px; }
    #codex-usage-tooltip [aria-pressed="true"] { color:var(--tip-info); background:#8882; }
  `;
  const header = el('div', null, 'up-head');
  const actions = el('span');
  const pin = el('button');
  pin.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3h6l-1 7 4 4v2H6v-2l4-4-1-7Z"/><path d="M12 16v5"/></svg>';  pin.type = 'button'; pin.title = 'Pin panel'; pin.setAttribute('aria-label', 'Pin panel'); pin.setAttribute('aria-pressed', 'false');
  const close = el('button', '×'); close.type = 'button'; close.setAttribute('aria-label', 'Close usage');
  pin.onclick = onPin; close.onclick = onClose;
  actions.append(pin, close); header.append(el('span', 'Usage'), actions);
  const quota = el('div');
  const charts = createCharts(el);
  const section = el('div', null, 'up-section');
  const listHeading = el('div', null, 'up-line up-sub');
  const count = el('span');
  listHeading.append(el('span', 'ACTIVE · LAST 30 MIN'), count);
  const list = el('div', null, 'up-list');
  section.append(listHeading, list);
  const news = el('details', null, 'up-news up-section');
  const newsTitle = el('summary');
  const newsBody = el('div', null, 'up-news-body');
  const newsNote = el('div', null, 'up-news-note');
  const newsSection = el('div');
  news.append(newsTitle, newsBody);
  newsSection.append(news, newsNote);
  panel.replaceChildren(style, header, quota, charts.daily, section, newsSection, charts.tip);
  const cards = new Map();
  let quotaSignature = '';
  const validID = id => /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id);
  function cardFor(item) {
    const card = el('article', null, 'up-card');
    const line = el('div', null, 'up-session-line');
    const link = el('a', item.title, 'up-link');
    link.href = 'codex://threads/' + item.id;
    link.title = item.title;
    const bars = el('span', null, 'up-bars'); bars.setAttribute('aria-label', 'Recent turn usage');
    const toggle = el('button', '▸'); toggle.type = 'button'; toggle.setAttribute('aria-label', 'Model usage'); toggle.setAttribute('aria-expanded', 'false');
    const models = el('div', null, 'up-models'); models.hidden = true;
    toggle.onclick = () => { models.hidden = !models.hidden; toggle.textContent = models.hidden ? '▸' : '▾'; toggle.setAttribute('aria-expanded', String(!models.hidden)); };
    const total = el('div', null, 'up-total'), io = el('div', null, 'up-io');
    const text = el('div', null, 'up-session-text');
    text.append(link, total, io);
    line.append(el('span', null, 'up-dot'), text, bars, toggle); card.append(line, models);
    return {card, link, bars, total, io, models, signature: ''};
  }
  function update(value) {
    const rows = value.stale ? [{label:'Allowance', value:'Reconnecting…', tone:'muted'}] : (value.tooltipRows || []);
    const account = rows.filter(r => !['Public reset','Forecast','Watch ends','Source','Announced'].includes(r.label));
    const signature = JSON.stringify(account);
    if (signature !== quotaSignature) {
      quotaSignature = signature; quota.replaceChildren();
      const weekIndex = account.findIndex(r => r.label === 'Week');
      const primaryIndex = weekIndex >= 0 ? weekIndex : account.findIndex(r => ['5h', 'Allowance'].includes(r.label));
      const primary = account[primaryIndex];
      const reset = account[primaryIndex + 1]?.label === 'Resets in' ? account[primaryIndex + 1] : null;
      const credits = account.find(r => r.label === 'Reset credits');
      const expiry = account.find(r => r.label === 'First expires');
      const grid = el('div', null, 'up-quota');
      const remaining = el('span', primary?.value || 'Unavailable', 'up-remaining');
      const tone = ['normal', 'warning', 'danger'].includes(primary?.tone) ? primary.tone : 'info';
      remaining.style.color = `var(--tip-${tone})`;
      const resetText = el('span', reset ? 'Reset in ' + reset.value : 'Reset unknown', 'up-reset');
      if (reset?.note) resetText.title = reset.note;
      const creditText = credits?.value && /^\d+$/.test(credits.value) ? credits.value + ' reset credits' : 'Credits · ' + (credits?.value || 'Unknown');
      const expiryText = el('span', expiry ? (expiry.value === 'Expired' ? 'Credit expired' : 'Expires in ' + expiry.value) : '', 'up-expiry');
      if (expiry?.note) expiryText.title = expiry.note;
      grid.append(el('span', primary?.label || 'Week', 'up-period'), remaining, resetText,
        el('span', creditText, 'up-sub'), expiryText);
      quota.append(grid);
      // Keep a second allowance visible without duplicating the weekly summary.
      account.forEach((row, i) => {
        if (['5h', 'Week'].includes(row.label) && i !== primaryIndex) {
          const otherReset = account[i + 1];
          quota.append(el('div', row.label + ' · ' + row.value + (otherReset?.label === 'Resets in' ? ' · Reset in ' + otherReset.value : ''), 'up-extra'));
        }
      });
    }
    charts.update(value.stale ? null : value.dailyUsage);
    const active = value.activeSessions;
    const fresh = active && Date.now() - active.checkedAt < 30000;
    const items = fresh && active.ok ? active.items.filter(s => validID(s.id) && s.updatedAt * 1000 >= Date.now() - 1800000) : [];
    count.textContent = String(items.length) + ' chats';
    const ids = new Set(items.map(s => s.id));
    for (const [id, record] of cards) if (!ids.has(id)) { record.card.remove(); cards.delete(id); charts.hide(); }
    if (!items.length) {
      list.textContent = !active ? 'Loading chats…' : !fresh || !active.ok ? 'Chats unavailable · Retrying' : 'No recent activity';
    } else {
      if (!cards.size) list.replaceChildren();
      items.forEach((item, index) => {
        let record = cards.get(item.id);
        if (!record) { record = cardFor(item); cards.set(item.id, record); }
        if (list.children[index] !== record.card) list.insertBefore(record.card, list.children[index] || null);
        const next = JSON.stringify(item);
        if (next === record.signature) return;
        record.signature = next;
        record.link.textContent = item.title; record.link.title = item.title;
        record.total.textContent = item.usage?.totals || 'Usage unavailable';
        record.io.textContent = item.usage?.io || 'In — · Out — · Cache —';
        charts.renderTurns(record.bars, item.usage);
        record.models.replaceChildren(...(item.usage?.models || []).map(m => el('div', m.name + '\n' + m.io, 'up-model')));
        if (!record.models.children.length) record.models.textContent = 'No model data';
      });
    }
    const publicRows = rows.filter(r => ['Public reset','Forecast','Watch ends','Source','Announced'].includes(r.label));
    newsSection.hidden = !publicRows.length;
    const forecast = publicRows.find(r => r.label === 'Forecast');
    const latest = publicRows.find(r => r.label === 'Public reset');
    newsTitle.textContent = forecast ? 'Reset forecast · Unconfirmed' : 'Public reset · ' + (latest?.value || 'Unknown');
    newsNote.textContent = forecast?.note || '';
    newsNote.title = forecast?.note || '';
    newsNote.hidden = !forecast?.note;
    newsBody.textContent = publicRows.map(r => r.label + ': ' + r.value + (r.note ? '\n' + r.note : '')).join('\n');
  }
  return { update, hideTips: charts.hide, setPinned(value) { pin.setAttribute('aria-pressed', String(value)); pin.title = value ? 'Unpin panel' : 'Pin panel'; pin.setAttribute('aria-label', pin.title); } };
}
