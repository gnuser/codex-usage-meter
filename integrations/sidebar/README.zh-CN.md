# 侧栏模式（实验性，可选）

[English](README.md) | **简体中文**

将额度圆环、项目配色、会话用量色块嵌入 Codex 侧栏，复用本插件的本地统计数据：

- 圆环显示 5 小时和周剩余额度；悬停查看重置时间。
- 会话旁的蓝色色块表示累计 token 量；悬停查看累计用量、本轮 In、Out、Cache。
- 数字使用整数 K/M/B；没有数据时显示未知，不用零代替。

默认悬浮窗仍可使用。此功能不自动开启调试、不重启 Codex，也不安装额外开机启动项。已通过自动测试和模拟窄栏预览；客户端更新可能影响显示。

需要 Node.js 24+、Python 3.10+，以及已由你明确开启的 Codex 本机调试接口。调试端口允许能访问它的本机进程控制客户端；不要对外暴露或转发。确认接受后，在仓库根目录运行：

```sh
node integrations/sidebar/agent.cjs
```

默认调试端口 `39222`，可以通过 `CODEX_METER_SIDEBAR_PORT` 修改。Python 默认 macOS 用 `python3`，Windows 用 `python`；可通过 `CODEX_METER_PYTHON` 指定可执行文件路径。

没有可连接的客户端时程序等待，不会启动或重开 Codex。按 Ctrl+C 停止，并在客户端仍可连接时清除侧栏组件。客户端重载也会移除组件。面板访问密钥不会发送到客户端页面。

展示组件改编自 [codex-usage-badge](https://github.com/jaykinhoo9/codex-usage-badge)，保留 [MIT 许可证](vendor/LICENSE)。来源版本及改动见[英文说明](README.md#source-attribution)。

## macOS 一次启动

确认启用本机调试后，先用 **Command+Q** 正常退出 Codex，再双击同目录的 `start-macos.command`。它会选择 Node.js 24+、带本机调试参数打开 Codex，并在终端里运行侧栏服务；请保持这个终端窗口打开。若 Codex 还在运行，会提示退出，不会自动关闭客户端。

`./integrations/sidebar/start-macos.command --check` 仅检查依赖，不启动客户端。必要时可通过 `CODEX_METER_NODE` 指定 Node 路径，`CODEX_METER_APP` 指定客户端路径。

按 Ctrl+C 清除侧栏组件；要关闭调试接口，正常退出 Codex，再通过原来的应用图标启动。不会安装开机启动项。

额度圆环下直接显示重置倒计时（统一为天，保留一位小数，如 `2.5d`），会话色块直接显示整数累计 token，无需悬停。

额度组件固定 38px 竖排，不撑宽侧栏；重置机会的到期时间仅放在悬停详情里。不要同时运行原版 Usage Badge 注入程序，两者使用相同组件标识。大量会话会分批刷新，短暂缓存避免重复读取。
