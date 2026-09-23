'use strict';
const $ = id => document.getElementById(id);
const fragment = new URLSearchParams(location.hash.slice(1));
const key = fragment.get('key') || '';
let selected = fragment.get('thread') || '', snapshot = null, account = null, loading = false, sessionLimit = 1;
const fields = ['input_tokens','cached_input_tokens','cache_write_input_tokens','output_tokens','reasoning_output_tokens','total_tokens'];
const labels = ['Input','Cache read¹','Cache write¹','Output','Reasoning output²','Total tokens'];
const fmt = v => v == null ? '—' : Number(v).toLocaleString('en-US',{maximumFractionDigits:6});
const date = v => !v ? 'Time unknown' : new Date(typeof v === 'number' ? v * 1000 : v).toLocaleString('en-US');
function el(tag, text, cls) {const node=document.createElement(tag);if(text!=null)node.textContent=text;if(cls)node.className=cls;return node;}
async function api(path) {const query=new URLSearchParams();if(selected)query.set('thread',selected);if(path==='/api/snapshot'){query.set('limit',sessionLimit);if(fragment.get('scope')==='thread')query.set('scope','thread');}const r=await fetch(path+'?'+query,{headers:{Authorization:'Bearer '+key}});if(!r.ok)throw Error('Local API returned '+r.status+'; reopen the dashboard from the plugin');return r.json();}
function render() {
 const s=snapshot.selected, events=s?.events||[], last=events.at(-1), turn=s?.turns.at(-1);
 const options=snapshot.sessions; $('threads').replaceChildren(el('option','Select a conversation'));$('threads').firstChild.value='';
 options.forEach(o=>{const n=el('option',(o.title||'Untitled conversation')+' · '+o.id.slice(0,8)+' · '+date(o.updatedAt));n.value=o.id;n.title=o.title||o.id;$('threads').append(n)});$('threads').value=selected;
 const cards=[['Loaded subtotal',snapshot.observedTotal.total_tokens,'Loaded records only, not the entire account'],['Conversation total',s?.total.total_tokens,'Latest cumulative snapshot; may include inherited history'],['Current turn',turn?.usage.total_tokens,turn?turn.id:'Select a conversation first'],['Latest recorded call',last?.lastReported.total_tokens,last?date(last.timestamp):'No calls recorded']];
 $('cards').replaceChildren(...cards.map(([title,value,note])=>{const n=el('div',null,'card');n.append(el('span',title),el('strong',fmt(value)),el('p',note));return n}));
 $('breakdown').replaceChildren(...fields.map((f,i)=>{const n=el('div',labels[i]);n.append(el('strong',fmt(last?.lastReported[f])));return n}));
 function row(prefix,u,tail){const tr=el('tr');tr.append(prefix,...fields.map(f=>el('td',fmt(u[f]))),el('td',tail));return tr;}
 $('turns').replaceChildren(...(s?.turns||[]).slice().reverse().map(t=>{const td=el('td',t.preview||'No user message recorded');td.title=t.preview||t.id;td.append(el('small',t.id));return row(td,t.usage,t.records)}));
 const turnMap=new Map((s?.turns||[]).map(t=>[t.id,t]));
 $('events').replaceChildren(...events.slice(-200).reverse().map(e=>{const td=el('td',date(e.timestamp));td.append(el('small',e.model||'Unknown model'),el('small',turnMap.get(e.turnId)?.preview||'Unattributed to a turn'));return row(td,e.usage,`Line ${e.line} · ${e.quality==='interval_delta'?'Interval delta':'Last call'}`)}));
 renderConversations(s);
 renderCharts();
 const warnings=[...snapshot.errors,...(s?.warnings||[])];if(selected&&!s)warnings.push('Selected conversation is not loaded; load more or select from the list');
 $('warnings').replaceChildren(...warnings.map(w=>el('li',w)));
 $('coverage').textContent=`Read ${snapshot.files} files / ${snapshot.sessions.length} conversations / ${snapshot.observedRecords} deduplicated records. ${snapshot.coverage}`;
 $('status').textContent='Updated '+date(snapshot.generatedAt)+(s?' · Source '+s.source:' · Select a conversation');
 $('loadStatus').textContent=`Loaded ${snapshot.pagination?.loaded??snapshot.sessions.length} conversations`;
 $('loadMore').disabled=!snapshot.pagination?.hasMore||sessionLimit>=1000;
 $('loadMore').textContent=snapshot.pagination?.hasMore?'Load 3 more conversations':'All conversations loaded';
 renderLimits();
}
function renderConversations(s){
 const container=$('conversations');
 const opened=new Set([...container.querySelectorAll('details[open]')].map(d=>d.dataset.key));
 const first=container.dataset.thread!==selected;container.dataset.thread=selected;
 $('conversationTitle').textContent=s?(s.title||'Selected conversation')+' · Messages and usage':'Messages and usage';
 const turns=s?.turns||[];
 container.replaceChildren(...turns.map((t,index)=>{
  const block=el('details',null,'turn-detail');block.dataset.key=selected+':'+t.id;
  block.open=opened.has(block.dataset.key)||(first&&index===turns.length-1);
  const summary=el('summary',`Turn ${index+1} · ${t.preview||'No user message recorded'}`);
  summary.append(el('strong',`${fmt(t.usage.total_tokens)} tokens`));block.append(summary);
  block.append(el('p',(t.models||[]).map(m=>m.model).join(' / ')||'Unknown model','model-label'));
  block.append(el('p',fields.map((f,i)=>`${labels[i]} ${fmt(t.usage[f])}`).join(' · '),'note'));
  if(!t.messages?.length)block.append(el('p','No message text recorded for this turn.'));
  (t.messages||[]).forEach(m=>{
   const message=el('details',null,'message '+m.role);message.dataset.key=selected+':'+t.id+':'+m.line;
   message.open=opened.has(message.dataset.key);
   const label=m.role==='user'?'You':m.phase==='commentary'?'Assistant · Progress':'Assistant';
   message.append(el('summary',`${label}：${m.preview||m.text.replace(/\s+/g,' ').slice(0,180)}`),el('pre',m.text),el('small',date(m.timestamp)+' · Log line '+m.line));block.append(message);
  });return block;
 }));
 if(!turns.length)container.append(el('p',s?'No linked turns yet.':'Select a conversation to see details.'));
 if(s?.unattributedMessages?.length){const d=el('details');d.append(el('summary','Unlinked historical messages (no token allocation)'));s.unattributedMessages.forEach(m=>d.append(el('pre',m.role+'：'+m.text)));container.append(d)}
}
const metricLabels={total_tokens:'Total tokens',uncached:'Uncached input',output_tokens:'Output tokens',cached_input_tokens:'Cache read',reasoning_output_tokens:'Reasoning output'};
function renderBars(id,rows,onSelect){
 const key=$('metric').value;
 const list=rows.map(r=>({...r,value:UsageCharts.metric(r.usage,key)}));
 if($('chartSort').value==='usage')list.sort((a,b)=>(b.value??-1)-(a.value??-1));
 const max=Math.max(0,...list.map(r=>r.value??0));
 const nodes=list.map(r=>{
  const row=el(onSelect?'button':'div',null,'bar-row'+(r.active?' active':''));
  if(onSelect){row.type='button';row.disabled=loading;row.onclick=()=>onSelect(r.id);}
  row.setAttribute('aria-label',`${r.label}，${metricLabels[key]} ${fmt(r.value)}，${r.meta||''}`);
  const head=el('div',null,'bar-head');head.append(el('span',r.label,'bar-title'),el('strong',r.value===null?'Not recorded':fmt(r.value)));
  const track=el('div',null,'bar-track');track.setAttribute('aria-hidden','true');
  UsageCharts.segments(r.usage,key).forEach(segment=>{const bar=el('span',null,'bar-segment '+segment.kind);bar.style.width=(max?segment.value/max*100:0)+'%';track.append(bar)});
  row.title=`${r.label}\n${metricLabels[key]}：${fmt(r.value)}\n${r.meta||''}`;
  row.append(head,track,el('span',r.meta||'','bar-meta'));return row;
 });
 $(id).replaceChildren(...nodes);
 if(!nodes.length)$(id).append(el('p','No recorded data yet.','note'));
}
function renderCharts(){
 if(!snapshot)return;
 const s=snapshot.selected,turns=s?.turns||[];
 const names=models=>(models||[]).map(m=>m.model).join(' / ')||'Unknown model';
 renderBars('sessionChart',snapshot.sessions.map(t=>({id:t.id,label:t.title||'Untitled conversation',usage:t.observedUsage||{},meta:names(t.models),active:t.id===selected})),async id=>{
  if(loading)return;selected=id;account=null;fragment.set('thread',id);history.replaceState(null,'','#'+fragment);
  if(await refresh())$('turnChartTitle').scrollIntoView({behavior:'smooth',block:'start'});
 });
 $('turnChartTitle').textContent=s?`${s.title} · Usage per turn`:'Select a conversation to view turns';
 renderBars('turnChart',turns.map((t,i)=>({id:t.id,label:`Turn ${i+1} · ${t.preview||'No user message recorded'}`,usage:t.usage,meta:`${names(t.models)} · ${t.records} calls / intervals`})),id=>{
  const target=[...$('conversations').children].find(d=>d.dataset.key===selected+':'+id);
  if(target){target.open=true;target.scrollIntoView({behavior:'smooth',block:'start'});target.querySelector('summary')?.focus();}
 });
 renderBars('modelChart',(s?.models||[]).map(m=>({label:m.model,usage:m.usage,meta:`${m.records} calls / intervals`})),null);
 const ratio=UsageCharts.cacheRatio(s?.observedUsage);
 const ranked=turns.map((t,i)=>({t,i,value:UsageCharts.metric(t.usage,$('metric').value)})).filter(r=>r.value!==null).sort((a,b)=>b.value-a.value);
 const highest=ranked[0];
 const notes=[['Recorded turns',String(turns.length)],['Input cache share',ratio===null?'Not recorded':(ratio*100).toFixed(1)+'%'],['Highest selected metric',highest?`Turn ${highest.i+1} · ${fmt(highest.value)}`:'Not recorded']];
 $('insights').replaceChildren(...notes.map(([label,value])=>{const d=el('div');d.append(el('span',label),el('strong',value));return d}));
}
$('metric').onchange=renderCharts;
$('chartSort').onchange=renderCharts;
function localWindows(v){return ['primary','secondary'].flatMap(w=>{const a=v?.[w];if(!a)return [];const used=a.used_percent;return [{limitId:v.limit_id||'unknown',window:w,remainingPercent:typeof used==='number'?Math.max(0,Math.min(100,100-used)):null,windowDurationMins:a.window_minutes,resetsAt:a.resets_at}]});}
function renderLimits(){
 const local=snapshot?.selected?.localLimits;
 const live=account&&account.limits!=null;
 const windows=live?account.windows:localWindows(local?.snapshot);
 const source=live?'Account snapshot · '+date(account.fetchedAt):'Local historical snapshot · '+date(local?.observedAt);
 $('limits').replaceChildren();
 if(!windows.length)$('limits').append(el('p','Allowance unavailable: '+(account?Object.values(account.errors).join('；')||'No limit windows returned':'Not queried; no local limit snapshot available')));
 windows.forEach(w=>{const n=el('div',null,'limit');n.append(el('span',`${w.limitId} / ${w.windowDurationMins==null?'Unknown':fmt(w.windowDurationMins)}-minute window`),el('strong',w.remainingPercent==null?'Remaining allowance unavailable':`Left ${fmt(w.remainingPercent)}%`));if(w.remainingPercent!=null){const p=el('progress');p.max=100;p.value=w.remainingPercent;n.append(p)}n.append(el('p',`Resets ${date(w.resetsAt)}`),el('small',source));if(w.resetsAt&&w.resetsAt*1000<Date.now())n.append(el('p','Snapshot is past its reset time; refresh allowance'));$('limits').append(n)});
 if(account&&Object.keys(account.errors).length&&windows.length)$('limits').append(el('p','Query status: '+Object.values(account.errors).join('；')));
 $('accountUsage').replaceChildren();
 if(account){$('accountUsage').append(el('p','Account lifetime tokens: '+fmt(account.usage?.summary?.lifetimeTokens)+' · Separate from local subtotal; do not add together'));
 const e=account.threadEstimate?.threadUsage;if(e)$('accountUsage').append(el('p',`Account conversation estimate: ${e.estimatedUsageCreditsMicros==null?'Unavailable':fmt(Number(e.estimatedUsageCreditsMicros)/1e6)} credits；USD ${e.estimatedUsageUsdMicros==null?'Unavailable':fmt(Number(e.estimatedUsageUsdMicros)/1e6)}. Estimate only, not the final bill.`));else $('accountUsage').append(el('p','Conversation estimate unavailable: no selection, unsupported version, or no API data.'));
 const buckets=account.usage?.dailyUsageBuckets;if(buckets?.length){const details=el('details');details.append(el('summary','Account daily tokens ('+buckets.length+' days)'),el('pre',JSON.stringify(buckets,null,2)));$('accountUsage').append(details)}
 $('raw').textContent=JSON.stringify(account,null,2);}else $('raw').textContent='Not queried';
}
async function refresh(){
 if(loading)return;loading=true;$('refresh').disabled=true;$('threads').disabled=true;$('loadMore').disabled=true;
 try{snapshot=await api('/api/snapshot');if(!selected&&snapshot.selectedId){selected=snapshot.selectedId;fragment.set('thread',selected);history.replaceState(null,'','#'+fragment)}render();return true}
 catch(e){$('status').textContent=e.message;return false}
 finally{loading=false;$('refresh').disabled=false;$('threads').disabled=false;$('loadMore').disabled=!snapshot?.pagination?.hasMore||sessionLimit>=1000;document.querySelectorAll('button.bar-row').forEach(b=>b.disabled=false)}
}
$('loadMore').onclick=async()=>{if(loading)return;const old=sessionLimit;sessionLimit=Math.min(sessionLimit+3,1000);if(!await refresh())sessionLimit=old};
$('threads').onchange=()=>{selected=$('threads').value;account=null;fragment.set('thread',selected);history.replaceState(null,'','#'+fragment);refresh()};
$('refresh').onclick=refresh;
$('account').onclick=async()=>{$('account').disabled=true;$('account').textContent='Checking…';const atStart=selected;try{const value=await api('/api/account');if(atStart===selected){account=value;renderLimits()}}catch(e){$('status').textContent=e.message}finally{$('account').disabled=false;$('account').textContent='Check account allowance'}};
$('export').onclick=()=>{if(!snapshot)return;const blob=new Blob([JSON.stringify({snapshot,account},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download='codex-usage.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
if(location.protocol==='file:'){$('status').textContent='Run python3 meter.py serve, then open the local URL printed in the terminal. Opening the HTML file directly cannot read conversations.';['refresh','loadMore','account','threads','auto','export'].forEach(id=>$(id).disabled=true)}else{setInterval(()=>{if($('auto').checked)refresh()},10000);refresh();}
