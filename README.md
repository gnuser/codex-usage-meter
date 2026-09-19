# Codex 用量仪表

一个可运行的本机 Codex 插件：Python 标准库 MCP 服务 + 中文浏览器仪表 + 用量技能（1.1：会话标题与逐轮正文）。**它记录 token，并查询官方账号限额；不承诺把每次调用精确换算成订阅额度或账单。**

## 共用悬浮窗（macOS）

所有会话共用一个 240×115 的小窗，显示最近 30 分钟有日志更新的会话、本轮与累计 token、最近 10 轮迷你柱状图。活跃不表示正在运行。数字采用 K/M/B/T，保留两位小数；各会话柱高独立缩放。点击标题通过 Codex 会话链接打开对应对话。

菜单栏显示 `▥ 活跃数 · 剩余百分比`：活跃数每 15 秒更新，官方账号额度每 5 分钟查询。多个独立额度窗口取最低剩余百分比，悬停查看各窗口；不将额度相加或换算成剩余 token。读取失败显示 `—`，窗口隐藏时菜单栏继续更新。

首次安装（macOS、Xcode Command Line Tools、Python 3.10+）：

```sh
python3 native/build.py
python3 native/install_hook.py
python3 floating.py show --thread YOUR_CODEX_THREAD_ID
```

安装器保留现有用户 hooks，修改前保存权限为 0600 的备份，不更改现有 hook 信任。**须在 Codex 的 `/hooks` 中审查并信任新加的 `floating.py hook` 定义**；未信任时 Codex 会跳过。使用插件自带 `hooks/hooks.json` 时不需重复注册用户 hook，但仍需构建窗口并信任 hook。

- 窗口默认显示，跳转对话不自动收起；缩放、最小化、关闭按钮收起窗口。点击菜单栏或 Dock 的「Codex 用量」可重新展开，拖动边缘调整尺寸。
- 菜单栏右键可退出并暂停自动打开；上述 `show` 命令恢复。
- `UserPromptSubmit` 仅传递会话 ID，可启动共用窗口；运行中不强制展开。未实现识别 Codex 内单纯点击切换或接管审批。
- 本地状态目录为 `~/Library/Application Support/CodexUsageMeter`，访问密钥文件权限 0600；不保存 hook 正文。
- 无需管理员权限、辅助功能或屏幕录制权限。窗口退出后本机服务关闭。

多会话展示参考 [OpenIsland 文档](https://github.com/Octane0411/open-vibe-island/blob/main/docs/hooks.md)，实现独立编写。

## 浏览器小面板

`usage_dashboard(thread_id=真实会话ID, view="panel")` 返回同一极简活跃会话列表的本机链接，`view="full"` 返回完整仪表。小面板每 5 秒刷新，隐藏时暂停；仅解析最近活跃会话的计数，不返回消息正文。会话目录最多读取最新 100 条元数据。点击标题打开 Codex 对话，顶部剩余额度可点击刷新；深浅色跟随系统。

```sh
python3 meter.py serve --thread YOUR_CODEX_THREAD_ID --view panel
```

## 图表查看（1.3）

- **会话横向柱状图**：比较已加载会话的可归因小计，点击进入某个会话。不会自动扩大日志读取范围。
- **逐轮柱状图**：每轮显示请求摘要、日志模型和调用/区间记录数；点击展开对应正文。
- **总 token 分色构成**：非缓存输入、缓存读取、输出。缓存写入和推理不再重复叠加；细分不完整时用灰色总量。
- **比较指标**：总 token、非缓存输入、输出、缓存读取、推理输出。可按原顺序或用量降序排列；不同图表独立缩放，读取标注数值比较。
- **辅助信息**：输入缓存占比、所选指标最高的轮次，以及可展开的模型用量图。未知值显示“未记录”，与零区分。
- **模型边界**：仅来自日志标注，不保证是上游实际路由模型。跨调用缺口按“模型未知 / 区间无法归因”展示，不冒充某个模型的精确用量。

柱状图表示 token，不表示订阅额度占比或费用；不同模型的 token 不能按 1:1 推算额度。非缓存输入按 input − cached read 计算，可能包含缓存写入。点击正文查看、统计表和 JSON 导出继续保留。

图表无第三方依赖。开发测试：`node tests/test_charts.js`。

## 按需加载（1.2）

首次只读取最近 1 个会话；点击“再加载最近 3 个会话”后增加为 4 个，再点增加为 7 个，以此类推。按日志修改时间排序；只枚举其他日志的文件名与修改时间，不读取其内容。标题仅返回已加载范围，正文只返回选中会话。累计也仅针对已加载范围；刷新不会自动扩展范围。每次重新打开页面从 1 个开始，单次最多加载 1000 个会话。

命令行用 `python3 meter.py snapshot --limit 4`，MCP `usage_snapshot` 使用 `limit` 参数。带有指定会话 ID 的链接不会额外读取加载范围之外的会话。

直接打开 `web/index.html` 不能访问日志；请运行下方服务并打开它输出的 HTTP 地址。

## 先运行

需要 Python **3.10+**。无 pip/npm 运行依赖。macOS / Linux 可直接运行；Windows 请在 WSL 中安装此插件（原生 Windows 的 shell 启动器未支持）。

在解压后的 `codex-usage-meter` 文件夹运行：

```sh
python3 meter.py serve
```

打开终端打印的完整 `http://127.0.0.1:随机端口/#key=...` 地址，在下拉框选择会话。地址含临时本机访问密钥；每次重启改变。终端需保持运行；Ctrl+C 停止。

```sh
# 已知当前 Codex thread ID 时，直接选中
python3 meter.py serve --thread YOUR_CODEX_THREAD_ID

# 自定义日志目录；必须位于子命令前
python3 meter.py --home /path/to/codex-home serve

# 命令行 JSON 输出
python3 meter.py snapshot --thread YOUR_CODEX_THREAD_ID
python3 meter.py account --thread YOUR_CODEX_THREAD_ID
```

界面包括：会话标题、逐轮用户消息和助手回复（展开全文）、本机去重小计、所选会话累计、本轮请求小计、最近调用细分、每轮和每次调用表、官方限额窗口、重置时间、账号累计和每日 token、官方会话估算（若返回）、JSON 导出和覆盖范围说明。日志自动刷新默认关闭，勾选后每 10 秒刷新已加载范围；官方账号查询仅在点击按钮时发生，不持续轮询。

## 安装为 Codex 插件

安装前可先运行下方测试。安装操作会复制本项目到 `~/plugins/codex-usage-meter`，通过附带的 plugin-creator 官方技能辅助脚本登记默认个人市场 `~/.agents/plugins/marketplace.json`，保留已有市场名称、显示名称及其他条目。

```sh
python3 install.py --enable
```

`--enable` 会执行本机支持的 `codex plugin add codex-usage-meter@实际市场名称`。不带该参数时只登记文件，打印启用命令。默认个人市场由 Codex 隐式发现，无需执行 `plugin marketplace add`。

然后在 Codex **新建任务**，输入“用 Codex 用量仪表查看本次会话”或“打开用量仪表并查询官方额度”。插件提供三个工具：`usage_snapshot`、`usage_account`、`usage_dashboard`。仪表链接在 MCP 服务退出后失效，可再次调用 `usage_dashboard`。

如果 Codex 的 PATH 找不到 Python，将 `.mcp.json` 的 `command` 改成 Python 绝对路径，`args` 改成 `["./meter.py", "mcp"]`，保留 `cwd: "."`。当前默认配置使用插件根目录下的可执行 `bin/launch`；打包保留其执行权限。

## 配置

| 配置 | 默认与用途 |
| --- | --- |
| `CODEX_HOME` | `~/.codex`，读取 `sessions/` 与 `archived_sessions/` |
| `CODEX_USAGE_CODEX` | 不设置时在 PATH 找 `codex`；设置时必须为可执行文件路径，不是 shell 命令 |
| `--home` | 显式指定状态目录，优先于环境变量；同一目录传给官方 App Server |
| `serve --port` | 默认 0，由系统分配空闲本机端口 |

官方账号查询需要本机 Codex 可正常启动并已登录。插件使用 `codex app-server` 的标准 JSON-RPC 初始化和查询，不解析 `auth.json`、不提取 OAuth token、不调用私有 ChatGPT HTTP 地址。App Server 自己可能维护其状态数据库或刷新认证，因此需要其正常目录权限。

本项目实测客户端为 `codex-cli 0.153.0`。更早客户端可能没有账号用量/会话估算能力，查询失败会显示原因，日志展示仍可独立运行。纯 API key 模式不保证可用 ChatGPT 账号限额；不会用 API 组织账单冒充订阅余额。

## 精度与算法

- **会话累计**：日志最近 `total_token_usage` 快照，绝不累加全部累计快照。可能包含恢复或分叉继承的历史；不等于本轮。
- **模型调用**：优先展示官方客户端日志的 `last_token_usage`。没有上游 response/request ID，所以标签是“已记录调用”，不保证覆盖每次重试和计费项目。
- **轮次**：按 `turn_id` 汇总观察到的区间，空轮次显示未知。一次用户消息通常包括多次模型调用。
- **区间差额**：相邻累计值差额与 last 不一致时显示“区间”，不把它冒充单次调用。缺失分项保留 null。
- **本机小计**：对观察区间去重求和。相同会话的活动/归档副本只取一份；复制历史按时间戳、累计值及 last 指纹去重。没有全局官方 request ID，因此不能证明跨设备/修改过的副本绝不重叠。
- **部分历史**：首次累计大于 last 时只把 last 计入可归因小计，先前部分不强行归到当前轮。计数回退的区间不计入，并显示警告。缺失数据不会被估算补全。
- **子项**：缓存读取、缓存写入属于输入细分，推理属于输出细分，不重复加到总计。无字段不等于 0。
- **限额**：优先 `rateLimitsByLimitId`，兼容旧 `rateLimits`；剩余比例 = `clamp(100-usedPercent,0,100)`。显示查询/观察时间，重置后要求重新查询，不自行填满。
- **会话额度估算**：仅使用官方 `threadUsage` 的 `estimatedUsage*Micros`，除以 1,000,000 显示；始终标为估算。null 表示不可获取。
- **总量范围**：本机日志可能跨登录账号，不能和当前账号累计简单相加。远程任务、本机已删除日志、未刷盘输出、工具单独费用可能不在其中。当前轮最终回答的 tokens 要等回答完成后刷新才能看到。

详见 [官方能力核实](docs/CAPABILITIES.md) 与 [测试记录](docs/VALIDATION.md)。

## 测试

```sh
python3 -m unittest discover -s tests -v
```

所有自动测试使用临时合成数据，不登录、不请求模型。HTTP 测试需要监听本机临时端口；受限沙箱中请允许该能力后重跑。JavaScript 可额外执行 `node --check web/app.js`；Node 仅用于开发验证，运行仪表不需要 Node。

```sh
# 只读实机验收（已登录的 Codex；不发起模型生成）
python3 meter.py account
```

## 更新与卸载

首次安装器拒绝覆盖已有同名插件或市场条目。更新时先保留旧项目备份，再将新源码复制到 `~/plugins/codex-usage-meter`，使用附带辅助工具按现有市场名更新缓存版本：

```sh
python3 tools/read_marketplace_name.py
python3 tools/update_plugin_cachebuster.py ~/plugins/codex-usage-meter
# 用上一步实际返回的市场名称，不要盲目假设为 personal
codex plugin add codex-usage-meter@YOUR_MARKETPLACE_NAME
```

重新安装后开启新任务。卸载用 `codex plugin remove`（以本机 `--help` 参数为准），或 Codex 插件页面的卸载操作；卸载插件不会删除原始 Codex 日志。项目不写入日志、不修改会话、不自动清理任何用户文件。

## 文件结构与隐私

`meter.py` 是入口；`usage_meter/ledger.py` 解析与去重；`usage_meter/account.py` 是官方只读适配器；`web/` 是静态界面；`.mcp.json` 与 `.codex-plugin/plugin.json` 提供插件配置；`skills/` 是自然语言入口；`tests/` 是自动测试。

服务仅绑定 `127.0.0.1`，校验 Host 和临时密钥，不启用 CORS。界面无外部脚本、字体或统计追踪。仅所选会话返回用户消息和助手回复全文，支持按轮展开并对照 token；会话列表返回标题，不批量返回全部正文。标题优先使用本地状态数据库/会话索引；缺失时用首条用户消息摘要。系统/开发者指令、工具输出和内部推理不作为聊天正文展示。官方账号原始用量结果可能含账号标识；JSON 导出现在也包含所选对话正文；分享前检查范围。解析器按文件大小/修改时间缓存，变更文件重新读取；首次扫描较多日志可能耗时数秒。

辅助脚本来源见 [工具来源](tools/PROVENANCE.md)。本项目不是 OpenAI 官方发布的计费产品。
