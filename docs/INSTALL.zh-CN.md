# 安装

[English](INSTALL.md) | **简体中文** · [首页](../README.zh-CN.md)

需要 **Python 3.10+**、Git 和 Codex。查询账号额度还需登录 Codex CLI。

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
.\.venv\Scripts\python.exe native/install_hook.py
```

请保留 `.venv`，小窗运行需要它。

## 3. 启动

在 Codex CLI 中打开 **`/hooks`**，信任新增的 **`floating.py hook`** 条目。新建会话并发送一条消息，小窗就会出现。

完成。只用悬浮窗，无需再安装可选的 Codex 插件。

[怎么使用](USAGE.zh-CN.md) · [手动打开](REFERENCE.zh-CN.md#首次启动手动打开) · [可选插件与 Tibo 设置](REFERENCE.zh-CN.md#5-可选安装为-codex-插件)
