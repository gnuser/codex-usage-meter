/* Optional public-post view. All remote data is treated as plain text. */
(() => {
  'use strict';
  document.getElementById('tibo').hidden = false;
  const key = new URLSearchParams(location.hash.slice(1)).get('key');
  const button = document.getElementById('tiboToggle');
  const details = document.getElementById('tiboDetails');
  let expanded = false,
    busy = false,
    lastRead = 0,
    data = null;
  const text = (tag, value) => {
    const element = document.createElement(tag);
    element.textContent = value;
    return element;
  };
  const date = (stamp) => (stamp ? new Date(stamp * 1000).toLocaleString('en-US') : 'Not fetched yet');
  function render() {
    button.textContent = 'Tibo · ' + (data?.signal?.label || 'Loading') + (expanded ? ' ▾' : ' ▸');
    button.setAttribute('aria-expanded', String(expanded));
    details.hidden = !expanded;
    const rows = [
      text('p', (data?.source || 'Chrome') + ' · Latest three original posts'),
      text('p', 'Updated: ' + date(data?.fetchedAt)),
    ];
    if (data?.error) rows.push(text('p', data.error));
    rows.push(text('p', data?.signal?.timeHint || 'Time unknown'));
    if (data?.signal?.reason) rows.push(text('p', data.signal.reason));
    for (const post of data?.posts || []) {
      const item = text('article', '');
      const link = text('a', date(post.publishedAt) + ' · View post ↗');
      link.href = 'https://x.com/thsottiaux/status/' + post.id;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.onclick = async (event) => {
        const bridge = window.webkit?.messageHandlers?.usageControl;
        if (bridge) {
          event.preventDefault();
          bridge.postMessage({ action: 'openPost', url: link.href });
        } else if (window.pywebview?.api?.open_post) {
          event.preventDefault();
          try {
            await window.pywebview.api.open_post(link.href);
          } catch {
            button.textContent = 'Tibo · Could not open post';
          }
        }
      };
      item.append(link, text('p', post.text));
      rows.push(item);
    }
    if (!data?.posts?.length) rows.push(text('p', 'No verified posts yet.'));
    details.replaceChildren(...rows);
  }
  button.onclick = () => {
    expanded = !expanded;
    render();
  };
  window.refreshTibo = async () => {
    if (!key || busy || Date.now() - lastRead < 30000) return;
    busy = true;
    lastRead = Date.now();
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch('/api/tibo', {
        headers: { Authorization: 'Bearer ' + key },
        signal: controller.signal,
      });
      if (!response.ok) throw Error('Unavailable');
      data = await response.json();
    } catch {
      data = {
        ...data,
        error: 'Could not read local status',
        signal: { label: 'Awaiting data · No prediction', timeHint: 'Time unknown' },
      };
    } finally {
      busy = false;
      clearTimeout(timer);
      render();
    }
  };
  const tick = () => {
    if (!document.hidden) window.refreshTibo();
    setTimeout(tick, 30000);
  };
  tick();
})();
