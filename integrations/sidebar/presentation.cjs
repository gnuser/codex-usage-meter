'use strict';
const { compact, cacheRatio } = require('../../web/chart-math.js');
const { dailyUsage } = require('./daily.cjs');
const { tooltipRows } = require('./tooltip.cjs');
const { summarize } = require('../../web/quota-summary.js');
const valid = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
function quota(data, now = Date.now()) {
  const all = Array.isArray(data?.windows) ? data.windows : [];
  const own = all.filter(w => w.limitId === 'codex');
  const windows = own.length ? own : all;
  const selected = [windows.find(w => w.windowDurationMins === 300), windows.find(w => w.windowDurationMins === 10080)].filter(Boolean);
  const rings = selected.map(w => {
    const stale = valid(w.resetsAt) && w.resetsAt * 1000 <= now;
    const percent = !stale && valid(w.remainingPercent) && w.remainingPercent <= 100 ? w.remainingPercent : null;
    const label = w.windowDurationMins === 300 ? '5h' : 'Week';
    const reset = valid(w.resetsAt) && w.resetsAt > 0 ? new Date(w.resetsAt * 1000).toLocaleString('en-US') : 'Unknown';
    return { label, percent, resetsAt: valid(w.resetsAt) && w.resetsAt > 0 ? w.resetsAt : null, tone: percent === null ? 'muted' : percent < 10 ? 'danger' : percent <= 50 ? 'warning' : 'normal', title: `${label}: ${percent === null ? 'Unavailable' : Math.round(percent) + '% left'}\nReset: ${reset}` };
  });
  const summary = summarize(data, now);
  const first = rings[0] || { label: 'Week', percent: null, tone: 'muted', title: 'Account allowance unavailable' };
  return { ...first, dailyUsage: dailyUsage(data?.usage, now), tooltipRows: tooltipRows(rings, summary.resetCredits, data?.publicResets, now), resetCredits: summary.resetCredits, title: (rings.length ? rings.map(r => r.title).join('\n') : first.title) + '\n' + summary.details, windowLabel: first.label, mode: rings.length === 2 ? 'dual' : 'single', rings, updatedAt: now, stale: false };
}
function io(usage) {
  const ratio = cacheRatio(usage || {});
  return `In ${compact(usage?.input_tokens)} · Out ${compact(usage?.output_tokens)} · Cache ${ratio === null ? '—' : Math.round(ratio * 100) + '%'}`;
}
function thread(item) {
  const turns = (item?.turns || []).slice(-10);
  const usage = turns.at(-1)?.usage || {};
  const ratio = cacheRatio(usage);
  const cache = ratio === null ? '—' : Math.round(ratio * 100) + '%';
  return { totals: `Turn ${compact(usage.total_tokens)} · Total ${compact(item?.total?.total_tokens)}`, io: io(usage),
    bars: turns.map(t => valid(t.usage?.total_tokens) ? t.usage.total_tokens : null),
    barTexts: turns.map(t => compact(t.usage?.total_tokens)),
    barLabels: turns.map((t, i) => 'Turn ' + (t.number ?? i + 1)),
    models: (item?.models || []).map(m => ({name: m.model, io: io(m.usage)})),
    total: Number.isSafeInteger(item?.total?.total_tokens) && item.total.total_tokens >= 0 ? item.total.total_tokens : null,
    detail: `Total ${compact(item?.total?.total_tokens)} tokens\nTurn: In ${compact(usage.input_tokens)} · Out ${compact(usage.output_tokens)} · Cache ${cache}` };
}
module.exports = { quota, thread, compact };
