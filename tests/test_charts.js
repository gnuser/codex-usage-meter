const assert = require('node:assert/strict');
const {metric,segments,cacheRatio} = require('../web/chart-math.js');
const u={input_tokens:100,cached_input_tokens:80,cache_write_input_tokens:5,output_tokens:20,reasoning_output_tokens:10,total_tokens:120};
assert.equal(metric(u,'uncached'),20);
assert.equal(segments(u).reduce((s,r)=>s+r.value,0),120); // Never add cache writes or reasoning twice.
assert.deepEqual(segments(u).map(r=>r.value),[20,80,20]);
assert.equal(cacheRatio(u),.8);
assert.equal(metric({},'uncached'),null);
assert.equal(cacheRatio({input_tokens:0,cached_input_tokens:0}),null);
assert.equal(metric({input_tokens:10,cached_input_tokens:20},'uncached'),null);
assert.equal(segments({total_tokens:99})[0].kind,'unknown');
assert.equal(segments({...u,total_tokens:999})[0].kind,'unknown');
assert.deepEqual(segments({},'output_tokens'),[]);
assert.equal(metric({total_tokens:0}),0);
assert.equal(metric({total_tokens:NaN}),null);
assert.deepEqual(segments(u,'reasoning_output_tokens'),[{kind:'reasoning_output_tokens',value:10}]);
console.log('13 chart accounting assertions passed');
