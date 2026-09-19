const assert = require('node:assert/strict');
const {metric,segments,cacheRatio,compact} = require('../web/chart-math.js');
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
for(const [input,expected] of [[0,'0.00'],[null,'—'],[NaN,'—'],[-1,'—'],[999,'999.00'],[1000,'1.00K'],[1234567,'1.23M'],[1234567890,'1.23B'],[999999,'1.00M'],[1e12,'1.00T']]) assert.equal(compact(input),expected);
console.log('23 chart accounting and formatting assertions passed');
