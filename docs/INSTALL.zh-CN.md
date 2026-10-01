# 安装

[English](INSTALL.md) | **简体中文**

默认使用紧凑侧栏面板，不再需要浮窗、信任 hook、原生编译或终端常驻。

[下载最新安装包](https://github.com/gnuser/codex-usage-meter/releases/latest)

1. 准备 **Python 3.10+** 和 **Node.js 24+**；Mac 如有 Codex 自带的 Node，安装器会自动复用。
2. 解压 `CodexUsageMeter.zip`，双击 **Install.command**（Mac）或 **Install.cmd**（Windows）。
3. 正常退出 Codex、旧浮窗和旧侧栏终端，再打开 **Codex Usage Meter**：Mac 位于 `~/Applications`，Windows 位于桌面。

文件会复制到当前用户的应用数据目录，之后可删除解压目录，但需保留 Python、Node。更新时重复上述步骤即可，不修改会话日志。旧浮窗的自动打开会暂停。

这是源码安装包，不是内置所有运行环境、已签名公证的独立二进制包。Mac 下载保护可能需要在“隐私与安全性”中批准安装器。启动入口会启用**仅本机的调试接口**，不会强制退出 Codex；不要对外开放或转发端口。以后从这个入口打开 Codex 才有侧栏；正常退出后，从原 Codex 图标打开会关闭调试。客户端升级可能影响这一实验性功能。

找不到 Codex 时，将 `CODEX_METER_APP` 设置为 `.app` 或可执行文件路径；Windows 商店版可能需要显式指定可访问的程序路径。失败会显示错误说明，日志位于应用数据目录 `CodexUsageMeter/sidebar.log`。

## 源码／一句话安装

让 Codex 按[安装 skill](../skills/install-usage-meter/SKILL.md)操作，或在项目目录执行：

```sh
python3 installers/install_sidebar.py
```

Windows 使用 `py -3 installers/install_sidebar.py`。生成 ZIP：`python3 installers/build_package.py`；CI 运行页面的 Artifacts 也提供安装包。

[使用说明](USAGE.zh-CN.md) · [旧版浮窗](REFERENCE.zh-CN.md)
