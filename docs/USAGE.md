# Use the window

**English** | [简体中文](USAGE.zh-CN.md) · [Home](../README.md)

| Control | Action |
| --- | --- |
| Conversation title | Open it in Codex |
| **▸** beside a conversation | Show input/output totals by model |
| Allowance percentage | Show reset details |
| Close button | Hide to menu bar / tray |
| Menu bar summary / double-click tray icon | Restore the window |

**Turn** is the current turn; **Total** is the conversation total. **In / Out** means input/output tokens. `K` = thousand, `M` = million, `B` = billion.

**Cache** is cached input tokens divided by input tokens, shown for the current turn without expanding. Expand for each model’s cumulative share. Values are rounded to whole numbers; missing data is `—`. This is a token share, not a request hit rate.

The title shows weekly allowance and its automatic reset countdown. The footer shows available manual resets and when the next reset credit expires. **Credit expiry does not restore allowance.**

Only conversations updated in the last **30 minutes** appear. Usage refreshes about every **5 seconds**, allowance every **5 minutes**. A routing name such as `jev/auto` does not reveal the actual backend model.

## Quick fixes

- **Missing window:** check the menu bar or hidden tray icons, then [open manually](REFERENCE.md#open-manually).
- **Empty list:** send a message in Codex and wait for the log update.
- **Allowance shows `—`:** check Codex CLI sign-in. Token statistics work independently.
- **No automatic opening:** trust the hook in `/hooks`, then start a new conversation.

[Install](INSTALL.md) · [History, Tibo, updates & reference](REFERENCE.md)
