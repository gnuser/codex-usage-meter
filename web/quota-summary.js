/* Shared, side-effect-free presentation of automatic limits and manual reset credits. */
(function (root) {
  'use strict';
  const timestamp = (value) => Number.isFinite(value) && value > 0;
  const percentage = (value) => Number.isFinite(value) && value >= 0 && value <= 100;

  function countdown(until, now = Date.now()) {
    if (!timestamp(until)) return '—';
    const minutes = Math.ceil((until * 1000 - now) / 60000);
    if (minutes <= 0) return '已到期';
    if (minutes >= 1440)
      return Math.floor(minutes / 1440) + '天' + Math.floor((minutes % 1440) / 60) + '时';
    if (minutes >= 60) return Math.floor(minutes / 60) + '时' + (minutes % 60) + '分';
    return minutes + '分';
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
      new Date(t * 1000).toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    const remaining = (w) =>
      timestamp(w.resetsAt) && w.resetsAt * 1000 <= now
        ? '待刷新'
        : percentage(w.remainingPercent)
          ? w.remainingPercent.toFixed(2) + '%'
          : '—';
    const label = (w) => {
      const m = w.windowDurationMins;
      if (m === 10080) return '周额度';
      if (!Number.isFinite(m) || m <= 0) return '额度';
      return (
        (m % 1440 === 0 ? m / 1440 + '天' : m % 60 === 0 ? m / 60 + 'h' : m + 'm') + '周期额度'
      );
    };
    // Prefer the Codex bucket when an account has more than one weekly quota.
    const weekly = windows.filter((w) => w.windowDurationMins === 10080);
    const week = weekly.find((w) => w.limitId === 'codex') || weekly[0];
    const weekReset = timestamp(week?.resetsAt) ? week.resetsAt : null;
    const weekValue = week ? remaining(week) : '—';
    const countText = count == null ? '—' : expired ? '待刷新' : count + '次';
    const title =
      '周' +
      (weekValue.endsWith('%') ? Math.round(week.remainingPercent) + '%' : weekValue) +
      ' · ' +
      (weekReset == null
        ? '重置未知'
        : weekReset * 1000 <= now
          ? '重置待刷新'
          : countdown(weekReset, now) + '后重置');
    const status =
      '手动重置 ' +
      countText +
      (count > 0
        ? ' · 最近资格 ' +
          (earliest == null
            ? '到期未知'
            : countdown(earliest, now) + (earliest * 1000 > now ? '后过期' : ''))
        : '');
    const details =
      (next == null
        ? '下次自动重置：未知'
        : '下次自动重置 ' +
          date(next) +
          '（' +
          (next * 1000 <= now ? '待刷新' : '还剩' + countdown(next, now)) +
          '）') +
      '\n手动重置可用 ' +
      countText +
      (count > 0
        ? '\n最近资格到期：' +
          (earliest == null ? '未知' : date(earliest) + '（' + countdown(earliest, now) + '）')
        : '');
    return {
      title,
      status,
      details,
      summary: windows.length
        ? windows.map((w) => label(w) + '剩余 ' + remaining(w)).join(' / ')
        : '剩余 —',
    };
  }
  const api = { countdown, summarize };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.QuotaSummary = api;
})(globalThis);
