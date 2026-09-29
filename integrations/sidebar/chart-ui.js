// Injected alongside the popover; all text is data, never HTML.
function createUsageCharts(el) {
  const style = el('style');
  style.textContent = `
    #codex-usage-tooltip .up-bars { width:40px; height:23px; display:flex; align-items:flex-end; gap:2px; flex-shrink:0; }
    #codex-usage-tooltip .up-turn { flex:1; height:100%; display:flex; align-items:flex-end; cursor:help; }
    #codex-usage-tooltip .up-bar-tip { position:fixed; z-index:2147483001; pointer-events:none; padding:6px 8px; border:1px solid #8885; border-radius:6px; background:#202322; color:#f2f5f3; font:11px/1.4 -apple-system,BlinkMacSystemFont,sans-serif; white-space:pre-line; box-shadow:0 3px 10px #0004; }
    #codex-usage-tooltip .up-bar-tip[hidden] { display:none; }
    #codex-usage-tooltip .up-bars i { width:100%; background:var(--tip-normal); border-radius:2px 2px 0 0; }
    #codex-usage-tooltip .up-daily { margin-top:8px; border-top:1px solid #8883; padding-top:7px; }
    #codex-usage-tooltip .up-daily summary { display:flex; justify-content:space-between; cursor:pointer; font-size:11px; list-style:none; }
    #codex-usage-tooltip .up-daily summary::-webkit-details-marker { display:none; }
    #codex-usage-tooltip .up-daily-summary { color:var(--tip-info); }
    #codex-usage-tooltip .up-daily-bars { display:flex; align-items:flex-end; gap:4px; height:22px; margin-top:5px; }
    #codex-usage-tooltip .up-day { flex:1; height:100%; display:flex; align-items:flex-end; cursor:help; }
    #codex-usage-tooltip .up-day i { width:100%; background:var(--tip-info); border-radius:2px 2px 0 0; opacity:.6; }
    #codex-usage-tooltip .up-day[data-missing="true"] i { background:#8885; height:2px !important; }
    #codex-usage-tooltip .up-day:last-child i { opacity:1; }
    #codex-usage-tooltip .up-daily-note { font-size:10px; opacity:.6; margin-top:3px; }
    #codex-usage-tooltip .up-daily-values { font-size:11px; padding-top:5px; font-variant-numeric:tabular-nums; }
  `;
  const daily = el('div', null, 'up-daily');
  const dailyDetails = el('details');
  const dailyHeading = el('summary');
  const dailyToday = el('span', 'Today —', 'up-daily-summary');
  dailyHeading.append(el('span', 'Daily tokens · 7d'), dailyToday);
  const dailyValues = el('div', null, 'up-daily-values');
  dailyDetails.append(dailyHeading, dailyValues);
  const dailyBars = el('div', null, 'up-daily-bars');
  const dailyNote = el('div', null, 'up-daily-note');
  daily.append(dailyDetails, dailyBars, dailyNote);
  daily.append(style);
  const barTip = el('div', null, 'up-bar-tip');
  barTip.hidden = true; barTip.setAttribute('role', 'tooltip');
  const hide = () => { barTip.hidden = true; };
  let dailySignature = '';
  function describeBar(bar, label, tokens, formatted) {
    const text = label + '\n' + (tokens == null ? 'Not reported' : (formatted || '—') + ' tokens');
    bar.setAttribute('aria-label', text);
    bar.tabIndex = 0;
    const show = () => {
      barTip.textContent = text; barTip.hidden = false;
      const rect = bar.getBoundingClientRect();
      barTip.style.left = Math.max(8, Math.min(rect.left, innerWidth - barTip.offsetWidth - 8)) + 'px';
      const top = rect.top - barTip.offsetHeight - 6;
      barTip.style.top = Math.max(8, top < 8 ? Math.min(rect.bottom + 6, innerHeight - barTip.offsetHeight - 8) : top) + 'px';
    };
    bar.onmouseenter = show; bar.onmouseleave = hide;
    bar.onfocus = show; bar.onblur = hide;
  }
  function renderTurns(container, usage) {
    hide();
    const values = usage?.bars || [], max = Math.max(1, ...values.map(n => n ?? 0));
    container.replaceChildren(...values.map((n, index) => {
      const bar = el('span', null, 'up-turn'), fill = el('i');
      fill.style.height = (n == null ? 2 : Math.max(2, n / max * 23)) + 'px';
      if (n == null) fill.style.opacity = '.25';
      describeBar(bar, usage?.barLabels?.[index] || 'Recent turn ' + (index + 1), n, usage?.barTexts?.[index]);
      bar.append(fill); return bar;
    }));
  }
  function update(dailyData) {
    const nextDaily = JSON.stringify(dailyData || null);
    if (nextDaily !== dailySignature) {
      dailySignature = nextDaily; barTip.hidden = true;
      dailyToday.textContent = 'Today ' + (dailyData?.todayText || '—');
      const days = dailyData?.days || [];
      const max = Math.max(1, ...days.map(d => d.tokens || 0));
      dailyBars.replaceChildren(...days.map(day => {
        const bar = el('span', null, 'up-day');
        bar.setAttribute('data-missing', String(day.tokens === null));
        describeBar(bar, day.date, day.tokens, day.text);
        const fill = el('i'); fill.style.height = (day.tokens === null ? 2 : Math.max(2, day.tokens / max * 22)) + 'px';
        bar.append(fill); return bar;
      }));
      dailyValues.replaceChildren(...days.map(day => {
        const row = el('div', null, 'up-line');
        row.append(el('span', day.date.slice(5)), el('span', day.tokens === null ? 'Not reported' : day.text));
        return row;
      }));
      const latest = dailyData?.latest;
      dailyNote.textContent = !dailyData?.available ? 'Account usage unavailable' :
        latest && latest.date !== dailyData.today ? 'Latest ' + latest.date.slice(5) + ' · ' + latest.text + ' tokens · Today pending' :
        'Account-reported dates · May be delayed';
      dailyNote.title = 'Official account usage; dates are preserved as reported. Missing days are not treated as zero. Today uses your local calendar date.';
    }
  }
  return { daily, tip: barTip, update, renderTurns, hide };
}
