# Codex 用量仪表

在一个小窗口里查看 Codex 最近活跃的会话、每轮 token 用量和账号剩余额度。支持 **macOS 菜单栏**、**Windows 系统托盘**，也可以使用完整浏览器仪表或安装为 Codex 插件。

本项目不是 OpenAI 官方产品。**token 用量与订阅额度是两种不同数据，不能直接换算成费用或“剩余 token”。**

界面默认使用英文；会话标题与消息正文保留原始语言。

## 安装与使用入口

- **第一次安装**：[分平台安装指南](docs/INSTALL.md)
- **已经装好**：[使用指南与快速排障](docs/USAGE.md)
- **视频讲解**：[约 30 秒英文讲解](docs/media/getting-started.mp4) · [下载字幕](docs/media/getting-started.srt)

[![安装与使用讲解视频](docs/media/getting-started.png)](docs/media/getting-started.mp4)

视频只讲查看用量、展开模型和收起窗口；采用经录音本人授权的 AI 克隆英文旁白和简短英文字幕，使用示意界面和示例数据。GitHub 若不直接播放，可下载 MP4 后观看；完整可复制命令见安装指南。

## 能做什么

- **精简会话列表**：显示最近 30 分钟有日志更新的会话，超过时间自动移除。
- **逐轮用量**：每个会话显示本轮、累计 token、本轮输入 / 输出和最近 10 轮柱状图；K / M / B / T 单位，保留两位小数。
- **点击跳转**：点击会话标题，打开对应的 Codex 桌面对话。
- **额度摘要**：查看官方账号剩余额度；收起窗口后，菜单栏或托盘继续更新。
- **完整仪表**：按需加载更多历史会话，比较轮次与模型用量、展开对话正文、导出 JSON。

“活跃”指日志近期更新，**不等于正在运行，也不表示当前前台会话**。点击 Codex 侧栏本身不会让本工具识别前台会话。

## 选择使用方式

| 你想做什么 | 使用方式 | 是否需要安装 Codex 插件 |
| --- | --- | --- |
| 先看看用量和历史记录 | 浏览器仪表 | 不需要 |
| 工作时常驻一个小窗口 | macOS / Windows 悬浮窗 | 不需要 |
| 在 Codex 中用自然语言查询用量 | Codex 插件 | 需要 |

浏览器仪表和 MCP 服务只依赖 Python 标准库。macOS 小窗额外需要 Swift 编译工具；Windows 小窗额外需要 WebView2 和 Python 桌面依赖。Node.js 仅用于开发测试。

## 1. 下载项目

需要 Git 和 **Python 3.10+**。查询官方额度还需要本机可运行且已登录的 Codex CLI；会话跳转需要安装 Codex 桌面应用。

```sh
git clone https://github.com/gnuser/codex-usage-meter.git
cd codex-usage-meter
```

也可以下载源码 ZIP 并解压，在解压目录打开终端。

后续命令均在项目目录执行。请保留源码目录；悬浮窗后台与 hook 会使用其中的脚本。

## 2. 先体验浏览器仪表

**macOS / Linux：**

```sh
python3 meter.py serve
```

**Windows PowerShell：**

```powershell
py -3 meter.py serve
```

打开终端打印的完整 `http://127.0.0.1:端口/#key=...` 链接即可。保持终端运行，按 `Ctrl+C` 停止服务。不要直接双击 `web/index.html`。

首次只加载最近 1 个会话。点击“Load 3 more conversations”扩大范围，再选择要查看的会话。日志自动刷新默认关闭，开启后每 10 秒刷新已加载范围；官方额度由页面按钮单独查询。

链接包含临时访问密钥，服务重启后旧链接失效。不要分享带 `key` 的完整链接。

## 3. 安装桌面悬浮窗

### macOS

先检查 Python、Codex CLI 和编译工具：

```sh
python3 --version
codex --version
xcode-select -p
```

如果尚未安装 Xcode Command Line Tools，执行 `xcode-select --install`，完成系统安装后继续：

```sh
python3 native/build.py
```

编译后的应用位于 `~/Library/Application Support/CodexUsageMeter/CodexUsageMeter.app`。首次启动需要通过下文的 `floating.py show` 命令或受信任的 hook，后台服务会一起启动。

### Windows 10 / 11

使用 **Windows 原生 PowerShell 和 Python**，不要在 WSL 中启动桌面窗口。Windows 与 WSL 的日志目录不同，本工具不会自动合并它们。

需要 [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/)。安装 Python 后，推荐创建独立环境，无需激活：

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r native/requirements-windows.txt
.\.venv\Scripts\python.exe native/build.py
```

Windows 小窗使用 [pywebview](https://pywebview.flowrl.com/guide/web_engine) 和 [pystray](https://pystray.readthedocs.io/en/latest/usage.html)。安装步骤会记住当前 Python 环境，请不要移动或删除 `.venv`；移动项目后需重新安装并更新 hook。

### 首次启动：手动打开

先查看最近的会话 ID 和标题，选择你要打开的会话。这一步只读取目录与标题元数据。

**macOS：**

```sh
python3 -c "from usage_meter.ledger import Ledger; print('\n'.join(s['id']+'  '+s['title'] for s in Ledger().catalog(10)['sessions']))"
python3 floating.py show --thread YOUR_CODEX_THREAD_ID
```

**Windows：**

```powershell
.\.venv\Scripts\python.exe -c "from usage_meter.ledger import Ledger; print('\n'.join(s['id']+'  '+s['title'] for s in Ledger().catalog(10)['sessions']))"
.\.venv\Scripts\python.exe floating.py show --thread YOUR_CODEX_THREAD_ID
```

将 `YOUR_CODEX_THREAD_ID` 替换为实际 ID，不要原样执行。小窗显示的是所有最近活跃会话，不是只显示传入的会话。如果最近 30 分钟没有日志更新，列表会为空；在 Codex 中发送一条消息后等待刷新即可。

### 可选：发送消息时自动启动

如果希望以后无需手动运行 `show`，可以注册 `UserPromptSubmit` hook。

**macOS：**

```sh
python3 native/install_hook.py
```

**Windows：**

```powershell
.\.venv\Scripts\python.exe native/install_hook.py
```

然后在 Codex CLI 的 `/hooks` 中审查并信任新增的 `floating.py hook`，新建一个会话并发送消息验证。**仅注册配置不会自动授予信任。**

安装器会保留原有 hooks，并在修改前备份。hook 只传递会话 ID，不保存消息正文；窗口已经收起时，新消息不会强制展开它。

如果准备使用下文的 Codex 插件，可使用插件自带 hook，跳过这里的用户级 hook 注册，避免重复配置。插件 hook 同样需要信任，桌面窗口仍需先安装。

## 4. 日常使用

| 操作 | macOS | Windows |
| --- | --- | --- |
| 打开对应对话 | 点击会话标题 | 点击会话标题 |
| 调整窗口大小 | 拖动窗口边缘 | 拖动窗口边缘 |
| 收起窗口 | 左上角缩放、最小化或关闭按钮 | 关闭按钮收进托盘；最小化保留任务栏入口 |
| 找回窗口 | 点击菜单栏摘要，或 Dock 的「Codex Usage」 | 双击托盘图标，或右键选择“Show usage”；最小化时点任务栏 |
| 展开重置详情 | 点击小窗顶部的剩余额度 | 点击小窗顶部的剩余额度 |
| 退出并暂停自动打开 | 菜单栏右键菜单 | 托盘右键菜单 |
| 退出后恢复 | 再次运行 `floating.py show --thread 实际ID` | 再次运行 `floating.py show --thread 实际ID` |

悬浮窗启动时默认定位到 Codex 窗口内的右下角，可手动拖动。macOS 未找到可见 Codex 窗口时使用屏幕右下角；Windows 未找到时保留系统默认位置。

小窗默认保持可见，点击会话跳转后不会自动收起。窗口高度随内容自适应，展开模型明细后增高、收起后缩回；超出高度上限后滚动查看。

macOS 菜单栏显示类似 `▥ 2 · 96.00%`：`2` 是最近活跃会话数，百分比是独立额度窗口中最低的剩余值，悬停可看窗口明细。Windows 托盘提供图标，摘要显示在悬停提示和右键菜单中，不常驻为任务栏文字。

刷新规则：

- 桌面标题栏显示周额度剩余和自动重置倒计时（准确日期可展开查看），底部状态栏显示手动重置次数和最近一张可用重置资格的过期倒计时。点击面板里的额度百分比展开自动重置时间与资格到期倒计时；接口未提供时显示未知。
- 会话列表：每 5 秒刷新；桌面端另有刷新检查，重新展开时立即刷新。浏览器页面隐藏时暂停。点击顶部活跃数可手动刷新，悬停可看最近更新时间。
- 点击会话右侧 ▸ 展开（默认收起），再点 ▾ 收起：查看该会话按模型累计的 input / output tokens，使用 K、M、B 单位并保留两位小数；无法归属到具体模型的记录单独列出。
- 菜单栏 / 托盘：活跃数每 15 秒刷新，账号额度每 5 分钟查询，收起后仍更新。
- 小窗顶部额度：打开时查询，之后每 5 分钟后台更新；点击百分比仅展开 / 收起详情，不等待网络请求。

## 5. 可选：安装为 Codex 插件

只使用悬浮窗或浏览器仪表时，可以跳过本节。

**macOS：**

```sh
python3 install.py --enable
```

**Windows：**

```powershell
.\.venv\Scripts\python.exe install.py --enable
```

安装器将项目复制到用户主目录下的 `plugins/codex-usage-meter`，登记到 `.agents/plugins/marketplace.json`，保留已有市场配置。`--enable` 会调用本机 Codex CLI 启用插件；不带该参数则只登记并打印启用命令。

Windows 安装器会为复制后的插件设置 Python 绝对路径和 Windows hook 命令，不需要 `sh` 或 `python3` 别名。macOS 默认使用 `bin/launch`；如果 Codex 找不到 Python，可在安装后的 `.mcp.json` 中将 `command` 改为 Python 绝对路径、`args` 改为 `["./meter.py", "mcp"]`，保留 `cwd: "."`。

启用后，在 Codex 新建任务，输入：

> 查看本次会话的 token 用量。
>
> 打开用量仪表并查询官方剩余额度。
>
> 打开最近活跃会话的用量小面板。

插件提供的工具：

| 工具 | 用途 |
| --- | --- |
| `usage_snapshot` | 本地 token 统计与会话明细 |
| `usage_account` | 官方账号限额、重置时间及可用的用量估算 |
| `usage_dashboard` | 打开完整仪表，或以 `view="panel"` 打开精简列表 |

浏览器链接在 MCP 服务退出后失效，再次请求打开仪表即可获得新链接。

## 常见问题

### 窗口不见了，顶部也没有入口

macOS 先点 Dock 中的「Codex 用量」；Windows 先检查任务栏及托盘折叠菜单。仍找不到时，重新运行本节前面的 `floating.py show --thread 实际ID`，会恢复共用窗口。

Windows 托盘初始化失败时，关闭按钮会改为最小化到任务栏，避免没有恢复入口。

### 没有自动启动

确认已经安装桌面窗口、注册并信任 hook，再在新会话发送消息。仅点击切换会话不会触发 hook。如果之前选择过“退出并暂停自动打开”，先运行 `show` 恢复。

### 列表为空，或者看不到旧会话

精简列表只显示最近 30 分钟有日志更新的会话；目录最多检查最新 100 个会话。历史会话请使用 `meter.py serve` 打开完整仪表，再按需加载。

### 额度显示 `—`，但 token 正常

本地日志统计和官方额度查询彼此独立。先确认 `codex --version` 可运行且 Codex 已登录，等待后台额度刷新或重新打开窗口。CLI 不在 PATH 时，设置 `CODEX_USAGE_CODEX` 为其可执行文件的完整路径。

官方未返回的数据不会估算补齐；纯 API key 登录不保证返回 ChatGPT 订阅额度。

### 点击标题没有打开 Codex

确认当前系统已安装 Codex 桌面应用，并注册了 `codex://` 链接处理器。Windows 不应从 WSL 启动窗口。Windows 的 WebView2 启动与桥接有 CI 覆盖，但真实桌面上的焦点、托盘位置和 Codex 跳转体验仍需实机验证。

### 浏览器提示连接失败

后台服务可能已退出或重启。重新运行 `meter.py serve`，打开新打印的链接；旧端口和访问密钥不能继续使用。

### 安装时提示插件目录已经存在

安装器不会覆盖旧插件。请按下面的更新流程操作，不要直接删除整个个人市场配置或覆盖其他插件。

## 配置与命令行

| 配置 | 用途 |
| --- | --- |
| `CODEX_HOME` | Codex 日志与状态目录，默认用户主目录下的 `.codex` |
| `CODEX_USAGE_CODEX` | Codex CLI 可执行文件路径，不是整条 shell 命令 |
| `CODEX_USAGE_DATA` | 桌面运行数据目录；不要指向公共或共享目录 |
| `meter.py --home 路径` | 为本次命令指定 Codex 状态目录，需放在子命令前 |
| `serve --port 端口` | HTTP 端口，默认 `0` 表示自动分配 |

macOS 桌面运行数据默认位于 `~/Library/Application Support/CodexUsageMeter`；Windows 默认位于 `%LOCALAPPDATA%\CodexUsageMeter`。Windows 使用当前用户目录的权限；macOS 密钥文件权限为 0600。

以下示例使用 `python3`；Windows 换成 `py -3`，或已创建环境的 `.\.venv\Scripts\python.exe`：

```sh
# 打开完整仪表并选中指定会话
python3 meter.py serve --thread YOUR_CODEX_THREAD_ID

# 打开浏览器精简列表
python3 meter.py serve --thread YOUR_CODEX_THREAD_ID --view panel

# 按需读取最近 4 个会话，输出 JSON
python3 meter.py snapshot --limit 4

# 查询指定会话或官方账号数据
python3 meter.py snapshot --thread YOUR_CODEX_THREAD_ID
python3 meter.py account --thread YOUR_CODEX_THREAD_ID

# 使用自定义 Codex 数据目录
python3 meter.py --home /path/to/codex-home serve
```

## 数据如何理解

- **本轮**是当前用户轮次中已记录的用量；最终回复尚未写入日志时，数字可能继续增长。
- **按模型累计**汇总日志中可归因的调用记录，可能与最新累计快照的范围不同（例如压缩后计数重置）；`jev/auto` 等路由别名按日志原样显示，不推测实际模型。
- **会话累计**采用日志最新累计快照，不把累计快照重复相加，可能包含恢复或分叉继承的历史。
- **本机小计**仅覆盖已加载记录，并做本地去重，不代表整个账号或所有设备的用量。
- **缓存读取与推理**属于输入 / 输出的细分，不重复叠加；无法归因的区间不会冒充某个模型的精确调用。
- **缺失值**显示 `—` 或“未记录”，不当作零。各会话图表独立缩放，比较时以数值为准。
- **剩余额度**来自官方账号窗口；不同窗口不可相加，也不能从百分比反推剩余 token。
- **会话费用 / credits**仅在官方返回估算时展示，并标记为估算，不作为实际账单。

更多说明见 [能力与边界](docs/CAPABILITIES.md)。

## 更新与卸载

**更新源码运行的桌面窗口：** 先从菜单栏 / 托盘退出，更新本地源码，再执行对应平台的 `native/build.py`。Windows 如依赖有变化，先重新安装 `native/requirements-windows.txt`。最后运行 `floating.py show --thread 实际ID` 恢复。若脚本或 Python 路径变了，先移除旧 hook 条目，再重新注册和信任。

**更新已安装插件：** 安装目录是源码副本，不会随源码目录自动更新。备份旧副本后更新其中的源码，保留 Windows 安装时生成的 `.mcp.json` 和 hook 中的正确绝对路径，再按现有市场名刷新缓存并启用：

```sh
python3 tools/read_marketplace_name.py
python3 tools/update_plugin_cachebuster.py ~/plugins/codex-usage-meter
codex plugin add codex-usage-meter@YOUR_MARKETPLACE_NAME
```

`YOUR_MARKETPLACE_NAME` 使用第一条命令打印的实际值。Windows 使用相应 Python 命令，并将插件路径写为 `"$HOME\plugins\codex-usage-meter"`。重新启用后新建 Codex 任务。

**卸载：** 先退出并暂停自动打开，在 Codex 插件页面卸载插件；如果注册过用户级 hook，只移除 `hooks.json` 中指向本项目 `floating.py hook` 的条目，保留其他 hooks。随后可删除本项目副本、专用虚拟环境及上述桌面运行数据目录。不要删除原始 `.codex/sessions` 日志。

## 开发与验证

```sh
python3 -m unittest discover -s tests -v
node tests/test_charts.js
node tests/test_panel.js
node tests/test_tibo.js
node tests/test_tibo_timeline.js
node tests/test_tibo_background.js
node tests/test_panel_size.js
node tests/test_quota_summary.js
node --check web/panel.js
```

[GitHub Actions](https://github.com/gnuser/codex-usage-meter/actions) 在 Windows 与 macOS 上运行测试及平台构建 / 注册。Windows 额外运行 `tests/windows_smoke.py`，验证真实 WebView2 页面加载、标题更新与 JavaScript 到桌面的会话桥接；测试拦截系统打开操作，不会启动真实 Codex 或请求模型。

HTTP 测试需要监听本机临时端口。历史版本验证见 [测试记录](docs/VALIDATION.md)，辅助工具来源见 [工具来源](tools/PROVENANCE.md)。

## 隐私

日志在本机读取，页面无外部脚本、字体或统计追踪。HTTP 服务只监听 `127.0.0.1`，校验 Host 和临时密钥；官方额度通过本机 `codex app-server` 查询，不直接解析认证文件。

精简列表不返回对话正文；完整仪表可以展开所选会话的用户消息和助手回复，JSON 导出也可能包含这些正文和账号标识。分享导出文件前，请确认内容范围。项目不修改或自动删除原始会话日志。


## 免费 Tibo 重置信号（实验性）

悬浮窗的 Tibo 行默认折叠，展示 Chrome 页面中读取到的最近三条主题帖子（排除回复和转发）、原文链接和保守规则判断。免费，不需要 X API 或付费模型。**需要另外安装本仓库的 Chrome 扩展；仅登录 Chrome 不会自动连接。**

### Chrome 安装与连接（macOS / Windows）

1. 在 Chrome 登录 X，确认能打开 [Tibo 的帖子页面](https://x.com/thsottiaux)。
2. 打开 `chrome://extensions`，启用开发者模式，选择「加载已解压的扩展程序」，选择本仓库的 `browser-extension` 文件夹。
3. 启动更新后的用量服务，复制本机面板的完整地址（包括 `#key=…` 部分，不要发给别人）。
4. 点击扩展图标，粘贴地址，选择「连接并开始」。它会创建一个不抢焦点的主题帖子专用 X 标签。
5. 保持 Chrome 运行和该标签可用；扩展每 30 分钟刷新，也可点「立即更新」或「停止」。本地服务重启导致端口和密钥变化后，需要重新配对。

扩展使用浏览器正常登录的页面，不读取、复制或导出 Cookie；只向 `127.0.0.1` 发送 Tibo 的公开正文、时间和链接标识。Chrome 权限按域申请，因此安装提示包含 X 域及本机地址，但代码仅采集专用的 Tibo 页面，不读取私信。面板地址只用于换取一个仅能写入动态的密钥，扩展不会保存能读取用量的面板密钥。重新配对使旧写入密钥失效。

登录过期、验证码、截断长文、不足三条、页面结构变化或读取失败时暂停预测；超过一小时未成功更新也暂停。失败保留上次内容供查看，显示更新时刻。扩展只在带专用标记的帖子页读取 X 自身返回的公开时间线数据，不依赖后台列表渲染，不额外发起 X API 请求。兼容 X 的 UserOriginalsTimeline / UserTweets，采集状态保存在本机，Chrome 后台进程休眠后仍可恢复；一分钟未收到完整结果会提示失败。当前解析仍依赖 X 返回的数据结构，**不保证来源始终完整或可用**；睡眠和关闭 Chrome 时不会准点刷新。可识别的置顶、转发以及其他作者的帖子不计入。网页的引用内容不作为本人发言；完整长文优先使用时间线返回的正文。


判断分为「作者预告」「作者称已重置/正在发放」「可能信号 · 未证实」「无明确重置信号」。只依据这三条文本的保守规则，不提供虚构概率；出现 tomorrow / Tuesday 等相对时间时保留原文，不擅自换算时区和日期。发言不能证明你的账号已经获得额度，仍以官方额度接口为准。短语规则无法理解所有语境，请查看原文。

悬浮窗高度随内容自动调整，展开增高、收起缩回；最大高度为 480 像素或屏幕可用高度的 60%，超出部分滚动查看。
