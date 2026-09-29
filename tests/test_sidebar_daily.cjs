'use strict';
const assert = require('node:assert/strict');
const { dailyUsage } = require('../integrations/sidebar/daily.cjs');
const now = new Date(2026, 8, 29, 12).getTime();
const result = dailyUsage({dailyUsageBuckets:[
  {startDate:'2026-09-29',tokens:4567890}, {startDate:'2026-09-28',tokens:0},
  {startDate:'2026-09-26',tokens:121129808}, {startDate:'2026-09-30',tokens:99},
  {startDate:'2026-09-25',tokens:-1}, {startDate:'2026-02-30',tokens:99},
]}, now);
assert.equal(result.todayText,'5M');
assert.equal(result.days.length,7);
assert.equal(result.days[6].date,'2026-09-29');
assert.equal(result.days[5].text,'0');
assert.equal(result.days[4].tokens,null,'missing day is not zero');
assert.equal(result.latest.date,'2026-09-29','future dates excluded');
const missing = dailyUsage({dailyUsageBuckets:[{startDate:'2026-09-28',tokens:121129808}]},now);
assert.equal(missing.todayText,'—');
assert.equal(missing.latest.text,'121M');
assert.equal(dailyUsage(null,now).available,false);
assert.equal(dailyUsage({dailyUsageBuckets:[{startDate:'2026-09-29',tokens:1},{startDate:'2026-09-29',tokens:2}]},now).todayText,'—','ambiguous duplicates not summed');
const boundary = dailyUsage({},new Date(2026,0,1,0,1).getTime());
assert.equal(boundary.days[0].date,'2025-12-26');
console.log('Daily usage: local date rollover, reported zero, missing days, duplicates and delayed reports passed');
