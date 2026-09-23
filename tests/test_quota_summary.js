const assert = require('node:assert/strict');
const { countdown, summarize } = require('../web/quota-summary.js');
const now = 1800000000000;
const future = now / 1000 + 90000;
const make = (count, credits, windows = []) => ({
  windows,
  limits: { rateLimitResetCredits: { availableCount: count, credits } },
});
assert.equal(countdown(null, now), '—');
assert.equal(countdown(now / 1000, now), '已到期');
assert.equal(countdown(now / 1000 + 30, now), '1分');
assert.equal(countdown(future, now), '1天1时');
assert.equal(summarize(null, now).status, '手动重置 —');
assert.equal(summarize(make(0, []), now).status, '手动重置 0次');
let view = summarize(
  make(
    2,
    [
      { status: 'used', expiresAt: now / 1000 - 10 },
      { status: 'available', expiresAt: future },
      { status: 'available', expiresAt: future + 86400 },
    ],
    [
      { limitId: 'other', windowDurationMins: 10080, remainingPercent: 1 },
      { limitId: 'codex', windowDurationMins: 10080, remainingPercent: 45, resetsAt: future },
    ],
  ),
  now,
);
assert.equal(view.title, '周45% · 1天1时后重置');
assert.equal(view.status, '手动重置 2次 · 最近资格 1天1时后过期');
view = summarize(
  make(
    1,
    [{ status: 'available', expiresAt: now / 1000 - 1 }],
    [{ windowDurationMins: 10080, remainingPercent: 90, resetsAt: now / 1000 - 1 }],
  ),
  now,
);
assert.equal(view.title, '周待刷新 · 重置待刷新');
assert.ok(view.status.includes('待刷新'));
assert.ok(!view.status.includes('后过期'));
assert.ok(summarize(make(1, []), now).status.includes('到期未知'));
assert.ok(summarize({ windows: [{ remainingPercent: -2 }] }, now).summary.endsWith('—'));
console.log('Quota summary: credits, deadlines, stale windows and unknown values passed');
