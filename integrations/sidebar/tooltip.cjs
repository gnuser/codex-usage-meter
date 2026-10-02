'use strict';
const { countdown } = require('../../web/quota-summary.js');
const date = seconds => Number.isFinite(seconds) && seconds > 0
  ? new Date(seconds * 1000).toLocaleString('en-GB', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : 'Unknown';

function tooltipRows(rings, credits, publicResets, now) {
  const rows = [];
  for (const ring of rings) {
    rows.push({ label: ring.label, value: ring.percent === null ? 'Unavailable' : Math.round(ring.percent) + '% left', tone: ring.tone });
    rows.push({ label: 'Resets in', value: countdown(ring.resetsAt, now), note: date(ring.resetsAt), tone: 'info' });
  }
  rows.push({ label: 'Reset credits', value: credits.expired ? 'Refresh needed' : credits.count === null ? 'Unknown' : String(credits.count), tone: credits.expired ? 'warning' : 'info', group: true });
  if (credits.count > 0) rows.push({ label: 'First expires', value: countdown(credits.expiresAt, now), note: date(credits.expiresAt), tone: 'warning' });
  if (publicResets) {
    rows.push({ label: 'Public reset', value: publicResets.status === 'ok' ? date(publicResets.latestAt) : publicResets.status === 'loading' ? 'Loading…' : 'Unavailable', tone: 'muted', group: true });
    if (publicResets.status === 'ok') {
      if (publicResets.scheduled) {
        const future = Number.isFinite(publicResets.scheduledFor) && publicResets.scheduledFor * 1000 > now;
        rows.push({ label: 'Announced', value: future ? 'In ' + countdown(publicResets.scheduledFor, now) : 'Awaiting confirmation',
          note: Number.isFinite(publicResets.scheduledFor) ? date(publicResets.scheduledFor) : undefined, tone: 'warning' });
      }
      if (publicResets.forecast && publicResets.watchUntil * 1000 > now) {
        rows.push({ label: 'Forecast', value: 'Unconfirmed', note: publicResets.forecast, tone: 'warning' });
        rows.push({ label: 'Watch ends', value: date(publicResets.watchUntil), tone: 'muted' });
      }
    }
    rows.push({ label: 'Source', value: 'codex-resets.com · Community', tone: 'muted', footer: true });
  }
  return rows;
}
module.exports = { tooltipRows };
