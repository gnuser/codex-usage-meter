'use strict';
const $ = id => document.getElementById(id);
const fragment = new URLSearchParams(location.hash.slice(1));
const key = fragment.get('key') || '';
let selected = fragment.get('thread') || '', snapshot = null, account = null, loading = false, sessionLimit = 1;
const fields = ['input_tokens','cached_input_tokens','cache_write_input_tokens','output_tokens','reasoning_output_tokens','total_tokens'];
const labels = ['输入','缓存读取¹','缓存写入¹','输出','推理输出²','总 token'];
const fmt = v => v == null ? '—' : Number(v).toLocaleString('zh-CN',{maximumFractionDigits:6});
const date = v => !v ? '时间未知' : new Date(typeof v === 'number' ? v * 1000 : v).toLocaleString('zh-CN');
function el(tag, text, cls) {const node=document.createElement(tag);if(text!=null)node.textContent=text;if(cls)node.className=cls;return node;}
async function api(path) {const query=new URLSearchParams();if(selected)query.set('thread',selected);if(path==='/api/snapshot'){query.set('limit',sessionLimit);if(fragment.get('scope')==='thread')query.set('scope','thread');}const r=await fetch(path+'?'+query,{headers:{Authorization:'Bearer '+key}});if(!r.ok)throw Error('本机接口返回 '+r.status+'；请重新从插件打开仪表');return r.json();}
function render() {
 const s=snapshot.selected, events=s?.events||[], last=events.at(-1), turn=s?.turns.at(-1);
 const options=snapshot.sessions; $('threads').replaceChildren(el('option','请选择会话'));$('threads').firstChild.value='';
 options.forEach(o=>{const n=el('option',(o.title||'未命名会话')+' · '+o.id.slice(0,8)+' · '+date(o.updatedAt));n.value=o.id;n.title=o.title||o.id;$('threads').append(n)});$('threads').value=selected;
 const cards=[['已加载会话小计',snapshot.observedTotal.total_tokens,'仅已加载范围，非全部本机或账号总额'],['所选会话累计',s?.total.total_tokens,'日志最后一次累计快照，可能含继承历史'],['本轮请求小计',turn?.usage.total_tokens,turn?turn.id:'请先选择会话'],['最近已记录调用',last?.lastReported.total_tokens,last?date(last.timestamp):'尚无调用记录']];
 $('cards').replaceChildren(...cards.map(([title,value,note])=>{const n=el('div',null,'card');n.append(el('span',title),el('strong',fmt(value)),el('p',note));return n}));
 $('breakdown').replaceChildren(...fields.map((f,i)=>{const n=el('div',labels[i]);n.append(el('strong',fmt(last?.lastReported[f])));return n}));
 function row(prefix,u,tail){const tr=el('tr');tr.append(prefix,...fields.map(f=>el('td',fmt(u[f]))),el('td',tail));return tr;}
 $('turns').replaceChildren(...(s?.turns||[]).slice().reverse().map(t=>{const td=el('td',t.preview||'未记录用户消息');td.title=t.preview||t.id;td.append(el('small',t.id));return row(td,t.usage,t.records)}));
 const turnMap=new Map((s?.turns||[]).map(t=>[t.id,t]));
 $('events').replaceChildren(...events.slice(-200).reverse().map(e=>{const td=el('td',date(e.timestamp));td.append(el('small',e.model||'模型未知'),el('small',turnMap.get(e.turnId)?.preview||'无法归因到单轮'));return row(td,e.usage,`行 ${e.line} · ${e.quality==='interval_delta'?'区间差额':'last 调用'}`)}));
 renderConversations(s);
 renderCharts();
 const warnings=[...snapshot.errors,...(s?.warnings||[])];if(selected&&!s)warnings.push('所选会话不在已加载范围；可继续加载或从列表选择');
 $('warnings').replaceChildren(...warnings.map(w=>el('li',w)));
 $('coverage').textContent=`读取 ${snapshot.files} 个文件 / ${snapshot.sessions.length} 个会话 / ${snapshot.observedRecords} 个去重记录。${snapshot.coverage}`;
 $('status').textContent='记录刷新于 '+date(snapshot.generatedAt)+(s?' · 来源 '+s.source:' · 请选择会话，不自动猜测当前任务');
 $('loadStatus').textContent=`已加载 ${snapshot.pagination?.loaded??snapshot.sessions.length} 个会话`;
 $('loadMore').disabled=!snapshot.pagination?.hasMore||sessionLimit>=1000;
 $('loadMore').textContent=snapshot.pagination?.hasMore?'再加载最近 3 个会话':'已加载全部会话';
 renderLimits();
}
function renderConversations(s){
 const container=$('conversations');
 const opened=new Set([...container.querySelectorAll('details[open]')].map(d=>d.dataset.key));
 const first=container.dataset.thread!==selected;container.dataset.thread=selected;
 $('conversationTitle').textContent=s?(s.title||'所选会话')+' · 对话内容与消耗':'对话内容与消耗';
 const turns=s?.turns||[];
 container.replaceChildren(...turns.map((t,index)=>{
  const block=el('details',null,'turn-detail');block.dataset.key=selected+':'+t.id;
  block.open=opened.has(block.dataset.key)||(first&&index===turns.length-1);
  const summary=el('summary',`第 ${index+1} 轮 · ${t.preview||'未记录用户消息'}`);
  summary.append(el('strong',`${fmt(t.usage.total_tokens)} tokens`));block.append(summary);
  block.append(el('p',(t.models||[]).map(m=>m.model).join(' / ')||'模型未知','model-label'));
  block.append(el('p',fields.map((f,i)=>`${labels[i]} ${fmt(t.usage[f])}`).join(' · '),'note'));
  if(!t.messages?.length)block.append(el('p','日志中未找到这一轮的消息正文。'));
  (t.messages||[]).forEach(m=>{
   const message=el('details',null,'message '+m.role);message.dataset.key=selected+':'+t.id+':'+m.line;
   message.open=opened.has(message.dataset.key);
   const label=m.role==='user'?'你':m.phase==='commentary'?'助手 · 进度':'助手';
   message.append(el('summary',`${label}：${m.preview||m.text.replace(/\s+/g,' ').slice(0,180)}`),el('pre',m.text),el('small',date(m.timestamp)+' · 日志行 '+m.line));block.append(message);
  });return block;
 }));
 if(!turns.length)container.append(el('p',s?'尚无可关联的对话轮次。':'选择一个会话后查看具体内容。'));
 if(s?.unattributedMessages?.length){const d=el('details');d.append(el('summary','无法关联到轮次的历史消息（不分摊消耗）'));s.unattributedMessages.forEach(m=>d.append(el('pre',m.role+'：'+m.text)));container.append(d)}
}
const metricLabels={total_tokens:'总 token',uncached:'非缓存输入',output_tokens:'输出 token',cached_input_tokens:'缓存读取',reasoning_output_tokens:'推理输出'};
function renderBars(id,rows,onSelect){
 const key=$('metric').value;
 const list=rows.map(r=>({...r,value:UsageCharts.metric(r.usage,key)}));
 if($('chartSort').value==='usage')list.sort((a,b)=>(b.value??-1)-(a.value??-1));
 const max=Math.max(0,...list.map(r=>r.value??0));
 const nodes=list.map(r=>{
  const row=el(onSelect?'button':'div',null,'bar-row'+(r.active?' active':''));
  if(onSelect){row.type='button';row.disabled=loading;row.onclick=()=>onSelect(r.id);}
  row.setAttribute('aria-label',`${r.label}，${metricLabels[key]} ${fmt(r.value)}，${r.meta||''}`);
  const head=el('div',null,'bar-head');head.append(el('span',r.label,'bar-title'),el('strong',r.value===null?'未记录':fmt(r.value)));
  const track=el('div',null,'bar-track');track.setAttribute('aria-hidden','true');
  UsageCharts.segments(r.usage,key).forEach(segment=>{const bar=el('span',null,'bar-segment '+segment.kind);bar.style.width=(max?segment.value/max*100:0)+'%';track.append(bar)});
  row.title=`${r.label}\n${metricLabels[key]}：${fmt(r.value)}\n${r.meta||''}`;
  row.append(head,track,el('span',r.meta||'','bar-meta'));return row;
 });
 $(id).replaceChildren(...nodes);
 if(!nodes.length)$(id).append(el('p','暂无已记录数据。','note'));
}
function renderCharts(){
 if(!snapshot)return;
 const s=snapshot.selected,turns=s?.turns||[];
 const names=models=>(models||[]).map(m=>m.model).join(' / ')||'模型未知';
 renderBars('sessionChart',snapshot.sessions.map(t=>({id:t.id,label:t.title||'未命名会话',usage:t.observedUsage||{},meta:names(t.models),active:t.id===selected})),async id=>{
  if(loading)return;selected=id;account=null;fragment.set('thread',id);history.replaceState(null,'','#'+fragment);
  if(await refresh())$('turnChartTitle').scrollIntoView({behavior:'smooth',block:'start'});
 });
 $('turnChartTitle').textContent=s?`${s.title} · 每轮消耗`:'选择会话后查看逐轮消耗';
 renderBars('turnChart',turns.map((t,i)=>({id:t.id,label:`第 ${i+1} 轮 · ${t.preview||'未记录用户消息'}`,usage:t.usage,meta:`${names(t.models)} · ${t.records} 条调用 / 区间记录`})),id=>{
  const target=[...$('conversations').children].find(d=>d.dataset.key===selected+':'+id);
  if(target){target.open=true;target.scrollIntoView({behavior:'smooth',block:'start'});target.querySelector('summary')?.focus();}
 });
 renderBars('modelChart',(s?.models||[]).map(m=>({label:m.model,usage:m.usage,meta:`${m.records} 条调用 / 区间记录`})),null);
 const ratio=UsageCharts.cacheRatio(s?.observedUsage);
 const ranked=turns.map((t,i)=>({t,i,value:UsageCharts.metric(t.usage,$('metric').value)})).filter(r=>r.value!==null).sort((a,b)=>b.value-a.value);
 const highest=ranked[0];
 const notes=[['已记录轮次',String(turns.length)],['输入缓存占比',ratio===null?'未记录':(ratio*100).toFixed(1)+'%'],['所选指标最高',highest?`第 ${highest.i+1} 轮 · ${fmt(highest.value)}`:'未记录']];
 $('insights').replaceChildren(...notes.map(([label,value])=>{const d=el('div');d.append(el('span',label),el('strong',value));return d}));
}
$('metric').onchange=renderCharts;
$('chartSort').onchange=renderCharts;
function localWindows(v){return ['primary','secondary'].flatMap(w=>{const a=v?.[w];if(!a)return [];const used=a.used_percent;return [{limitId:v.limit_id||'unknown',window:w,remainingPercent:typeof used==='number'?Math.max(0,Math.min(100,100-used)):null,windowDurationMins:a.window_minutes,resetsAt:a.resets_at}]});}
function renderLimits(){
 const local=snapshot?.selected?.localLimits;
 const live=account&&account.limits!=null;
 const windows=live?account.windows:localWindows(local?.snapshot);
 const source=live?'官方查询快照 · '+date(account.fetchedAt):'本地历史快照 · '+date(local?.observedAt);
 $('limits').replaceChildren();
 if(!windows.length)$('limits').append(el('p','剩余额度不可获取：'+(account?Object.values(account.errors).join('；')||'官方未返回限额窗口':'尚未查询官方接口，且当前无本地限额快照')));
 windows.forEach(w=>{const n=el('div',null,'limit');n.append(el('span',`${w.limitId} / ${w.windowDurationMins==null?'未知':fmt(w.windowDurationMins)} 分钟窗口`),el('strong',w.remainingPercent==null?'剩余不可获取':`剩余 ${fmt(w.remainingPercent)}%`));if(w.remainingPercent!=null){const p=el('progress');p.max=100;p.value=w.remainingPercent;n.append(p)}n.append(el('p',`重置 ${date(w.resetsAt)}`),el('small',source));if(w.resetsAt&&w.resetsAt*1000<Date.now())n.append(el('p','快照已跨过重置时间，请重新查询'));$('limits').append(n)});
 if(account&&Object.keys(account.errors).length&&windows.length)$('limits').append(el('p','查询状态：'+Object.values(account.errors).join('；')));
 $('accountUsage').replaceChildren();
 if(account){$('accountUsage').append(el('p','官方账号累计 token：'+fmt(account.usage?.summary?.lifetimeTokens)+' · 与本机小计独立，不相加'));
 const e=account.threadEstimate?.threadUsage;if(e)$('accountUsage').append(el('p',`官方会话估算：${e.estimatedUsageCreditsMicros==null?'不可获取':fmt(Number(e.estimatedUsageCreditsMicros)/1e6)} credits；USD ${e.estimatedUsageUsdMicros==null?'不可获取':fmt(Number(e.estimatedUsageUsdMicros)/1e6)}。此数为官方估算，非最终账单。`));else $('accountUsage').append(el('p','官方会话额度估算：不可获取（未选择会话、版本不支持或官方未返回）。'));
 const buckets=account.usage?.dailyUsageBuckets;if(buckets?.length){const details=el('details');details.append(el('summary','官方每日 token（'+buckets.length+' 天）'),el('pre',JSON.stringify(buckets,null,2)));$('accountUsage').append(details)}
 $('raw').textContent=JSON.stringify(account,null,2);}else $('raw').textContent='尚未查询';
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
$('account').onclick=async()=>{$('account').disabled=true;$('account').textContent='查询中…';const atStart=selected;try{const value=await api('/api/account');if(atStart===selected){account=value;renderLimits()}}catch(e){$('status').textContent=e.message}finally{$('account').disabled=false;$('account').textContent='查询官方额度'}};
$('export').onclick=()=>{if(!snapshot)return;const blob=new Blob([JSON.stringify({snapshot,account},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download='codex-usage.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
if(location.protocol==='file:'){$('status').textContent='请先运行 python3 meter.py serve，再打开终端显示的本机地址；直接打开 HTML 文件无法读取会话。';['refresh','loadMore','account','threads','auto','export'].forEach(id=>$(id).disabled=true)}else{setInterval(()=>{if($('auto').checked)refresh()},10000);refresh();}
