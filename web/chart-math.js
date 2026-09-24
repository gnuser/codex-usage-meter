'use strict';
(function(root){
 const valid = n => typeof n === 'number' && Number.isFinite(n) && n >= 0;
 function metric(u={},key='total_tokens') {
  if(key==='uncached')return valid(u.input_tokens)&&valid(u.cached_input_tokens)&&u.cached_input_tokens<=u.input_tokens?u.input_tokens-u.cached_input_tokens:null;
  return valid(u[key])?u[key]:null;
 }
 function segments(u={},key='total_tokens'){
  const value=metric(u,key);if(value===null)return [];
  if(key!=='total_tokens')return [{kind:key,value}];
  const fresh=metric(u,'uncached'),cache=metric(u,'cached_input_tokens'),out=metric(u,'output_tokens');
  if(fresh===null||cache===null||out===null||fresh+cache+out!==value)return [{kind:'unknown',value}];
  return [{kind:'uncached',value:fresh},{kind:'cached_input_tokens',value:cache},{kind:'output_tokens',value:out}];
 }
 function cacheRatio(u={}){return valid(u.input_tokens)&&u.input_tokens>0&&valid(u.cached_input_tokens)&&u.cached_input_tokens<=u.input_tokens?u.cached_input_tokens/u.input_tokens:null;}
 function compact(value){
  if(!valid(value))return '—';
  const units=['','K','M','B','T'];let index=0;
  while(value>=1000&&index<units.length-1){value/=1000;index++;}
  if(Number(value.toFixed(0))>=1000&&index<units.length-1){value/=1000;index++;}
  return value.toFixed(0)+units[index];
 }
 const api={metric,segments,cacheRatio,compact};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.UsageCharts=api;
})(globalThis);
