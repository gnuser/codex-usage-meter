const status = document.getElementById("status");
const address = document.getElementById("address");
chrome.storage.local.get("status").then((data) => {
  status.textContent = data.status || "尚未连接";
});
chrome.storage.onChanged.addListener((changes) => {
  if (changes.status) status.textContent = changes.status.newValue;
});
document.getElementById("connect").onclick = async () => {
  try {
    const url = new URL(address.value.trim());
    const key = new URLSearchParams(url.hash.slice(1)).get("key");
    if (
      url.protocol !== "http:" ||
      url.hostname !== "127.0.0.1" ||
      !url.port ||
      url.username ||
      url.password ||
      !key
    ) {
      throw Error("请粘贴本机面板的完整地址");
    }
    const response = await fetch(url.origin + "/api/tibo/pair", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + key,
        "Content-Type": "application/json",
      },
      body: "{}",
      signal: AbortSignal.timeout(8000),
      redirect: "error",
    });
    if (!response.ok) throw Error("连接失败，请确认服务已更新且面板地址有效");
    const result = await response.json();
    // Store only the narrowly scoped write key, never the dashboard's read key.
    await chrome.storage.local.set({
      config: { origin: url.origin, token: result.token },
    });
    address.value = "";
    await chrome.runtime.sendMessage({ action: "start" });
  } catch (error) {
    status.textContent = error.message;
  }
};
document.getElementById("refresh").onclick = () =>
  chrome.runtime.sendMessage({ action: "refresh" });
document.getElementById("stop").onclick = () =>
  chrome.runtime.sendMessage({ action: "stop" });
