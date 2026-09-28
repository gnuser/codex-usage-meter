'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { MeterService } = require('../integrations/sidebar/service.cjs');
const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'usage-sidebar-'));
const oldHome = process.env.CODEX_HOME;
process.env.CODEX_HOME = folder;
const service = new MeterService(process.env.CODEX_METER_PYTHON || (process.platform === 'win32' ? 'python' : 'python3'));
(async () => {
  try {
    await Promise.all([service.start(), service.start()]);
    const child = service.child;
    await service.start();
    assert.equal(service.child, child, 'reuse one data service');
    const result = await service.read('/api/threads?limit=1');
    assert.deepEqual(result.sessions, []);
    await assert.rejects(service.read('https://example.com/api/'), /Invalid meter route/);
    await service.stop();
    assert.equal(service.url, null);
    assert.equal(service.child, null);
    assert.ok(child.exitCode !== null || child.signalCode !== null, 'child fully exited');
    await service.start();
    assert.notEqual(service.child, child, 'restart creates a fresh service');
    await service.stop();
    const missing = new MeterService(path.join(folder, 'missing-python'));
    await assert.rejects(missing.start(), /unavailable/);
    await missing.stop();
    console.log('Sidebar data service: isolated start, authenticated read, reuse and stop passed');
  } finally {
    await service.stop();
    if (oldHome === undefined) delete process.env.CODEX_HOME; else process.env.CODEX_HOME = oldHome;
    fs.rmSync(folder, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
