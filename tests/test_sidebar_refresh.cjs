'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
let now = 100000, reads = 0, finishDaily;
const updates = [];
const daily = new Promise(resolve => { finishDaily = resolve; });
class Meter {
  async stop() {}
  read(route) {
    if (route === '/api/account') return daily;
    assert.equal(route, '/api/limits');
    reads++;
    return Promise.resolve({ remaining: reads === 1 ? 10 : 100 });
  }
}
class Injector {
  constructor() { this.sessions = new Map(); }
  async scan() {}
  async update(value) { updates.push(value); }
}
const modules = {
  'node:fs': fs,
  './runtime.cjs': { RendererInjector: Injector },
  './service.cjs': { MeterService: Meter },
  './threads.cjs': { ThreadReader: class {} },
  './presentation.cjs': { quota: data => data },
};
const context = vm.createContext({
  require: name => { assert.ok(modules[name], name); return modules[name]; },
  process: { env: {}, platform: 'darwin', once() {} },
  console: { log() {} }, Date: { now: () => now },
  setTimeout() {}, clearTimeout() {}, clearInterval() {},
});
vm.runInContext(fs.readFileSync(require.resolve('../integrations/sidebar/agent.cjs'), 'utf8'), context);
(async () => {
  // Let the initial scan with no client finish, without real sockets or timers.
  await new Promise(setImmediate);
  const pending = context.updateDaily();
  await context.updateQuota();
  assert.equal(updates.at(-1).remaining, 10, 'limits render while daily analytics is pending');
  now += 14000;
  await context.updateQuota();
  assert.equal(reads, 1, 'rate-limit quota polling');
  now += 1000;
  await context.updateQuota();
  assert.equal(updates.at(-1).remaining, 100, 'reset appears on next quota poll');
  const refreshedAt = updates.at(-1).updatedAt;
  now += 1000;
  finishDaily({ remaining: 10, usage: { tokens: 123 } });
  await pending;
  assert.equal(updates.at(-1).remaining, 100, 'late analytics cannot restore pre-reset limits');
  assert.equal(updates.at(-1).updatedAt, refreshedAt, 'analytics cannot renew quota freshness');
  assert.equal(updates.at(-1).usage.tokens, 123);
  console.log('Reset refresh: independent limits, polling interval and late analytics passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
