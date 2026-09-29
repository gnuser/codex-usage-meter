'use strict';
const { compact } = require('../../web/chart-math.js');
const dateKey = date => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function dailyUsage(usage, now = Date.now()) {
  const today = dateKey(new Date(now));
  const buckets = new Map(), duplicates = new Set();
  for (const row of Array.isArray(usage?.dailyUsageBuckets) ? usage.dailyUsageBuckets : []) {
    if (!validDate(row?.startDate) || row.startDate > today) continue;
    if (buckets.has(row.startDate)) duplicates.add(row.startDate);
    buckets.set(row.startDate, Number.isSafeInteger(row.tokens) && row.tokens >= 0 ? row.tokens : null);
  }
  for (const day of duplicates) buckets.set(day, null);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setDate(date.getDate() - (6 - index));
    const key = dateKey(date), tokens = buckets.get(key) ?? null;
    return { date: key, tokens, text: compact(tokens) };
  });
  const latest = [...buckets].filter(([, tokens]) => tokens !== null).sort(([a], [b]) => b.localeCompare(a))[0];
  return { today, todayText: compact(buckets.get(today)), days,
    latest: latest ? { date: latest[0], tokens: latest[1], text: compact(latest[1]) } : null,
    available: Array.isArray(usage?.dailyUsageBuckets) };
}
module.exports = { dailyUsage };
