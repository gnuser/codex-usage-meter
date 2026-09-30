function installUsageBadge(createPopover, createCharts) {
  const VERSION = 'usage-meter-48-3';
  const KEY = '__codexUsageBadge';
  if (window[KEY]?.version === VERSION) {
    window[KEY].place();
    return;
  }
  window[KEY]?.destroy?.();
  const badge = document.createElement('div');
  badge.id = 'codex-usage-badge';
  badge.tabIndex = 0;
  badge.setAttribute('role', 'meter');
  badge.setAttribute('aria-valuemin', '0');
  badge.setAttribute('aria-valuemax', '100');
  badge.setAttribute('aria-controls', 'codex-usage-tooltip');
  badge.setAttribute('aria-haspopup', 'dialog');
  function meterMarkup(suffix = '') {
    return `<svg class="usage-ring" viewBox="0 0 36 36" aria-hidden="true">
    <defs><linearGradient id="codex-usage-ring-gradient${suffix}" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop class="usage-gradient-start" offset="0%"/><stop class="usage-gradient-end" offset="100%"/>
    </linearGradient></defs>
    <circle class="usage-ring-track" cx="18" cy="18" r="14"/>
    <circle class="usage-ring-value" cx="18" cy="18" r="14" pathLength="100"/>
  </svg><span class="usage-number">—</span><span class="usage-window"></span><span class="usage-reset"></span>`;
  }
  const primaryMeter = document.createElement('div');
  primaryMeter.className = 'usage-primary';
  primaryMeter.innerHTML = meterMarkup();
  const secondaryMeter = document.createElement('div');
  secondaryMeter.className = 'usage-secondary';
  secondaryMeter.innerHTML = meterMarkup('-weekly');
  secondaryMeter.hidden = true;
  badge.append(primaryMeter, secondaryMeter);
  const tooltip = document.createElement('div');
  tooltip.id = 'codex-usage-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  tooltip.hidden = true;
  const style = document.createElement('style');
  style.id = 'codex-usage-badge-style';
  const darkPalette = `
      --usage-normal-color: #72bda0; --usage-normal-soft: #72bda0; --usage-normal-track: #1c6349; --usage-normal-glow: #0be38c1a;
      --usage-warning-color: #d6b477; --usage-warning-soft: #d6b477; --usage-warning-track: #69522e; --usage-warning-glow: #ffb53c16;
      --usage-danger-color: #ff9587; --usage-danger-soft: #e76964; --usage-danger-track: #683e3b; --usage-danger-glow: #ff746516;
      --usage-muted-color: #9caaa2; --usage-muted-soft: #7b8981; --usage-muted-track: #505853; --usage-muted-glow: transparent;
      --usage-text: #f5f7f5; --usage-label: #b6bbb7;
      --usage-border: #ffffff17; --usage-border-hover: #ffffff29;
      --usage-surface: linear-gradient(145deg, #414341 0%, #292b29 52%, #363936 100%);
      --usage-shadow: inset 0 1px 1px #ffffff12, inset 0 -1px 1px #0002, 0 2px 5px #0002;
  `;
  style.textContent = `
    #codex-usage-badge {
      --usage-normal-color: #0b805b; --usage-normal-soft: #168e65; --usage-normal-track: #d7e7df; --usage-normal-glow: #168e6508;
      --usage-warning-color: #9e6c14; --usage-warning-soft: #b8811c; --usage-warning-track: #efe5cf; --usage-warning-glow: #b8811c08;
      --usage-danger-color: #bc4744; --usage-danger-soft: #d45d56; --usage-danger-track: #f1ddda; --usage-danger-glow: #d45d5608;
      --usage-muted-color: #77858e; --usage-muted-soft: #8c979f; --usage-muted-track: #e0e5e8; --usage-muted-glow: transparent;
      --usage-text: #25313a; --usage-label: #65737c;
      --usage-border: #52647424; --usage-border-hover: #52647440;
      --usage-surface: linear-gradient(145deg, #fcfdfd 0%, #f3f5f6 52%, #e9eef0 100%);
      --usage-shadow: inset 0 1px 0 #fff, inset 0 -1px 1px #23324008, 0 2px 5px #26384712;
      --usage-color: var(--usage-normal-color); --usage-soft: var(--usage-normal-soft);
      --usage-ring-track: var(--usage-normal-track); --usage-glow: var(--usage-normal-glow);
      --usage-ring-size: 28px;
      position: relative; box-sizing: border-box; width: 38px; max-width: 100%; min-width: 0; flex: 0 0 auto; contain: inline-size;
      align-self: center; margin: 4px 0; padding: 8px 3px;
      display: flex; flex-direction: column; align-items: center; gap: 10px;
      border: 1px solid var(--usage-border); border-radius: 20px; outline: none; color: var(--usage-text);
      background: color-mix(in srgb, var(--usage-text) 3%, transparent); box-shadow: none;
      cursor: default; user-select: none;
      -webkit-app-region: no-drag; font-family: inherit;
      font-variant-numeric: tabular-nums; line-height: 1;
    }
    #codex-usage-badge[hidden], #codex-usage-tooltip[hidden] { display: none !important; }
    #codex-usage-badge .usage-secondary[hidden] { display: none !important; }
    #codex-usage-badge .usage-primary, #codex-usage-badge .usage-secondary {
      --usage-color: var(--usage-normal-color); --usage-soft: var(--usage-normal-soft);
      --usage-ring-track: var(--usage-normal-track); --usage-glow: var(--usage-normal-glow);
      position: relative; box-sizing: border-box; flex: 0 0 auto; width: 100%; min-width: 0;
      display: flex; flex-direction: column; align-items: center; gap: 3px;
    }
    #codex-usage-badge:hover { border-color: var(--usage-border-hover); }
    #codex-usage-badge:focus-visible { outline: 1px solid var(--usage-color); outline-offset: 2px; }
    #codex-usage-badge .usage-ring {
      display: block; flex: 0 0 auto;
      width: var(--usage-ring-size); height: var(--usage-ring-size); overflow: visible;
    }
    #codex-usage-badge .usage-ring circle { fill: none; stroke-width: 3; }
    #codex-usage-badge .usage-ring-track { stroke: var(--usage-ring-track); }
    #codex-usage-badge .usage-gradient-start { stop-color: var(--usage-soft); }
    #codex-usage-badge .usage-gradient-end { stop-color: var(--usage-color); }
    #codex-usage-badge .usage-ring-value {
      stroke: url(#codex-usage-ring-gradient); stroke-linecap: round;
      transform: rotate(-90deg); transform-origin: 18px 18px;
      stroke-dasharray: 100; stroke-dashoffset: 100; opacity: 0;
      filter: drop-shadow(0 0 2px var(--usage-glow));
      transition: stroke-dashoffset 240ms ease;
    }
    #codex-usage-badge .usage-secondary .usage-ring-value { stroke: url(#codex-usage-ring-gradient-weekly); }
    #codex-usage-badge .usage-number { font-size: 11px; line-height: 14px; font-weight: 550; white-space: nowrap; }
    #codex-usage-badge .usage-window { font-size: 9px; line-height: 12px; color: var(--usage-label); white-space: nowrap; }
    #codex-usage-badge .usage-reset { font-size: 9px; line-height: 12px; color: var(--usage-label); opacity: .75; white-space: nowrap; }
    #codex-usage-badge[data-tone="warning"], #codex-usage-badge .usage-primary[data-tone="warning"], #codex-usage-badge .usage-secondary[data-tone="warning"] { --usage-color: var(--usage-warning-color); --usage-soft: var(--usage-warning-soft); --usage-ring-track: var(--usage-warning-track); --usage-glow: var(--usage-warning-glow); }
    #codex-usage-badge[data-tone="danger"], #codex-usage-badge .usage-primary[data-tone="danger"], #codex-usage-badge .usage-secondary[data-tone="danger"] { --usage-color: var(--usage-danger-color); --usage-soft: var(--usage-danger-soft); --usage-ring-track: var(--usage-danger-track); --usage-glow: var(--usage-danger-glow); }
    #codex-usage-badge[data-tone="muted"], #codex-usage-badge .usage-primary[data-tone="muted"], #codex-usage-badge .usage-secondary[data-tone="muted"] { --usage-color: var(--usage-muted-color); --usage-soft: var(--usage-muted-soft); --usage-ring-track: var(--usage-muted-track); --usage-glow: var(--usage-muted-glow); }
    html.dark #codex-usage-badge, html[data-theme="dark"] #codex-usage-badge { ${darkPalette} }
    @media (prefers-color-scheme: dark) {
      html:not(.light):not([data-theme="light"]) #codex-usage-badge { ${darkPalette} }
    }
    #codex-usage-tooltip {
      box-sizing: border-box; position: fixed; z-index: 2147483000;
      width: 264px; max-width: calc(100vw - 16px); padding: 10px 12px;
      --tip-normal: #237354; --tip-info: #2768a8; --tip-warning: #94600c; --tip-danger: #b43b35;
      border: 1px solid color-mix(in srgb, currentColor 12%, transparent); border-radius: 10px;
      background: var(--color-surface-elevated-secondary, #f8f8f7);
      color: var(--color-text-primary, #303630);
      box-shadow: 0 4px 18px #0002; pointer-events: none;
      font: 12px/1.4 -apple-system, BlinkMacSystemFont, sans-serif;
      white-space: pre-line; -webkit-app-region: no-drag;
    }
    #codex-usage-tooltip .tip-row { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 2px 12px; padding: 3px 0; white-space: normal; }
    #codex-usage-tooltip .tip-label { opacity: .65; }
    #codex-usage-tooltip .tip-value { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
    #codex-usage-tooltip .tip-note { grid-column: 1 / -1; text-align: right; opacity: .7; font-size: 11px; overflow-wrap: anywhere; }
    #codex-usage-tooltip .tip-group { border-top: 1px solid color-mix(in srgb, currentColor 12%, transparent); margin-top: 5px; padding-top: 7px; }
    #codex-usage-tooltip .tip-footer { font-size: 10px; margin-top: 5px; opacity: .65; }
    #codex-usage-tooltip [data-tone="normal"] .tip-value { color: var(--tip-normal); }
    #codex-usage-tooltip [data-tone="info"] .tip-value { color: var(--tip-info); }
    #codex-usage-tooltip [data-tone="warning"] .tip-value { color: var(--tip-warning); }
    #codex-usage-tooltip [data-tone="danger"] .tip-value { color: var(--tip-danger); }
    html.dark #codex-usage-tooltip, html[data-theme="dark"] #codex-usage-tooltip {
       --tip-normal: #82cbaa; --tip-info: #93bdf4; --tip-warning: #e9bd78; --tip-danger: #ff9587;
      background: var(--color-surface-elevated-secondary, #2c2e2c);
      color: var(--color-text-primary, #edf0ed);
    }
    @media (prefers-color-scheme: dark) {
      html:not(.light):not([data-theme="light"]) #codex-usage-tooltip {
         --tip-normal: #82cbaa; --tip-info: #93bdf4; --tip-warning: #e9bd78; --tip-danger: #ff9587;
      background: var(--color-surface-elevated-secondary, #2c2e2c); color: var(--color-text-primary, #edf0ed);
      }
    }
    @media (prefers-reduced-motion: reduce) { #codex-usage-badge .usage-ring-value { transition: none; } }
  `;
  let value = { percent: null, title: 'Reading Codex allowance', tone: 'muted', windowLabel: '', mode: 'single', rings: null };
  let placementTimer = null;
  let hoverTimer = null;
  let rail = null;
  let disposed = false;
  // A dead agent must not leave a healthy-looking quota indefinitely.
  function expireValue() {
    if (disposed || value.stale || !Number.isFinite(value.updatedAt) || Date.now() - value.updatedAt < 150000) return;
    value = { ...value, stale: true, percent: null, tone: 'muted', title: 'Allowance is stale; reconnecting',
      rings: value.rings?.map(ring => ({ ...ring, percent: null, tone: 'muted', title: `${ring.label}：Unavailable` })) ?? null };
    render();
  }
  const freshnessTimer = setInterval(() => { expireValue(); render(); }, 1000);
  const visible = (el) => {
    if (!el?.isConnected) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  };
  let pinned = false;
  const popover = createPopover(tooltip, () => { pinned = false; popover.setPinned(false); badge.focus(); hideTooltip(); }, togglePinned, createCharts);
  function togglePinned() {
    pinned = !pinned; popover.setPinned(pinned);
    if (pinned) showTooltip(); else hideTooltip();
  }
  function scheduleHide() {
    clearTimeout(hoverTimer);
    if (!pinned) hoverTimer = setTimeout(hideTooltip, 250);
  }
  function hideTooltip() {
    clearTimeout(hoverTimer);
    hoverTimer = null;
    tooltip.hidden = true;
    popover.hideTips();
    badge.setAttribute('aria-expanded', 'false');
  }
  function positionTooltip() {
    const r = badge.getBoundingClientRect();
    tooltip.style.left = `${Math.max(8, Math.min(r.right + 12, innerWidth - tooltip.offsetWidth - 8))}px`;
    tooltip.style.top = `${Math.max(8, Math.min(r.top, innerHeight - tooltip.offsetHeight - 8))}px`;
  }
  function showTooltip() {
    clearTimeout(hoverTimer);
    if (!visible(badge) || document.hidden || disposed) return;
    tooltip.hidden = false;
    badge.setAttribute('aria-expanded', 'true');
    positionTooltip();
  }
  function scheduleTooltip() {
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(showTooltip, 350);
  }
  function daysUntil(timestamp) {
    return value.stale || !Number.isFinite(timestamp) || timestamp <= 0 ? '—' : `${(Math.max(0, timestamp * 1000 - Date.now()) / 86400000).toFixed(1)}d`;
  }
  function renderMeter(element, meter, accessible = true) {
    const percent = Number.isFinite(meter.percent) ? Math.max(0, Math.min(100, Math.round(meter.percent))) : null;
    const number = percent === null ? '—' : `${percent}%`;
    element.dataset.tone = meter.tone;
    if (element.querySelector('.usage-window').textContent !== meter.label) element.querySelector('.usage-window').textContent = meter.label;
    if (element.querySelector('.usage-number').textContent !== number) element.querySelector('.usage-number').textContent = number;
    const remaining = Number.isFinite(meter.resetsAt) ? meter.resetsAt * 1000 - Date.now() : null;
    const countdown = daysUntil(meter.resetsAt);
    const reset = element.querySelector('.usage-reset');
    if (reset.textContent !== countdown) reset.textContent = countdown;
    reset.setAttribute('aria-label', countdown === '—' ? 'Reset time unavailable' : remaining <= 0 ? 'Reset due; awaiting updated allowance' : `Resets in ${countdown}`);
    const ring = element.querySelector('.usage-ring-value');
    ring.style.strokeDashoffset = String(100 - (percent ?? 0));
    ring.style.opacity = percent !== null && percent > 0 ? '1' : '0';
    if (accessible) {
      element.setAttribute('role', 'meter');
      element.setAttribute('aria-label', meter.label);
      element.setAttribute('aria-valuemin', '0'); element.setAttribute('aria-valuemax', '100');
      element.setAttribute('aria-valuetext', meter.title);
      if (percent === null) element.removeAttribute('aria-valuenow');
      else element.setAttribute('aria-valuenow', String(percent));
    } else {
      for (const attr of ['role', 'aria-label', 'aria-valuemin', 'aria-valuemax', 'aria-valuenow', 'aria-valuetext']) element.removeAttribute(attr);
    }
  }
  function render() {
    const dual = value.mode === 'dual' && value.rings?.length === 2;
    const percent = Number.isFinite(value.percent) ? Math.max(0, Math.min(100, Math.round(value.percent))) : null;
    badge.dataset.mode = dual ? 'dual' : 'single';
    badge.dataset.tone = dual ? value.rings[0].tone : value.tone;
    secondaryMeter.hidden = !dual;
    renderMeter(primaryMeter, dual ? value.rings[0] : {
      ...value, label: value.windowLabel || 'Usage'
    }, dual);
    if (dual) renderMeter(secondaryMeter, value.rings[1]);
    badge.setAttribute('role', dual ? 'group' : 'meter');
    badge.setAttribute('aria-label', 'Codex remaining allowance');
    if (dual) {
      for (const attr of ['aria-valuemin', 'aria-valuemax', 'aria-valuenow', 'aria-valuetext']) badge.removeAttribute(attr);
    } else {
      badge.setAttribute('aria-valuemin', '0'); badge.setAttribute('aria-valuemax', '100');
      badge.setAttribute('aria-valuetext', value.title);
      if (percent === null) badge.removeAttribute('aria-valuenow');
      else badge.setAttribute('aria-valuenow', String(percent));
    }
    popover.update(value);
  }
  function place() {
    if (disposed || !document.body) return;
    if (!style.isConnected) (document.head ?? document.documentElement).appendChild(style);
    if (!tooltip.isConnected) document.body.appendChild(tooltip);
    const nextRail = [...document.querySelectorAll('nav[data-app-navigation-rail]')].find(visible)
      ?? [...document.querySelectorAll('aside[data-app-shell-left-panel-appearance] nav')]
        .find(el => visible(el) && el.getBoundingClientRect().width <= 96);
    if (rail !== nextRail) {
      if (rail) resizeObserver.unobserve(rail);
      rail = nextRail ?? null;
      if (rail) resizeObserver.observe(rail);
    }
    // The current app places its help/profile footer after the flexible navigation list.
    // Own a sibling before that footer; do not reparent any React-owned elements.
    const footer = rail && [...rail.children].filter(el => el !== badge && visible(el) && getComputedStyle(el).position !== 'absolute').at(-1);
    if (!rail || !footer) {
      badge.hidden = true;
      hideTooltip();
      return;
    }
    badge.hidden = false;
    if (badge.parentElement !== rail || badge.nextElementSibling !== footer) rail.insertBefore(badge, footer);
    if (!tooltip.hidden) positionTooltip();
  }
  function schedulePlacement() {
    if (disposed || placementTimer !== null) return;
    placementTimer = setTimeout(() => { placementTimer = null; place(); }, 100);
  }
  const observer = new MutationObserver(records => {
    if (records.some(r => !badge.contains(r.target) && !tooltip.contains(r.target) && r.target !== style)) schedulePlacement();
  });
  const resizeObserver = new ResizeObserver(schedulePlacement);
  resizeObserver.observe(tooltip);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  badge.addEventListener('mouseenter', scheduleTooltip);
  badge.addEventListener('mouseleave', scheduleHide);
  badge.addEventListener('click', togglePinned);
  tooltip.addEventListener('mouseenter', () => clearTimeout(hoverTimer));
  tooltip.addEventListener('mouseleave', scheduleHide);
  tooltip.addEventListener('focusin', () => clearTimeout(hoverTimer));
  badge.addEventListener('focus', showTooltip);
  badge.addEventListener('blur', e => { if (!tooltip.contains(e.relatedTarget)) scheduleHide(); });
  tooltip.addEventListener('focusout', e => { if (!tooltip.contains(e.relatedTarget) && e.relatedTarget !== badge) scheduleHide(); });
  const onKeyDown = e => {
    if (e.key === 'Escape' && !tooltip.hidden) { pinned = false; popover.setPinned(false); hideTooltip(); }
    if (e.target === badge && ['Enter', ' '].includes(e.key)) { e.preventDefault(); togglePinned(); }
  };
  const onOutside = e => { if (!badge.contains(e.target) && !tooltip.contains(e.target)) { pinned = false; popover.setPinned(false); hideTooltip(); } };
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('pointerdown', onOutside);
  window.addEventListener('resize', schedulePlacement);
  document.addEventListener('visibilitychange', hideTooltip);
  window[KEY] = {
    version: VERSION,
    place,
    update(next) { value = { ...value, ...next }; expireValue(); render(); place(); },
    status() {
      return { version: VERSION, placed: badge.parentElement === rail && visible(badge) && !badge.hidden,
        percent: value.percent, windowLabel: value.windowLabel, tone: value.tone, mode: value.mode, rings: value.rings,
        updatedAt: value.updatedAt ?? null, stale: value.stale ?? false,
        badgeCount: document.querySelectorAll('#codex-usage-badge').length };
    },
    destroy() {
      disposed = true;
      observer.disconnect();
      resizeObserver.disconnect();
      clearTimeout(placementTimer);
      clearInterval(freshnessTimer);
      hideTooltip();
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onOutside);
      window.removeEventListener('resize', schedulePlacement);
      document.removeEventListener('visibilitychange', hideTooltip);
      badge.remove(); tooltip.remove(); style.remove();
      delete window[KEY];
    }
  };
  render();
  place();
}
