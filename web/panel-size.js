// Measure intrinsic content, independent of the viewport, so collapse can shrink too.
(() => {
  const main = document.querySelector("main");
  let scheduled = false;
  let lastHeight = 0;
  function fit() {
    scheduled = false;
    const bridge = window.webkit?.messageHandlers?.usageControl;
    const api = window.pywebview?.api;
    if (!bridge && !api?.fit_height) return;
    const style = getComputedStyle(main);
    let height = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    for (const child of main.children) {
      const css = getComputedStyle(child);
      if (css.display === "none") continue;
      height +=
        child.id === "sessionCards"
          ? child.scrollHeight
          : child.getBoundingClientRect().height;
      height += parseFloat(css.marginTop) || 0;
      height += parseFloat(css.marginBottom) || 0;
    }
    height = Math.ceil(height);
    if (height === lastHeight) return;
    lastHeight = height;
    if (bridge)
      bridge.postMessage({ action: "fitHeight", height: String(height) });
    else
      api
        .fit_height(
          height,
          window.innerHeight,
          screen.availHeight,
          screen.availTop || 0,
        )
        .catch(() => {
          lastHeight = 0;
        });
  }
  function schedule() {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(fit);
    }
  }
  new MutationObserver(schedule).observe(main, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true,
  });
  new ResizeObserver(schedule).observe(main);
  window.addEventListener("resize", () => {
    lastHeight = 0;
    schedule();
  });
  window.addEventListener("pywebviewready", schedule);
  document.fonts?.ready.then(schedule);
  schedule();
})();
