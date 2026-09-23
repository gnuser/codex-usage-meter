const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
class Element {
  constructor() {
    this.children = [];
    this.textContent = '';
  }
  append(...items) {
    this.children.push(...items);
  }
  replaceChildren(...items) {
    this.children = items;
  }
  setAttribute(key, value) {
    this[key] = value;
  }
}
const nodes = { tiboToggle: new Element(), tiboDetails: new Element() };
const messages = [];
const window = {
  webkit: { messageHandlers: { usageControl: { postMessage: (value) => messages.push(value) } } },
};
const context = {
  window,
  document: {
    hidden: false,
    getElementById: (id) => nodes[id],
    createElement: () => new Element(),
  },
  location: { hash: '#key=test' },
  URLSearchParams,
  AbortController,
  Date,
  setTimeout: () => 1,
  clearTimeout() {},
  fetch: async () => ({
    ok: true,
    json: async () => ({
      source: 'Chrome · x.com',
      stale: true,
      error: '页面读取不完整',
      signal: { label: '数据待更新 · 暂不预测', timeHint: '时间未知' },
      posts: [{ id: '123', publishedAt: 1700000000, text: '<script>unsafe</script>' }],
    }),
  }),
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('web/tibo.js', 'utf8'), context);
(async () => {
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(nodes.tiboDetails.hidden, true);
  assert.ok(nodes.tiboToggle.textContent.includes('暂不预测'));
  nodes.tiboToggle.onclick();
  assert.equal(nodes.tiboDetails.hidden, false);
  const article = nodes.tiboDetails.children.at(-1);
  assert.equal(article.children[1].textContent, '<script>unsafe</script>');
  await article.children[0].onclick({ preventDefault() {} });
  assert.equal(messages[0].action, 'openPost');
  assert.equal(messages[0].url, 'https://x.com/thsottiaux/status/123');
  nodes.tiboToggle.onclick();
  assert.equal(nodes.tiboDetails.hidden, true);
  console.log('Tibo view: stale status, safe text, disclosure and source bridge passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
