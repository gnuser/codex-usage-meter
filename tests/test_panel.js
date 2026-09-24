const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const charts = require('../web/chart-math.js');
const QuotaSummary = require('../web/quota-summary.js');
class Element {
  constructor() {
    this.parent = null;
    this.detachments = 0;
    this.children = [];
    this.textContent = '';
    this.style = {};
    this.dataset = {};
  }
  append(...items) {
    for (const item of items) {
      item.remove();
      item.parent = this;
      this.children.push(item);
    }
  }
  remove() {
    if (this.parent) {
      this.detachments++;
      this.parent.children = this.parent.children.filter((n) => n !== this);
      this.parent = null;
    }
  }
  insertBefore(item, before) {
    item.remove();
    const index = before ? this.children.indexOf(before) : this.children.length;
    item.parent = this;
    this.children.splice(index, 0, item);
  }
  replaceChild(item, old) {
    const index = this.children.indexOf(old);
    old.remove();
    item.remove();
    item.parent = this;
    this.children.splice(index, 0, item);
  }
  get lastElementChild() {
    return this.children.at(-1);
  }
  replaceChildren(...items) {
    this.children = items;
  }
  setAttribute(key, value) {
    this[key] = value;
  }
}
const nodes = Object.fromEntries(
  ['status', 'sessionCards', 'activityCount', 'quotaSummary', 'resetSummary', 'resetStatus'].map(
    (id) => [id, new Element()],
  ),
);
let input = 1000,
  output = 200,
  reads = 0,
  accountReads = 0,
  releaseAccount;
const document = {
  hidden: true,
  getElementById: (id) => nodes[id],
  createElement: () => new Element(),
  addEventListener() {},
};
const window = { addEventListener() {} };
const context = {
  document,
  window,
  location: { hash: '#key=test' },
  URLSearchParams,
  UsageCharts: charts,
  QuotaSummary,
  AbortController,
  Date,
  console,
  setTimeout: () => 1,
  clearTimeout() {},
  fetch: async (path) => ({
    ok: true,
    json: async () => {
      if (path === '/api/account') {
        accountReads++;
        if (releaseAccount === true)
          await new Promise((resolve) => {
            releaseAccount = resolve;
          });
        return {
          windows: [
            {
              windowDurationMins: 10080,
              remainingPercent: 45,
              resetsAt: Date.now() / 1000 + 86400,
            },
          ],
          limits: {
            rateLimitResetCredits: {
              availableCount: 3,
              credits: [
                { status: 'available', expiresAt: Date.now() / 1000 + 7200 },
                { status: 'used', expiresAt: Date.now() / 1000 + 60 },
              ],
            },
          },
        };
      }
      if (path.startsWith('/api/threads'))
        return { sessions: [{ id: 'one', title: 'Example', updatedAt: Date.now() / 1000 }] };
      reads++;
      return {
        selected: {
          id: 'one',
          models: [
            { model: 'model-a', usage: { input_tokens: input, cached_input_tokens: 800, output_tokens: output } },
            { model: 'model-b', usage: { input_tokens: 3000000, output_tokens: 4000 } },
            {
              model: 'Unknown model / Unattributed interval',
              usage: { input_tokens: null, output_tokens: null },
            },
          ],
          total: { input_tokens: input, cached_input_tokens: 800, output_tokens: output, total_tokens: input + output },
          turns: [
            {
              number: 1,
              usage: { input_tokens: input, cached_input_tokens: 800, output_tokens: output, total_tokens: input + output },
            },
          ],
        },
      };
    },
  }),
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('web/panel.js', 'utf8'), context);
(async () => {
  await context.refresh();
  assert.equal(reads, 0, 'ordinary hidden pages pause');
  await window.refreshUsage();
  assert.equal(reads, 1, 'native heartbeat bypasses stale hidden state');
  await context.refreshQuota();
  assert.ok(nodes.resetSummary.textContent.includes('Available resets: 3'));
  assert.ok(nodes.resetSummary.textContent.includes('Next credit expiry: '));
  assert.ok(nodes.resetSummary.textContent.includes('(2h 0m)'));
  assert.ok(nodes.resetSummary.textContent.includes('Next automatic reset: '));
  assert.ok(document.title.startsWith('Week 45% · '));
  assert.ok(document.title.endsWith('Reset 1d 0h'));
  assert.ok(nodes.resetStatus.textContent.startsWith('Resets 3'));
  assert.equal(QuotaSummary.countdown(Date.now() / 1000 - 1), 'Expired');
  assert.equal(QuotaSummary.countdown(null), '—');
  assert.ok(nodes.resetStatus.textContent.endsWith('2h 0m'));
  assert.ok(!document.title.includes('恢复'));
  releaseAccount = true;
  const pending = context.refreshQuota();
  await new Promise((resolve) => setImmediate(resolve));
  const before = accountReads;
  nodes.quotaSummary.onclick();
  assert.equal(nodes.resetSummary.hidden, false, 'expand immediately during request');
  nodes.quotaSummary.onclick();
  assert.equal(nodes.resetSummary.hidden, true, 'collapse immediately during request');
  assert.notEqual(nodes.quotaSummary.disabled, true);
  assert.equal(accountReads, before, 'toggle does not issue requests');
  releaseAccount();
  await pending;
  assert.equal(nodes.resetSummary.hidden, true, 'late response preserves collapsed state');
  const card = () => nodes.sessionCards.children[0];
  assert.ok(card().children.some((n) => n.textContent === 'In 1K · Out 200 · Cache 80%'));
  const details = () => card().children.find((n) => n.className === 'model-details');
  assert.equal(details().children[1].children[0].textContent, 'model-a');
  assert.equal(details().children[2].children[1].textContent, 'In 3M · Out 4K · Cache —');
  const original = card();
  const originalToggle = card().children.find((n) => n.className === 'model-toggle');
  const toggle = () => card().children.find((n) => n.className === 'model-toggle');
  assert.equal(toggle()['aria-expanded'], 'false');
  toggle().onclick();
  assert.equal(card().dataset.expanded, 'true');
  input = 2500;
  output = 600;
  await window.refreshUsage();
  assert.equal(reads, 2);
  assert.ok(card().children.some((n) => n.textContent === 'In 3K · Out 600 · Cache 32%'));
  assert.equal(card(), original, 'keep article during refresh');
  assert.equal(toggle(), originalToggle, 'keep the pressed toggle attached during refresh');
  assert.equal(toggle().detachments, 0, 'do not move or detach the pressed button');
  assert.equal(card().dataset.expanded, 'true');
  assert.equal(details().children[1].children[1].textContent, 'In 3K · Out 600 · Cache 32%');
  toggle().onclick();
  assert.equal(card().dataset.expanded, 'false');
  input = null;
  output = null;
  await window.refreshUsage();
  assert.ok(card().children.some((n) => n.textContent === 'In — · Out — · Cache —'));
  assert.equal(toggle()['aria-expanded'], 'false');
  assert.equal(typeof nodes.activityCount.onclick, 'function');
  console.log('Panel recovery, refreshed input/output and unknown-value tests passed');
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
