'use strict';
const fs = require('node:fs');
const { RendererInjector } = require('./runtime.cjs');
const { MeterService } = require('./service.cjs');
const { ThreadReader } = require('./threads.cjs');
const { quota } = require('./presentation.cjs');
const port = Number(process.env.CODEX_METER_SIDEBAR_PORT || 39222);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid sidebar port');
const meter = new MeterService(process.env.CODEX_METER_PYTHON || (process.platform === 'win32' ? 'python' : 'python3'));
const threads = new ThreadReader();
const injector = new RendererInjector({ port });
let stopped = false, timer, nextQuota = 0, quotaPending = false;
const stopFile = process.env.CODEX_METER_STOP_FILE;
function stopStamp() {
  try { return stopFile ? fs.statSync(stopFile).mtimeMs : 0; } catch { return 0; }
}
const initialStop = stopStamp();
const stopTimer = stopFile ? setInterval(() => { if (stopStamp() !== initialStop) void stop(); }, 500) : null;
stopTimer?.unref();
let accountData = null, accountUpdatedAt = 0, publicResets, activeSessions;
async function renderQuota() {
  if (stopped || !accountUpdatedAt) return;
  const data = { ...accountData, publicResets: publicResets ?? accountData?.publicResets };
  // Announcement polling must not extend the freshness of account limits.
  await injector.update({ ...quota(data), activeSessions, updatedAt: accountUpdatedAt });
}
async function updatePublicResets() {
  try { publicResets = await meter.read('/api/public-resets', 3000); }
  catch { publicResets = { status: 'unavailable' }; }
  await renderQuota();
}
async function updateQuota() {
  if (quotaPending || Date.now() < nextQuota) return;
  quotaPending = true;
  nextQuota = Date.now() + 60000;
  try {
    const data = await meter.read('/api/account', 75000);
    accountData = data; accountUpdatedAt = Date.now();
    await renderQuota();
  }
  catch { accountData = null; accountUpdatedAt = Date.now(); await renderQuota(); }
  finally { quotaPending = false; }
}
async function tick() {
  if (stopped) return;
  try {
    await injector.scan();
    if (stopped) return;
    if (injector.sessions.size) {
      await meter.start();
      if (stopped) { await meter.stop(); return; }
      void updateQuota();
      await updatePublicResets();
      if (stopped) return;
      const sessions = [];
      const ids = new Set();
      for (const session of injector.sessions.values()) {
        const result = await session.evaluate('window.__codexThreadTokens?.requestedIds() || []');
        const requested = result?.result?.value;
        if (Array.isArray(requested)) for (const id of requested.slice(0, 2000)) ids.add(id);
        sessions.push(session);
      }
      let catalog;
      try {
        const data = await meter.read('/api/threads?limit=100', 3000);
        catalog = data.sessions.filter(s => s.updatedAt * 1000 >= Date.now() - 1800000);
        for (const item of catalog) ids.add(item.id);
      } catch { catalog = null; }
      const prioritized = new Set([...(catalog || []).map(item => item.id), ...ids]);
      const snapshot = await threads.snapshot(prioritized, meter, () => stopped);
      activeSessions = { ok: catalog !== null, checkedAt: Date.now(), items: (catalog || []).map(item => ({ ...item, usage: snapshot.usages[item.id] })) };
      await renderQuota();
      if (stopped) return;
      await Promise.allSettled(sessions.map(s => s.evaluate('window.__codexThreadTokens?.update(' + JSON.stringify(snapshot) + ')')));
    } else { await meter.stop(); nextQuota = 0; }
  } catch {
    if (!injector.sessions.size) { await meter.stop(); nextQuota = 0; }
  }
  finally { if (!stopped) timer = setTimeout(tick, 5000); }
}
async function stop() {
  if (stopped) return;
  stopped = true; clearTimeout(timer); clearInterval(stopTimer); await meter.stop();
  await Promise.allSettled([...injector.sessions.values()].map(s => s.evaluate("window.__codexUsageBadge?.destroy(); window.__codexThreadTokens?.destroy(); window.__codexProjectColors?.destroy();")));
  injector.stop();
}
process.once('SIGINT', stop); process.once('SIGTERM', stop);
console.log('Optional sidebar integration: waiting for an already-enabled local Codex debugging endpoint. Ctrl+C to remove badges.');
void tick();
