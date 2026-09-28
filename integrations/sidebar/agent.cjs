'use strict';
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
async function updateQuota() {
  if (quotaPending || Date.now() < nextQuota) return;
  quotaPending = true;
  nextQuota = Date.now() + 60000;
  try {
    const data = await meter.read('/api/account', 75000);
    if (!stopped) await injector.update(quota(data));
  }
  catch { if (!stopped) await injector.update(quota(null)); }
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
      const sessions = [];
      const ids = new Set();
      for (const session of injector.sessions.values()) {
        const result = await session.evaluate('window.__codexThreadTokens?.requestedIds() || []');
        const requested = result?.result?.value;
        if (Array.isArray(requested)) for (const id of requested.slice(0, 2000)) ids.add(id);
        sessions.push(session);
      }
      const snapshot = await threads.snapshot(ids, meter, () => stopped);
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
  stopped = true; clearTimeout(timer); await meter.stop();
  await Promise.allSettled([...injector.sessions.values()].map(s => s.evaluate("window.__codexUsageBadge?.destroy(); window.__codexThreadTokens?.destroy(); window.__codexProjectColors?.destroy();")));
  injector.stop();
}
process.once('SIGINT', stop); process.once('SIGTERM', stop);
console.log('Optional sidebar integration: waiting for an already-enabled local Codex debugging endpoint. Ctrl+C to remove badges.');
void tick();
