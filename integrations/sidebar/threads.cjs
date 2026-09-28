'use strict';
const { thread } = require('./presentation.cjs');
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const FRESH_MS = 30000;

// Share reads between client windows and rotate large lists without starving the tail.
class ThreadReader {
  constructor() { this.records = new Map(); }

  async snapshot(ids, meter, stopped = () => false) {
    const requested = new Set([...ids].filter(id => typeof id === 'string' && UUID.test(id)));
    for (const id of this.records.keys()) if (!requested.has(id)) this.records.delete(id);
    const due = [...requested].filter(id => Date.now() - (this.records.get(id)?.at ?? 0) >= 15000);
    due.sort((a, b) => (this.records.get(a)?.at ?? 0) - (this.records.get(b)?.at ?? 0));
    const deadline = Date.now() + 8000;
    for (const id of due.slice(0, 20)) {
      if (stopped() || Date.now() >= deadline) break;
      let value = null;
      try {
        const result = await meter.read('/api/panel?thread=' + encodeURIComponent(id), Math.min(2000, deadline - Date.now()));
        if (result.selected?.id === id) value = thread(result.selected);
      } catch { /* Failed reads remain unknown, never zero or stale cached totals. */ }
      this.records.set(id, { at: Date.now(), value });
    }
    const totals = {}, details = {}, now = Date.now();
    for (const [id, record] of this.records) {
      if (now - record.at >= FRESH_MS || record.value?.total == null) continue;
      totals[id] = record.value.total;
      details[id] = record.value.detail;
    }
    return { ok: true, checkedAt: now, totals, details };
  }
}
module.exports = { ThreadReader };
