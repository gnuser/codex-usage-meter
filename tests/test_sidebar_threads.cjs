'use strict';
const assert = require('node:assert/strict');
const { ThreadReader } = require('../integrations/sidebar/threads.cjs');
const ids = Array.from({length: 25}, (_, i) => '00000000-0000-0000-0000-' + String(i).padStart(12, '0'));
let reads = 0;
const meter = { async read(route) {
  reads++;
  return { selected: {id: route.split('=')[1], total: {total_tokens: 100}, turns: []} };
} };
(async () => {
  const reader = new ThreadReader();
  let data = await reader.snapshot([...ids, '../bad'], meter);
  assert.equal(Object.keys(data.totals).length, 20);
  data = await reader.snapshot(ids, meter);
  assert.equal(Object.keys(data.totals).length, 25, 'rotate to unread tail');
  await reader.snapshot(ids, meter);
  assert.equal(reads, 25, 'reuse fresh entries');
  data = await reader.snapshot([ids[0]], meter);
  assert.deepEqual(Object.keys(data.totals), [ids[0]], 'remove hidden records');
  reader.records.get(ids[0]).at = Date.now() - 31000;
  data = await reader.snapshot([ids[0]], {read: async () => { throw Error('offline'); }});
  assert.equal(Object.keys(data.totals).length, 0, 'failed refresh must not retain healthy data');
  data = await new ThreadReader().snapshot(ids, meter, () => true);
  assert.equal(Object.keys(data.totals).length, 0, 'stop cancels subsequent reads');
  data = await new ThreadReader().snapshot([ids[0]], {read: async () => ({selected: {id: ids[1], total: {total_tokens: 100}}})});
  assert.equal(Object.keys(data.totals).length, 0, 'reject mismatched sessions');
  console.log('Sidebar thread cache, bounds, rotation, cancellation and identity checks passed');
})().catch(error => {console.error(error); process.exitCode = 1;});
