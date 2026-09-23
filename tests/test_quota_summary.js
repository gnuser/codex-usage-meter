const assert = require('node:assert/strict');
const { countdown, summarize } = require('../web/quota-summary.js');
const now = 1800000000000;
const future = now / 1000 + 90000;
const make = (count, credits, windows = []) => ({
  windows,
  limits: { rateLimitResetCredits: { availableCount: count, credits } },
});
assert.equal(countdown(null, now), '—');
assert.equal(countdown(now / 1000, now), 'Expired');
assert.equal(countdown(now / 1000 + 30, now), '1m');
assert.equal(countdown(future, now), '1d 1h');
assert.equal(summarize(null, now).status, 'Resets —');
assert.equal(summarize(make(0, []), now).status, 'Resets 0');
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
assert.equal(view.title, 'Week 45% · Reset 1d 1h');
assert.equal(view.status, 'Resets 2 · Credit expires in 1d 1h');
view = summarize(
  make(
    1,
    [{ status: 'available', expiresAt: now / 1000 - 1 }],
    [{ windowDurationMins: 10080, remainingPercent: 90, resetsAt: now / 1000 - 1 }],
  ),
  now,
);
assert.equal(view.title, 'Week Refresh needed · Reset pending');
assert.ok(view.status.includes('Refresh needed'));
assert.ok(!view.status.includes('expires in'));
assert.ok(summarize(make(1, []), now).status.includes('expiry unknown'));
assert.ok(summarize({ windows: [{ remainingPercent: -2 }] }, now).summary.endsWith('—'));
console.log('Quota summary: credits, deadlines, stale windows and unknown values passed');
