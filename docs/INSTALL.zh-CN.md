# 安装指南

[English](INSTALL.md) | **简体中文**

[返回首页](../README.zh-CN.md) · [使用指南](USAGE.zh-CN.md) · [30 秒重点演示](media/getting-started.mp4)

想先试用，选浏览器仪表；想常驻查看，安装悬浮窗。**这两种方式都不需要先安装 Codex 插件。** 插件和 Tibo 监控均可稍后添加。

## 安装前准备

| 使用方式 | 需要什么 |
| --- | --- |
| 浏览器仪表 | Python 3.10+；本机已有 Codex 会话日志 |
| macOS 悬浮窗 | 上述条件，加 Xcode Command Line Tools |
| Windows 悬浮窗 | Windows 10/11 原生 Python、WebView2 Runtime，以及下文依赖 |
| 官方账号额度 | 本机可运行且已登录的 Codex CLI |
| 点击会话跳转 | Codex 桌面应用 |
| Tibo 监控（可选） | 已登录 X 的 Chrome，另装本仓库扩展 |

Git 用于下载源码；也可以在 [GitHub 仓库](https://github.com/gnuser/codex-usage-meter) 选择 **Code → Download ZIP**，解压后进入目录。

```sh
git clone https://github.com/gnuser/codex-usage-meter.git
cd codex-usage-meter
```

**后续命令都在项目目录执行。保留这个目录，不要安装完就删除或移动。**

## 方式一：一分钟体验浏览器仪表

macOS：

```sh
python3 meter.py serve
```

Windows PowerShell：

```powershell
py -3 meter.py serve
```

打开终端打印的完整链接。保持终端运行；按 `Ctrl+C` 停止。第一次只加载最近一个会话，可在页面继续加载历史会话。

成功标志：看到仪表页面及本机已有会话。若没有历史日志，先在 Codex 中完成一轮对话。

链接的 `#key=…` 是临时访问密钥，**不要截图分享或发给他人**。服务重启后使用新链接。

## 方式二：安装悬浮窗

### macOS

检查环境：

```sh
python3 --version
codex --version
xcode-select -p
```

若没有编译工具，运行 `xcode-select --install`，在系统窗口中完成安装后再继续。

编译并注册自动启动：

```sh
python3 native/build.py
python3 native/install_hook.py
```

在 Codex CLI 输入 `/hooks`，审查并信任指向本项目 `floating.py hook` 的新增条目。然后新建会话，发送一条消息。

成功标志：小窗打开并显示最近活跃会话。应用安装在 `~/Library/Application Support/CodexUsageMeter/CodexUsageMeter.app`，但仍依赖源码目录中的后台脚本。

### Windows 10 / 11

在 **原生 PowerShell** 中执行，不要使用 WSL。先确认已安装 [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/)。

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r native/requirements-windows.txt
.\.venv\Scripts\python.exe native/build.py
.\.venv\Scripts\python.exe native/install_hook.py
```

不需要激活虚拟环境。不要删除 `.venv`。

在 Codex CLI 的 `/hooks` 中信任新增 hook，再新建会话并发送消息。成功后会看到小窗，关闭按钮会把它收进系统托盘。

### 不想配置自动启动：手动打开

先列出最近会话，复制目标会话行开头的 ID：

```sh
python3 -c "from usage_meter.ledger import Ledger; print('\n'.join(s['id']+'  '+s['title'] for s in Ledger().catalog(10)['sessions']))"
python3 floating.py show --thread YOUR_CODEX_THREAD_ID
```

Windows 将以上 `python3` 换成 `.\.venv\Scripts\python.exe`。将 `YOUR_CODEX_THREAD_ID` 替换为实际 ID。

此命令也可用于找回窗口或恢复已暂停的自动启动。小窗仍展示所有最近 30 分钟活跃会话，不只显示指定 ID。

## 可选：作为 Codex 插件使用

如果希望在 Codex 中直接说“查看本次会话用量”，再安装插件：

macOS：

```sh
python3 install.py --enable
```

Windows：

```powershell
.\.venv\Scripts\python.exe install.py --enable
```

安装器将插件复制到 `~/plugins/codex-usage-meter`，登记到个人市场，并尝试启用。启用后新建 Codex 任务，输入“查看本次会话 token 用量”。

插件已带 hook；如果采用插件 hook，就跳过前面的 `native/install_hook.py`，避免重复注册。桌面窗口仍需安装，hook 仍需信任。已注册用户级 hook 时，只移除指向本项目的重复条目，保留其他配置。

如提示插件目录已存在，请按 [更新与卸载](../README.zh-CN.md#更新与卸载) 操作，安装器不会覆盖已有目录。

## 可选：连接 Tibo 主题帖监控

1. 在 Chrome 登录 X，确认能打开 [Tibo 的主页](https://x.com/thsottiaux)。
2. 打开 `chrome://extensions`，启用开发者模式。
3. 点击“加载已解压的扩展程序”，选择源码中的 `browser-extension` 文件夹。
4. 保持悬浮窗运行，获取**悬浮窗后台**的连接地址：

   ```sh
   python3 -c "import json; from floating import runtime_dir; print(json.loads((runtime_dir()/'connection.json').read_text())['url'])"
   ```

   Windows 将 `python3` 换成 `.\.venv\Scripts\python.exe`。如果提示文件不存在，先打开悬浮窗。

5. 点击 Chrome 中的 Tibo 扩展图标，粘贴完整地址，点击“Connect and start”。
6. 等待扩展显示“Updated”，再展开悬浮窗底部的 Tibo 行查看。面板最多约 30 秒后反映新数据。

请使用上述悬浮窗后台地址；单独运行 `meter.py serve` 会启动另一个服务，配对到它不会更新现有悬浮窗。

扩展每 30 分钟刷新，也可点击“Refresh now”。保留专用 X 标签并让 Chrome 运行。重启用量服务后需要重新配对；不要分享连接地址。只有最近三条主题帖会进入判断，回复、自回复和转发不计入。

## 安装后检查

- 在新会话发消息，小窗出现；最近 30 分钟没有更新的会话不会列出。
- 点击会话右侧三角按钮，能展开模型输入／输出用量，窗口高度随之变化。
- 收起小窗后，可从菜单栏或托盘找回。
- 额度暂时为 `—` 时，先确认 Codex CLI 已登录；这不影响本地 token 统计。

下一步：[使用指南](USAGE.zh-CN.md)。排障、更新和卸载见 [README](../README.zh-CN.md)。
