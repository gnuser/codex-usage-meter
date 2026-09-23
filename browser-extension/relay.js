/* Isolated bridge: forward public post fields only, never arbitrary page messages. */
(() => {
  if (
    location.pathname !== "/thsottiaux" ||
    new URLSearchParams(location.search).get("codex_usage_reader") !== "1"
  )
    return;
  const loadedAt = performance.timeOrigin;
  function notify(message) {
    // Reloading an unpacked extension invalidates already-open page contexts.
    try {
      chrome.runtime.sendMessage({ ...message, loadedAt }).catch(() => {});
    } catch {}
  }
  notify({ action: "reader-ready" });
  window.addEventListener("message", (event) => {
    if (
      event.source !== window ||
      event.origin !== "https://x.com" ||
      event.data?.kind !== "codex-tibo-timeline"
    )
      return;
    const batch = event.data.batch;
    if (!batch || !Array.isArray(batch.posts) || batch.posts.length > 3) return;
    const posts = batch.posts
      .filter(
        (p) =>
          p &&
          typeof p.id === "string" &&
          /^\d{1,25}$/.test(p.id) &&
          typeof p.text === "string" &&
          p.text.length <= 20000 &&
          Number.isFinite(p.publishedAt),
      )
      .map((p) => ({
        id: p.id,
        text: p.text,
        publishedAt: p.publishedAt,
        truncated: !!p.truncated,
      }));
    notify({
      action: "timeline",
      batch: {
        posts,
        complete: batch.complete === true && posts.length === 3,
      },
    });
  });
})();
