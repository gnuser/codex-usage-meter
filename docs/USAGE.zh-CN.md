# 使用

[English](USAGE.md) | **简体中文**

通过 **Codex Usage Meter** 打开 Codex，启用侧栏。

- **悬停圆环**打开面板，鼠标可以移入操作。
- **点击圆环／图钉**固定相同内容；点击外部、关闭按钮或 Esc 收起。
- **额度摘要**显示周余量、重置倒计时、可用重置券和最早到期时间，悬停时间值可查看具体日期。
- **会话列表**仅展示最近 30 分钟活跃会话，更多会话滚动查看。点标题跳转，点箭头看模型明细。柱状图显示最近各轮；In/Out/Cache 对应最近一轮。缺失数据保持未知。
- **重置动态**展开查看来源和预测。预测明确标注未确认，不代表个人重置时间或重置券到期时间。

公开动态每 5 分钟通过 `https://codex-resets.com/mcp` 获取，无需登录或 API key，不上传会话和账户数据。面板独立读取本地缓存，不再等待额度刷新。

## 常见问题

圆环不见了：正常退出 Codex，从 **Codex Usage Meter** 重新打开。先停止旧终端里的侧栏服务。客户端升级可能改变界面，需要更新插件。

安装或启动失败：查看应用数据目录中的 `sidebar-error.txt` 和 `sidebar.log`。Mac 位于 `~/Library/Application Support/CodexUsageMeter`，Windows 位于 `%LOCALAPPDATA%\CodexUsageMeter`。不要分享 `connection.json` 或含密钥的面板链接。

停止安装版服务：从安装后的代码目录或源码目录执行 `python -m usage_meter.sidebar_start --stop`，使用同一个应用数据目录。正常退出 Codex，再从原图标打开即可关闭调试接口。

安装会暂停旧浮窗。需要备用浮窗时，可在完整源码目录执行 `floating.py show --thread 实际会话ID` 显式恢复；侧栏使用不需要这一步。

[安装](INSTALL.zh-CN.md) · [技术说明](../integrations/sidebar/README.zh-CN.md)
