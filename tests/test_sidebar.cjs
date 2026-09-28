'use strict';
const assert = require('node:assert/strict');
const { quota, thread } = require('../integrations/sidebar/presentation.cjs');
const { isMainWindow, CdpSession, RendererInjector } = require('../integrations/sidebar/runtime.cjs');
const now = 1700000000000;
assert.equal(quota(null, now).percent, null);
assert.equal(quota(null, now).resetCredits.count, null);
const credits = quota({ limits: { rateLimitResetCredits: { availableCount: 2, credits: [
  {status: 'available', expiresAt: now / 1000 + 86400},
  {status: 'used', expiresAt: now / 1000 + 30},
  {status: 'available', expiresAt: now / 1000 + 3600},
] } } }, now).resetCredits;
assert.deepEqual(credits, {count: 2, expiresAt: now / 1000 + 3600, expired: false});
assert.equal(quota({limits: {rateLimitResetCredits: {availableCount: 0, credits: [{status:'available', expiresAt:now/1000+100}]}}}, now).resetCredits.expiresAt, null);

const result = quota({ windows: [
  { limitId: 'other', windowDurationMins: 300, remainingPercent: 99 },
  { limitId: 'codex', windowDurationMins: 300, remainingPercent: 8, resetsAt: now / 1000 + 600 },
  { limitId: 'codex', windowDurationMins: 10080, remainingPercent: 65, resetsAt: now / 1000 + 86400 },
]}, now);
assert.equal(result.mode, 'dual');
assert.equal(result.rings[0].resetsAt, now / 1000 + 600);
assert.equal(quota({ windows: [{ windowDurationMins: 300, remainingPercent: 50 }] }, now).resetsAt, null);
assert.deepEqual(result.rings.map(r => r.percent), [8, 65]);
assert.equal(result.rings[0].tone, 'danger');
assert.equal(quota({ windows: [{ windowDurationMins: 10080, remainingPercent: 70, resetsAt: now / 1000 - 1 }] }, now).percent, null);
const value = thread({ total: { total_tokens: 1250000 }, turns: [{ usage: { input_tokens: 1000, cached_input_tokens: 800, output_tokens: 25 } }] });
assert.equal(value.total, 1250000);
assert.ok(value.detail.includes('Cache 80%'));
assert.equal(thread(null).total, null);
assert.ok(thread({ turns: [{ usage: { input_tokens: 10, cached_input_tokens: 20 } }] }).detail.includes('Cache —'));
assert.ok(isMainWindow({ url: 'app://-/index.html' }));
assert.ok(!isMainWindow({ url: 'https://example.com/index.html' }));
assert.ok(!isMainWindow({ url: 'app://-/index.html?overlay=1' }));
(async () => {
  await assert.rejects(new CdpSession({ webSocketDebuggerUrl: 'ws://example.com/session' }).connect(), /loopback/);
  await assert.rejects(new CdpSession({webSocketDebuggerUrl: 'ws://secret@127.0.0.1/session'}).connect(), /loopback/);
  const originalFetch = global.fetch;
  try {
    let closed = false;
    const injector = new RendererInjector({port: 39222});
    injector.sessions.set('old', {close() { closed = true; }});
    global.fetch = async () => { throw Error('offline'); };
    await assert.rejects(injector.scan(), /offline/);
    assert.equal(closed, true);
    assert.equal(injector.sessions.size, 0, 'discovery failure discards stale connections');
    global.fetch = async () => { injector.stop(); return {ok:true, json:async () => [{type:'page', id:'new', url:'app://-/index.html', webSocketDebuggerUrl:'ws://127.0.0.1:39222/session'}]}; };
    await injector.scan();
    assert.equal(injector.sessions.size, 0, 'stop during discovery never connects');
  } finally { global.fetch = originalFetch; }
  console.log('Sidebar: quota selection, stale data, cache details, target validation passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
