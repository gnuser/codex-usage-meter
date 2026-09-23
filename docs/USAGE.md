# Usage guide

**English** | [简体中文](USAGE.zh-CN.md)

[Installation](INSTALL.md) · [Home](../README.md) · [Video overview](media/getting-started.mp4)

## Read the window

The interface defaults to English. This example uses sample data:

```text
Week 40% · Reset 4d 0h
Active 2                         Week left 40.00%
Update login page                Last 10 turns
Turn 24.50K · Total 1.20M
In 23.80K · Out 700.00                         ▸
Tibo · No clear reset signal                   ▸
Resets 3 · Credit expires in 6d 0h
```

| Item | Meaning / action |
| --- | --- |
| Title bar | Remaining weekly allowance and time until automatic reset |
| Active count | Conversations updated in the last 30 minutes; click to refresh |
| Allowance percentage | Click to show or hide reset details |
| Conversation title | Click to open that conversation in Codex |
| Turn / Total | Current user turn and latest cumulative conversation snapshot |
| In / Out | Input and output tokens for the current turn |
| Triangle ▸ | Expand cumulative usage by model; click again to collapse |
| Last ten bars | Turn usage, scaled independently per conversation; compare numbers across conversations |
| Tibo row | Expand three original posts, source links, and reset signals |
| Footer | Available manual resets and time until the earliest available reset credit expires |

**Weekly automatic reset** and **manual reset credit expiry** are different deadlines. A credit expiring does not mean your allowance will automatically recover. This tool does not perform manual resets.

## Everyday controls

- **Position:** the window initially tries to sit near Codex's bottom-right. Drag to move or resize it.
- **Details:** collapsed by default. Expanding increases height; collapsing shrinks it. Height is capped at 480 pixels or 60% of available screen height; excess content scrolls.
- **Switch conversations:** click a title in the list. Clicking the Codex sidebar alone does not update a foreground-conversation selection here; the list follows recent log updates.
- **Hide / restore on macOS:** zoom, minimize, or close hides the window to the menu bar. Click its menu bar summary or **Codex Usage** in the Dock to restore it.
- **Hide / restore on Windows:** close hides to the tray; double-click the tray icon to restore. A minimized window remains on the taskbar. Check hidden tray icons if needed.
- **Pause:** choose **Quit and pause auto-open** in the menu bar / tray context menu. Resume with [manual opening](INSTALL.md#open-manually).

New messages do not force a hidden window open. Conversations refresh about every five seconds, and account allowance about every five minutes. Usage can lag while a reply is still being written to the log.

## Understand the numbers

- `K`, `M`, and `B` mean thousand, million, and billion, with two decimal places.
- **Tokens are not subscription allowance.** Weekly percentages cannot be converted into remaining tokens or costs.
- `—` / **Not recorded** means missing data, not zero.
- **Active** means a recent log update, not necessarily a running or foreground conversation.
- Model details use attributable model names from the logs. If a log only says `jev/auto`, the actual backend model cannot be inferred.
- Model totals and conversation totals can cover different scopes, such as after log compaction or restoration. Do not add them together.

## History and full details

Run `python3 meter.py serve` (`py -3 meter.py serve` on Windows), then open the printed URL.

Initially, one recent conversation is loaded. Click **Load 3 more conversations** for more. Switch conversations, inspect turns and models, expand recorded messages, or export JSON. Log auto-refresh is off by default and can be enabled on the page.

The full dashboard and exports may contain message bodies and account identifiers. Check before sharing, and never share a URL containing a temporary key.

## Tibo monitor

Complete [Chrome setup](INSTALL.md#optional-tibo-monitor), then click the Tibo row to see:

- The latest three original posts, publication times, and source links; no replies or reposts.
- Last successful update time and any read failure.
- **Author announces reset**, **Author reports reset or rollout**, **Possible signal · Unconfirmed**, or **No clear reset signal**.

These are text rules, not probabilities. Relative phrases such as “tomorrow” remain quoted; no date is invented. Public posts do not confirm that your account received allowance. Check the official account data.

Incomplete reads, expired sign-in, truncated posts, or stale data suspend predictions. Keep Chrome and the dedicated tab open. Sleeping devices do not refresh on schedule. Pair again after restarting the usage service.

## Quick troubleshooting

| Symptom | First check |
| --- | --- |
| Missing window | Menu bar, Dock, or hidden tray icons; then manually run `show` |
| No automatic opening | Desktop installed, hook trusted; send a message in a new conversation |
| Empty list | Any log updates in the last 30 minutes? Use the full dashboard for history |
| Tokens work; allowance is `—` | Codex CLI availability and sign-in; wait for allowance refresh |
| Tibo stays pending | Chrome sign-in, dedicated tab, extension status, and pairing with the floating window's service |
| Connection fails after restart | The old port/key expired; get the new URL |

See the [README](../README.md) for configuration, updates, and uninstallation.
