const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const urls = ["https://x.com/thsottiaux?codex_usage_reader=1"];
const state = {
  config: { origin: "http://127.0.0.1:9999", token: "scoped" },
  cycle: { token: "scoped", started: 100, job: { id: 1, url: urls[0] } },
};
let listener;
const sent = [];
const chrome = {
  runtime: {
    id: "extension",
    getURL: () => "chrome-extension://extension/popup.html",
    onMessage: {
      addListener: (f) => {
        listener = f;
      },
    },
    onStartup: { addListener() {} },
    onInstalled: { addListener() {} },
  },
  alarms: { onAlarm: { addListener() {} }, clear: async () => {} },
  storage: {
    local: {
      get: async (keys) =>
        Object.fromEntries(
          (Array.isArray(keys) ? keys : [keys]).map((k) => [
            k,
            structuredClone(state[k]),
          ]),
        ),
      set: async (values) => Object.assign(state, structuredClone(values)),
      remove: async (keys) => {
        for (const key of Array.isArray(keys) ? keys : [keys])
          delete state[key];
      },
    },
  },
};
const context = vm.createContext({
  chrome,
  importScripts() {},
  console,
  Date,
  Promise,
  AbortSignal,
  fetch: async (url, init) => {
    sent.push(JSON.parse(init.body));
    return { ok: true };
  },
});
vm.runInContext(
  fs.readFileSync("browser-extension/background.js", "utf8"),
  context,
);
const batch = {
  complete: true,
  posts: [1, 2, 3].map((n) => ({
    id: String(n),
    text: "Post",
    publishedAt: n,
  })),
};
async function deliver(id, loadedAt, override = {}) {
  listener(
    { action: "timeline", loadedAt, batch },
    {
      id: "extension",
      tab: { id },
      url: urls[id - 1],
      frameId: 0,
      ...override,
    },
    () => {},
  );
  await vm.runInContext("queue", context);
}
(async () => {
  await deliver(1, 99);
  assert(!state.cycle.job.batch, "old document rejected");
  await deliver(1, 101, { frameId: 1 });
  assert(!state.cycle.job.batch, "subframe rejected");
  await deliver(1, 101, { url: "https://x.com/home" });
  assert(!state.cycle.job.batch);
  await deliver(1, 101, {
    url: "https://x.com/thsottiaux/with_replies?codex_usage_reader=1",
  });
  assert.equal(sent.length, 0);
  await deliver(1, 102);
  assert.equal(sent.length, 1);
  assert(sent[0].complete);
  assert(!state.cycle);
  assert.match(state.status, /Updated/);
  state.readerTabs = { profile: 1 };
  listener(
    { action: "stop" },
    { id: "extension", url: chrome.runtime.getURL("popup.html") },
    () => {},
  );
  await vm.runInContext("queue", context);
  assert(!state.config);
  assert.equal(state.status, "Stopped");
  assert(state.readerTabs, "retain owned tab identity for reuse after restart");
  console.log("Tibo durable cycle, old document and sender isolation passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
