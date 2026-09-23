# Codex Usage Meter

**English** | [简体中文](README.zh-CN.md)

A small floating window for Codex usage. See recent conversations, input/output tokens, and remaining weekly allowance. Hide it in the **macOS menu bar** or **Windows system tray** when you need more space.

[![Watch the 29-second demo](docs/media/getting-started.png)](docs/media/getting-started.mp4)

[Watch the demo](docs/media/getting-started.mp4) · English AI-cloned narration, used with permission; sample data.

## Install

[**macOS or Windows setup →**](docs/INSTALL.md)

Want to try it in a browser first? With Python 3.10+ installed:

```sh
git clone https://github.com/gnuser/codex-usage-meter.git
cd codex-usage-meter
python3 meter.py serve
```

On Windows, use `py -3 meter.py serve`. Open the URL printed in the terminal and keep the terminal running.

## Use

- Send a message in Codex: recently active conversations appear.
- Click a title to open that conversation.
- Click **▸** for usage by model.
- Click the allowance percentage for reset details.
- Close the window to hide it; restore it from the menu bar or tray.

[Usage & quick fixes](docs/USAGE.md) · [Optional integrations & reference](docs/REFERENCE.md)

Unofficial project. Logs are read locally. Tokens and subscription allowance are different measurements. Do not share panel URLs containing access keys.
