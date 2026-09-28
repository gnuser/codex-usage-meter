Codex Usage Meter / Codex 用量仪表

1. Install Python 3.10+ and Node.js 24+ if missing (python.org / nodejs.org).
   macOS can reuse Codex's bundled Node runtime when present.
2. Run Install.command (macOS) or Install.cmd (Windows).
3. Quit Codex and any old Usage Meter floating window/sidebar terminal normally.
4. Open Codex Usage Meter from ~/Applications (Mac) or the Desktop (Windows).

No Xcode build, WebView2 setup, trusted hooks, or open terminal required.
This is a source installer, not a self-contained or notarized binary.
macOS may require approving the downloaded installer in Privacy & Security.
The launcher enables a loopback debugging endpoint. It never quits Codex for you.
Do not expose/forward the endpoint. Closing Codex and opening its normal icon disables debugging.
If Codex cannot be found, set CODEX_METER_APP to its .app/executable path before installing.
Windows Store installations may need an accessible executable supplied explicitly.
Errors appear in sidebar-error.txt; service logs are in sidebar.log under CodexUsageMeter.

先准备 Python 3.10+ 和 Node.js 24+，然后双击对应系统的 Install 文件。
正常退出 Codex、旧浮窗及旧侧栏终端，再打开安装后的 Codex Usage Meter。
默认只显示侧栏，不安装浮窗、hook 或开机自启项，也不需要终端常驻。
这是源码安装包，并非内置全部运行环境或经过签名公证的独立二进制安装包。
侧栏依赖本机调试接口，不要对外开放；客户端更新可能影响它。
