/* Optional public-post view. All remote data is treated as plain text. */
(() => {
  'use strict';
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
  const date = (stamp) => (stamp ? new Date(stamp * 1000).toLocaleString('zh-CN') : '尚未成功读取');
  function render() {
    button.textContent = 'Tibo · ' + (data?.signal?.label || '读取中') + (expanded ? ' ▾' : ' ▸');
    button.setAttribute('aria-expanded', String(expanded));
    details.hidden = !expanded;
    const rows = [
      text('p', (data?.source || 'Chrome') + ' · 最近三条主题帖子'),
      text('p', '更新：' + date(data?.fetchedAt)),
    ];
    if (data?.error) rows.push(text('p', data.error));
    rows.push(text('p', data?.signal?.timeHint || '时间未知'));
    if (data?.signal?.reason) rows.push(text('p', data.signal.reason));
    for (const post of data?.posts || []) {
      const item = text('article', '');
      const link = text('a', date(post.publishedAt) + ' · 原文 ↗');
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
            button.textContent = 'Tibo · 原文打开失败';
          }
        }
      };
      item.append(link, text('p', post.text));
      rows.push(item);
    }
    if (!data?.posts?.length) rows.push(text('p', '尚无可验证的动态；不会使用旧搜索结果填充。'));
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
        error: '本地状态读取失败',
        signal: { label: '数据待更新 · 暂不预测', timeHint: '时间未知' },
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
