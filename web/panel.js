'use strict';
const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.hash.slice(1)),key=params.get('key');
const nativeControl=window.webkit?.messageHandlers?.usageControl;
const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;if(cls)el.className=cls;return el;};
const fmt=UsageCharts.compact;
let busy=false,timer,quotaBusy=false;
function status(text){$('status').textContent=text;$('status').hidden=!text;}
async function request(path,signal){const res=await fetch(path,{headers:{Authorization:'Bearer '+key},signal});if(!res.ok)throw Error('读取失败');return res.json();}
async function refresh(){
 if(busy||!key||document.hidden)return;
 busy=true;clearTimeout(timer);
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
 try{
  const data=await request('/api/threads?limit=100',controller.signal);
  const sessions=data.sessions.filter(s=>s.updatedAt*1000>=Date.now()-30*60*1000);
  const cards=[];
  for(const session of sessions){
   const card=node('article',null,'session-card');card.dataset.session=session.id;
   const link=node('a',session.title,'session-title');link.href='codex://threads/'+encodeURIComponent(session.id);link.title='打开对话：'+session.title;
   link.onclick=async e=>{
    if(nativeControl){e.preventDefault();nativeControl.postMessage({action:'openThread',thread:session.id});}
    else if(window.pywebview?.api?.open_thread){
     e.preventDefault();try{await window.pywebview.api.open_thread(session.id);}catch(error){status('无法打开对话，请确认已安装 Codex');}
    }
   };
   card.append(link);
   try{
    const payload=await request('/api/panel?'+new URLSearchParams({thread:session.id}),controller.signal),item=payload.selected;
    if(item&&item.id!==session.id)throw Error('会话不匹配');
    const turns=item?.turns||[],values=turns.map(t=>UsageCharts.metric(t.usage)),max=Math.max(0,...values.map(v=>v??0));
    const summary=node('div','本轮 '+fmt(turns.at(-1)?.usage.total_tokens)+' · 累计 '+fmt(item?.total.total_tokens),'session-totals');
    summary.title='tokens · '+(item?.warnings?.join('；')||'用量以日志记录为准');card.append(summary);
    const bars=node('div',null,'mini-bars');bars.setAttribute('aria-label','最近 10 轮用量，各会话独立缩放');
    turns.forEach((t,i)=>{const col=node('button',null,'column'+(i===turns.length-1?' latest':'')+(values[i]==null?' unknown':''));col.type='button';col.title='第 '+t.number+' 轮：'+(values[i]==null?'未记录':values[i].toLocaleString('zh-CN')+' tokens');col.setAttribute('aria-label',col.title);const fill=node('span',null,'fill');fill.style.height=(max&&values[i]!=null?values[i]/max*100:0)+'%';col.append(fill);bars.append(col);});
    card.append(bars);
   }catch(error){if(error.name==='AbortError')throw error;card.append(node('div','用量暂不可用','session-totals'));}
   cards.push(card);
  }
  $('sessionCards').replaceChildren(...cards);
  $('activityCount').textContent='活跃 '+sessions.length;
  status(sessions.length?'':'暂无活跃会话');
 }catch(error){status('更新失败 · 将重试');}
 finally{clearTimeout(timeout);busy=false;if(!document.hidden)timer=setTimeout(refresh,5000);}
}
async function refreshQuota(){
 if(quotaBusy||!key)return;quotaBusy=true;$('quotaSummary').disabled=true;
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),70000);
 try{
  const data=await request('/api/account',controller.signal);
  if(!data.windows?.length)throw Error('额度不可用');
  $('quotaSummary').textContent='剩余 '+data.windows.map(w=>{const m=w.windowDurationMins,label=m==null?'':m%1440===0?m/1440+'天':m%60===0?m/60+'h':m+'m';return label+' '+(w.resetsAt&&w.resetsAt*1000<=Date.now()?'待刷新':w.remainingPercent==null?'—':w.remainingPercent.toFixed(2)+'%');}).join(' / ');
  $('quotaSummary').title='账号共享额度 · 点击刷新\n'+data.windows.map(w=>w.limitId+(w.resetsAt?' · 重置 '+new Date(w.resetsAt*1000).toLocaleString('zh-CN'):'')).join('\n');
 }catch(error){$('quotaSummary').textContent='剩余 —';$('quotaSummary').title='额度暂不可用 · 点击重试';}
 finally{clearTimeout(timeout);quotaBusy=false;$('quotaSummary').disabled=false;}
}
$('quotaSummary').onclick=refreshQuota;
document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(!document.hidden)refresh();});
window.addEventListener('pagehide',()=>clearTimeout(timer));
if(key){refresh();refreshQuota();}else status('请重新打开面板');
