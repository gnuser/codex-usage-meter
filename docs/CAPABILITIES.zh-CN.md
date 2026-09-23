# 官方能力核实 · 2026-09-19

[English](CAPABILITIES.md) | **简体中文**

结论：**可以获得官方客户端记录的 token 细分、账号限额快照及账号累计/按日 token。不能保证每个底层网络请求的完整账单归因，也没有找到可把每次请求精确换算为 ChatGPT 订阅额度扣减的公开接口。**

## 已核实的来源

| 来源 | 可用粒度 | 实现与边界 |
| --- | --- | --- |
| Codex App Server `thread/tokenUsage/updated` | 活跃线程累计与 last 用量，附 turn ID | 官方文档列出通知；本机生成协议包含 total、last、输入、缓存读写、输出、推理、总量。独立启动的连接不是桌面全部会话的旁路监听器，本插件不假装订阅到其他连接全部事件。 |
| 本机 `sessions/**/*.jsonl` 和 `archived_sessions/**/*.jsonl` | 每个 token_count 事件的累计/last；turn_context 提供轮次 | 实测 0.153.0 有所需字段。属于客户端本地实现格式，非稳定公开 billing 合约。插件被动读取，保留异常提示。 |
| `account/rateLimits/read` | 账号多个限额桶、已用比例、窗口分钟、Unix 秒重置时间 | 实测返回成功。共享窗口不能准确归因到单个请求，余额是比例，不能凭比例推算剩余 token。 |
| `account/usage/read` | 账号生命周期 token 与按日桶 | 实测返回累计值和每日桶。null 必须保留；不是即时单请求账单。 |
| `account/usage/read` + `threadId` | **官方会话估算**，若该计费路由支持 | 本机生成协议列出 `threadUsage` 与 `estimatedUsageCreditsMicros`、`estimatedUsageUsdMicros`。本会话实测返回 null，明确标为不可获取。此字段依赖版本，不能承诺所有账号支持。 |
| OpenAI Responses API `usage` | 单个 API response 的输入/输出/缓存读取/缓存写入/推理/总量 | 官方响应中确有 usage 结构；需由 API 客户端保存响应。本插件不拦截用户流量，不凭 Codex 日志伪造 response ID，也不另发付费请求取用量。 |
| 组织 Usage / Costs API | 组织时间桶和费用汇总 | 确认存在 `GET /organization/usage/completions` 和 `GET /organization/costs`；属于 API 组织汇总，不能等同于 ChatGPT 订阅剩余额度。未接入本插件，未做凭证访问实测。 |

官方文档：

- [Codex App Server](https://learn.chatgpt.com/docs/app-server)：初始化、token 通知、账号限额、账号累计和按日用量。
- [Responses create 返回结构](https://developers.openai.com/api/reference/cli/resources/responses/methods/create)：response 的 usage 细分。
- [组织 Completions Usage](https://developers.openai.com/api/reference/resources/admin/subresources/organization/subresources/usage/methods/completions)。
- [组织 Costs](https://developers.openai.com/api/reference/resources/admin/subresources/organization/subresources/usage/methods/costs)。

## 本机复核方式

```sh
codex --version
codex app-server generate-ts --out /tmp/codex-usage-protocol
```

本次从实际安装的 `codex-cli 0.153.0` 生成协议，检查：

- `v2/TokenUsageBreakdown.ts`、`v2/ThreadTokenUsage.ts`、`v2/ThreadTokenUsageUpdatedNotification.ts`
- `v2/RateLimitSnapshot.ts`、`v2/RateLimitWindow.ts`
- `v2/GetAccountTokenUsageParams.ts`、`v2/GetAccountTokenUsageResponse.ts`
- `v2/ThreadUsage.ts`、`v2/ThreadUsageBreakdownGroup.ts`

会话估算字段的依据是本机官方客户端生成的协议，而非对公开网页内容的推断。升级后可重新生成复核；不支持的调用安全降级。

## 本插件不声称的能力

不输出“每次请求精确扣了百分之几”，不把 API 美元单价套到订阅额度，不推算剩余可发消息次数，不把缓存/推理子项重复相加，不把 258400 等上下文窗口大小当作账号 token 配额。没有数据就是没有数据。

界面中若显示 credits 估算，它来自官方返回，仍为估算，不是最终结算。账号历史快照和当前登录账号可能不同；本机日志不具备可靠完整的账号归属标签。
