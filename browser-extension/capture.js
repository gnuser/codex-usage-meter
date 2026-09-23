/* Runs at document_start in the page world, on the dedicated reader URLs only. */
(() => {
  if (
    location.pathname !== "/thsottiaux" ||
    new URLSearchParams(location.search).get("codex_usage_reader") !== "1"
  )
    return;
  const publish = (data) => {
    const batch = TiboTimeline.parse(data);
    window.postMessage({ kind: "codex-tibo-timeline", batch }, "https://x.com");
  };
  const originalFetch = window.fetch;
  window.fetch = function (...args) {
    const pending = originalFetch.apply(this, args);
    const target =
      typeof args[0] === "string" || args[0] instanceof URL
        ? String(args[0])
        : args[0]?.url;
    if (TiboTimeline.accepts(target)) {
      pending
        .then((response) => {
          if (response.ok)
            response
              .clone()
              .json()
              .then(publish)
              .catch(() => {});
        })
        .catch(() => {});
    }
    return pending;
  };
  // X may choose XMLHttpRequest instead of fetch. Preserve native request behavior.
  const open = XMLHttpRequest.prototype.open;
  const targets = new WeakSet();
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    targets.delete(this);
    if (TiboTimeline.accepts(String(url))) targets.add(this);
    return open.call(this, method, url, ...rest);
  };
  const send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...args) {
    if (targets.has(this))
      this.addEventListener(
        "load",
        () => {
          if (this.status !== 200) return;
          try {
            publish(
              this.responseType === "json"
                ? this.response
                : JSON.parse(this.responseText),
            );
          } catch {}
        },
        { once: true },
      );
    return send.apply(this, args);
  };
})();
