/* Shared, side-effect-free presentation of automatic limits and manual reset credits. */
(function (root) {
  'use strict';
  const timestamp = (value) => Number.isFinite(value) && value > 0;
  const percentage = (value) => Number.isFinite(value) && value >= 0 && value <= 100;

  function countdown(until, now = Date.now()) {
    if (!timestamp(until)) return '—';
    const minutes = Math.ceil((until * 1000 - now) / 60000);
    if (minutes <= 0) return 'Expired';
    if (minutes >= 1440)
      return Math.floor(minutes / 1440) + 'd ' + Math.floor((minutes % 1440) / 60) + 'h';
    if (minutes >= 60) return Math.floor(minutes / 60) + 'h ' + (minutes % 60) + 'm';
    return minutes + 'm';
  }

  function publicResetDetails(value, now) {
    if (!value) return '';
    const heading = '\nPublic resets · codex-resets.com (community)';
    if (value.status !== 'ok') return heading + '\n' + (value.status === 'loading' ? 'Loading announcements…' : 'Announcements unavailable');
    const date = t => new Date(t * 1000).toLocaleString('en-US');
    let text = heading + '\nLatest announcement: ' + (timestamp(value.latestAt) ? date(value.latestAt) : 'Unknown');
    if (value.scheduled) text += '\nAnnounced reset: ' + (timestamp(value.scheduledFor) && value.scheduledFor * 1000 > now
      ? date(value.scheduledFor) + ' (in ' + countdown(value.scheduledFor, now) + ')' : 'awaiting execution confirmation');
    if (timestamp(value.watchUntil) && value.watchUntil * 1000 > now && value.forecast)
      text += '\nForecast (unconfirmed): ' + value.forecast + '\nWatch expires: ' + date(value.watchUntil);
    return text;
  }

  function summarize(data, now = Date.now()) {
    const windows = Array.isArray(data?.windows) ? data.windows : [];
    const credits = data?.limits?.rateLimitResetCredits;
    const count =
      Number.isInteger(credits?.availableCount) && credits.availableCount >= 0
        ? credits.availableCount
        : null;
    const available = Array.isArray(credits?.credits)
      ? credits.credits.filter((c) => c.status === 'available')
      : [];
    const dates = available.map((c) => c.expiresAt).filter(timestamp);
    const earliest = dates.length ? Math.min(...dates) : null;
    const expired = dates.some((t) => t * 1000 <= now);
    const resets = windows.map((w) => w.resetsAt).filter(timestamp);
    const next = resets.length ? Math.min(...resets) : null;
    const date = (t) =>
      new Date(t * 1000).toLocaleString('en-US', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    const remaining = (w) =>
      timestamp(w.resetsAt) && w.resetsAt * 1000 <= now
        ? 'Refresh needed'
        : percentage(w.remainingPercent)
          ? w.remainingPercent.toFixed(0) + '%'
          : '—';
    const label = (w) => {
      const m = w.windowDurationMins;
      if (m === 10080) return 'Week';
      if (!Number.isFinite(m) || m <= 0) return 'Allowance';
      return (
        (m % 1440 === 0 ? m / 1440 + 'd' : m % 60 === 0 ? m / 60 + 'h' : m + 'm') + ' allowance'
      );
    };
    // Prefer the Codex bucket when an account has more than one weekly quota.
    const weekly = windows.filter((w) => w.windowDurationMins === 10080);
    const week = weekly.find((w) => w.limitId === 'codex') || weekly[0];
    const weekReset = timestamp(week?.resetsAt) ? week.resetsAt : null;
    const weekValue = week ? remaining(week) : '—';
    const countText = count == null ? '—' : expired ? 'Refresh needed' : String(count);
    const title =
      'Week ' +
      (weekValue.endsWith('%') ? Math.round(week.remainingPercent) + '%' : weekValue) +
      ' · ' +
      (weekReset == null
        ? 'Reset unknown'
        : weekReset * 1000 <= now
          ? 'Reset pending'
          : 'Reset ' + countdown(weekReset, now).trim());
    const status =
      'Resets ' +
      countText +
      (count > 0
        ? ' · Credit ' +
          (earliest == null
            ? 'expiry unknown'
            : (earliest * 1000 > now ? 'expires in ' : '') + countdown(earliest, now).trim())
        : '');
    const details =
      (next == null
        ? 'Next automatic reset: unknown'
        : 'Next automatic reset: ' +
          date(next) +
          ' (' +
          (next * 1000 <= now ? 'Refresh needed' : 'in ' + countdown(next, now)) +
          ')') +
      '\nAvailable resets: ' +
      countText +
      (count > 0
        ? '\nNext credit expiry: ' +
          (earliest == null ? 'Unknown' : date(earliest) + ' (' + countdown(earliest, now) + ')')
        : '');
    return {
      resetCredits: { count, expiresAt: count === 0 ? null : earliest, expired: count !== 0 && expired },
      title,
      status,
      details: details + publicResetDetails(data?.publicResets, now),
      summary: windows.length
        ? windows.map((w) => label(w) + ' left ' + remaining(w)).join(' / ')
        : 'Left —',
    };
  }
  const api = { countdown, summarize };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.QuotaSummary = api;
})(globalThis);
