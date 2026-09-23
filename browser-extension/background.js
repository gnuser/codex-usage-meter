const PAGE = "https://x.com/thsottiaux";
const ALARM = "tibo-refresh";
const TIMEOUT = "tibo-timeout";
const readerUrl = (url) => url + "?codex_usage_reader=1";
let queue = Promise.resolve();
function serial(action) {
  queue = queue
    .then(action, action)
    .catch(() => status("Read failed; click Refresh now to retry"));
  return queue;
}
async function status(value) {
  await chrome.storage.local.set({ status: value });
}
async function send(config, payload) {
  const current = (await chrome.storage.local.get("config")).config;
  if (
    !current ||
    current.token !== config.token ||
    current.origin !== config.origin
  )
    return;
  const response = await fetch(config.origin + "/api/tibo/ingest", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + config.token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000),
    redirect: "error",
  });
  if (!response.ok) throw Error("Local connection expired; please pair again");
}
async function finish(cycle) {
  const { config } = await chrome.storage.local.get("config");
  if (!config || config.token !== cycle.token) return;
  const batch = cycle.job.batch || { posts: [], complete: false };
  const posts = batch.posts.map(({ truncated, ...post }) => post);
  const complete =
    batch.complete === true &&
    posts.length === 3 &&
    batch.posts.every((post) => !post.truncated && post.text);
  await send(config, { posts, complete });
  await status(
    complete
      ? "Updated · " + new Date().toLocaleTimeString()
      : "Incomplete · Original posts: " + posts.length + " posts",
  );
  await chrome.storage.local.remove("cycle");
  await chrome.alarms.clear(TIMEOUT);
}
async function refresh() {
  const {
    config,
    readerTabs = {},
    readerTab,
  } = await chrome.storage.local.get(["config", "readerTabs", "readerTab"]);
  if (!config) return;
  await status("Reading original posts…");
  // Retire only the old extension-owned Replies tab, never a repurposed tab.
  const repliesUrl = PAGE + "/with_replies";
  const obsolete = readerTabs[repliesUrl] || readerTab;
  if (obsolete) {
    const tab = await chrome.tabs.get(obsolete).catch(() => null);
    if (tab?.url === readerUrl(repliesUrl)) await chrome.tabs.remove(obsolete);
  }
  let tab = readerTabs[PAGE]
    ? await chrome.tabs.get(readerTabs[PAGE]).catch(() => null)
    : null;
  const target = readerUrl(PAGE);
  if (!tab || ![PAGE, target].includes(tab.url))
    tab = await chrome.tabs.create({ url: "about:blank", active: false });
  const job = { id: tab.id, url: target };
  await chrome.storage.local.set({
    readerTabs: { [PAGE]: tab.id },
    cycle: { token: config.token, started: Date.now(), job },
  });
  await chrome.storage.local.remove("readerTab");
  await chrome.alarms.create(TIMEOUT, { delayInMinutes: 1 });
  if (tab.url === target) await chrome.tabs.reload(tab.id);
  else await chrome.tabs.update(tab.id, { url: target });
}
async function receive(message, sender) {
  const { cycle } = await chrome.storage.local.get("cycle");
  const job = cycle?.job;
  if (!job || job.id !== sender.tab?.id || job.url !== sender.url) return;
  if (
    sender.frameId !== 0 ||
    !Number.isFinite(message.loadedAt) ||
    message.loadedAt < cycle.started
  )
    return;
  if (message.action === "reader-ready") {
    job.ready = true;
    await chrome.storage.local.set({ cycle });
    await status("Page connected; waiting for timeline…");
    return;
  }
  if (!Array.isArray(message.batch?.posts) || message.batch.posts.length > 3)
    return;
  job.batch = message.batch;
  await chrome.storage.local.set({ cycle });
  await finish(cycle);
}
async function stop() {
  await chrome.storage.local.remove(["config", "cycle"]);
  await chrome.alarms.clear(ALARM);
  await chrome.alarms.clear(TIMEOUT);
  await status("Stopped");
}
async function start() {
  if (!(await chrome.storage.local.get("config")).config) return;
  await chrome.alarms.create(ALARM, { periodInMinutes: 30 });
  await refresh();
}
chrome.alarms.onAlarm.addListener((alarm) =>
  serial(async () => {
    if (alarm.name === ALARM) await refresh();
    if (alarm.name === TIMEOUT) {
      const { cycle } = await chrome.storage.local.get("cycle");
      if (cycle?.job) await finish(cycle);
    }
  }),
);
chrome.runtime.onStartup.addListener(() => serial(start));
chrome.runtime.onInstalled.addListener(() => serial(start));
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id) return;
  if (["timeline", "reader-ready"].includes(message.action)) {
    serial(() => receive(message, sender));
    return;
  }
  if (sender.url !== chrome.runtime.getURL("popup.html")) return;
  const action =
    message.action === "start"
      ? start
      : message.action === "refresh"
        ? refresh
        : message.action === "stop"
          ? stop
          : null;
  if (!action) return;
  serial(action).then(() => reply({ ok: true }));
  return true;
});
