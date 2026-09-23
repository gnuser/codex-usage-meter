# Validation history

**English** | [简体中文](VALIDATION.zh-CN.md)

[Home](../README.md) · [Current CI](https://github.com/gnuser/codex-usage-meter/actions)

These are historical results with their original limitations. They do not imply that every check was repeated for every later version.

## English interface and overview · 2026-09-24

[PR #5](https://github.com/gnuser/codex-usage-meter/pull/5): all 53 Python tests and seven JavaScript suites passed locally. macOS and Windows CI passed, including native build/registration and the Windows WebView2 smoke test. JavaScript syntax and video-script compilation checks passed. The final roughly 29-second MP4 contains H.264 video and AAC audio; its visual layout was inspected. Narration is an authorized AI voice clone, marked in the video. Raw recordings and voice models were excluded from the repository.

## Version 1.3

All 28 Python tests that did not require a listening port passed, including mixed-model and unattributed-interval coverage. Thirteen chart assertions passed, covering input/cache/output accounting, unknowns, zero values, invalid totals, and reasoning subcategories. JavaScript syntax checks passed.

Restricted port-listening tests were not rerun. Browser policy blocked the local synthetic preview, so visual/click testing was not completed for this update. Code checks were not treated as browser acceptance. Synthetic previews and personal logs were not packaged.

## Version 1.2

All 27 non-listening tests and JavaScript syntax checks passed. New coverage checked initial loading of one log, expansion to four, refresh without increasing scope, end-of-list behavior, and invalid limits. HTTP tests were not rerun in the restricted environment.

The initial device read loaded only one log and no other conversation bodies. This update did not claim the new service had been restarted.

## Version 1.1

Added conversation titles, selected user/assistant messages, and per-turn usage. Of 26 tests, 25 passed, including title precedence, cross-turn message association, mirrored-event deduplication, internal-instruction exclusion, and pre-context message association.

The HTTP test was blocked by sandbox listening permissions, not an assertion failure; it had passed previously. JavaScript syntax checks passed. Escalation was rejected, so this update did not restart the service or claim browser validation.

## Version 1.0 · 2026-09-19

Environment: macOS, Python 3.13.5, Codex CLI 0.153.0. Runtime dependencies were Python standard library only.

### Completed checks

- All 23 Python tests passed: real stdio MCP process, packaged `.mcp.json` launcher, HTTP authentication/Host/routing, temporary-directory installation, preserving marketplace entries, rejecting duplicate installs, and log/API boundaries.
- Official plugin-creator `validate_plugin.py` and skill-creator `quick_validate.py` passed.
- `node --check web/app.js` passed.
- Device log scan: 795 JSONL files and 758 conversations at that snapshot; first pass about 10.9 seconds. All six token fields parsed for the current conversation; later reads used file-signature caching.
- App Server initialized; `account/rateLimits/read` and `account/usage/read` succeeded. A thread query returned `threadUsage: null`. No model request or allowance reset was performed.
- Browser check: conversation token cards, call table, cache/reasoning details, account limits, reset times, cumulative tokens, and daily buckets rendered. Missing estimates displayed as unavailable. Layout was inspected.

Initial listening was blocked by the sandbox; HTTP tests passed after authorization. Official format validation used PyYAML in the workspace, not as a runtime dependency. An initial JavaScript bracket error was fixed before the final syntax/data checks passed.

### Coverage

1. Duplicate cumulative snapshots do not double-count; new calls with equal last values but different cumulative values still count.
2. Active/archive copies of a conversation and copied fork events are deduplicated.
3. Cache/reasoning subcategories are not counted twice; missing breakdowns and empty turns retain null.
4. Initial history, gaps between calls, cross-turn intervals, cumulative decreases, and initial zero counts.
5. Partial-line recovery, truncated/deleted files, damaged lines, and unknown field structures.
6. Multiple limit buckets, older fields, unknown remaining percentages, and percentage boundaries.
7. App Server initialization, read-only allowlist, exits, timeout cleanup, and partial API failure.
8. MCP negotiation, notifications without responses, tool listing/calls, and unknown methods.
9. HTTP access key, Host checks, and static-resource allowlist.
10. First personal-marketplace install and non-overwrite behavior.

### Not verified in version 1.0

Installation/enabling in the user's actual personal marketplace was not performed; the installer was checked in temporary directories. Not all Codex versions, native Windows, remote-host logs, subscription types, or organization admin APIs were verified at that time. Cloud usage is not automatically imported; local logs are not a complete billing ledger.

Observed values could change while the conversation was generating. Raw account responses and complete personal logs were not packaged. Use the README commands to repeat checks.
