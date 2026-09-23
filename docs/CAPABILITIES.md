# Capability review · 2026-09-19

**English** | [简体中文](CAPABILITIES.zh-CN.md)

[Home](../README.md)

This is a dated review, not a guarantee for every Codex version or account. **Client-recorded token breakdowns, account limit snapshots, and lifetime/daily account usage were available. Complete billing attribution for every underlying request was not established, and no public interface was found that precisely converts each request into a ChatGPT subscription allowance deduction.**

## Reviewed sources

| Source | Granularity | Evidence and limits |
| --- | --- | --- |
| Codex App Server `thread/tokenUsage/updated` | Active thread cumulative/last usage with turn ID | Documented notification; locally generated protocol includes total, last, input, cache read/write, output, reasoning, and total tokens. A separate connection is not a passive listener for every desktop conversation; this plugin does not claim access to every other connection's events. |
| Local `sessions/**/*.jsonl` and `archived_sessions/**/*.jsonl` | Cumulative/last values per `token_count`; turns from `turn_context` | Required fields were observed with 0.153.0. This is a local client format, not a stable public billing contract. The plugin reads passively and retains warnings. |
| `account/rateLimits/read` | Multiple account limit buckets, used percentage, window minutes, Unix-second reset time | Successfully queried. Shared windows cannot be precisely attributed to individual requests; remaining percentages cannot determine remaining tokens. |
| `account/usage/read` | Lifetime account tokens and daily buckets | Cumulative and daily values were returned. Null stays null; this is not an immediate per-request bill. |
| `account/usage/read` with `threadId` | Official conversation estimates, where the billing route supports them | Locally generated protocol includes `threadUsage`, `estimatedUsageCreditsMicros`, and `estimatedUsageUsdMicros`. The tested conversation returned null and was marked unavailable. Availability depends on version/account. |
| OpenAI Responses API `usage` | Input/output/cache read/cache write/reasoning/total fields in an API response | The response has usage data, which the API client must retain. This plugin does not intercept traffic, invent response IDs from Codex logs, or send paid requests to obtain usage. |
| Organization Usage / Costs API | Organization time buckets and cost summaries | `GET /organization/usage/completions` and `GET /organization/costs` exist. API organization totals are not ChatGPT subscription allowance. These endpoints are not integrated or tested with credentials here. |

Official references used for the review:

- [Codex App Server](https://learn.chatgpt.com/docs/app-server): initialization, token notifications, account limits, and cumulative/daily usage.
- [Responses create](https://developers.openai.com/api/reference/cli/resources/responses/methods/create): response usage fields.
- [Organization Completions Usage](https://developers.openai.com/api/reference/resources/admin/subresources/organization/subresources/usage/methods/completions).
- [Organization Costs](https://developers.openai.com/api/reference/resources/admin/subresources/organization/subresources/usage/methods/costs).

## Reproduce the protocol check

```sh
codex --version
codex app-server generate-ts --out /tmp/codex-usage-protocol
```

The review generated protocol definitions from the installed `codex-cli 0.153.0` and inspected:

- `v2/TokenUsageBreakdown.ts`, `v2/ThreadTokenUsage.ts`, `v2/ThreadTokenUsageUpdatedNotification.ts`
- `v2/RateLimitSnapshot.ts`, `v2/RateLimitWindow.ts`
- `v2/GetAccountTokenUsageParams.ts`, `v2/GetAccountTokenUsageResponse.ts`
- `v2/ThreadUsage.ts`, `v2/ThreadUsageBreakdownGroup.ts`

Conversation estimate fields were established from the installed official client's generated protocol, not inferred from a web page. Repeat after upgrades; unsupported calls degrade safely.

## Claims this plugin does not make

It does not report an exact subscription percentage deducted per request, apply API dollar prices to subscription allowance, estimate remaining message counts, double-count cache/reasoning subcategories, or treat a context-window size such as 258400 as an account token quota. Missing data remains missing.

Any displayed credit estimate comes from an official response and remains an estimate, not settlement. Historical account snapshots may belong to a different signed-in account. Local logs do not provide reliable complete account attribution.
