# 安装

[English](INSTALL.md) | **简体中文** · [首页](../README.zh-CN.md)

需要 **Python 3.10+**、Git 和 Codex。查询账号额度还需登录 Codex CLI。

## 交给 Codex 安装

直接发送：

> 请按照这个 skill 帮我安装 Codex Usage Meter：https://raw.githubusercontent.com/gnuser/codex-usage-meter/main/skills/install-usage-meter/SKILL.md

它会完成系统配置并尝试打开小窗。自动启动只需在 `/hooks` 中确认信任一次。下面是可选的手动步骤。

## 1. 下载

```sh
git clone https://github.com/gnuser/codex-usage-meter.git
cd codex-usage-meter
```

后续命令都在此目录执行，安装后请保留这个目录。

## 2. 安装小窗

### macOS

没有 Xcode Command Line Tools 时先运行 `xcode-select --install` 完成安装，再执行：

```sh
python3 native/build.py
python3 native/install_hook.py
```

### Windows

使用原生 PowerShell，不要用 WSL。如未安装，先装好 [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/)，再执行：

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r native/requirements-windows.txt
.\.venv\Scripts\python.exe native/build.py
.\.venv\Scripts\python.exe native/install_autostart.py
.\.venv\Scripts\python.exe native/install_hook.py
```

请保留 `.venv`，小窗运行需要它。自启步骤会为当前 Windows 用户注册登录后启动，无需管理员权限；只使用 Codex 桌面版时也不依赖 CLI hook。hook 仍可在发送 CLI 消息后打开小窗。

以后如需关闭登录自启，运行 `.\.venv\Scripts\python.exe native/install_autostart.py --remove`。

## 3. 启动

Windows 小窗会在下次登录时打开；要立即打开，可按[手动打开](REFERENCE.zh-CN.md#首次启动手动打开)操作。

在 Codex CLI 中打开 **`/hooks`**，信任指向 **`floating.py hook`** 的 **SessionStart** 和 **UserPromptSubmit** 条目。启动或恢复会话时会启动小窗，发送消息也可触发。仅打开 Codex、尚未启动或恢复会话时，不保证触发。已安装用户重新运行上面的 hook 安装命令即可补上启动入口。


完成。只用悬浮窗，无需再安装可选的 Codex 插件。

[怎么使用](USAGE.zh-CN.md) · [手动打开](REFERENCE.zh-CN.md#首次启动手动打开) · [可选插件与 Tibo 设置](REFERENCE.zh-CN.md#5-可选安装为-codex-插件)

标准安装不包含 Tibo 和 Chrome 扩展。实验性可选版使用 `python3 install.py --with-tibo`（需要时加 `--enable`）。源码运行时，在启动服务前设置 `CODEX_USAGE_TIBO=1` 才会启用。
