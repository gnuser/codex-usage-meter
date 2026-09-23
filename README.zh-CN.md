# Codex 用量仪表

[English](README.md) | **简体中文**

用一个小悬浮窗查看 Codex 最近活跃的会话、输入／输出 token 和剩余周额度。不用时收进 **macOS 菜单栏**或 **Windows 系统托盘**。

[![观看 29 秒演示](docs/media/getting-started.png)](docs/media/getting-started.mp4)

[观看演示](docs/media/getting-started.mp4) · 英文 AI 克隆旁白，已获本人授权；画面为示例数据。

## 安装

[**macOS / Windows 安装步骤 →**](docs/INSTALL.zh-CN.md)

想先用浏览器试一下？安装 Python 3.10+ 后运行：

```sh
git clone https://github.com/gnuser/codex-usage-meter.git
cd codex-usage-meter
python3 meter.py serve
```

Windows 将最后一行改为 `py -3 meter.py serve`。打开终端打印的链接，并保持终端运行。

## 使用

- 在 Codex 发消息，最近活跃会话就会出现在列表中。
- 点会话标题，打开对应对话。
- 点 **▸**，查看各模型用量。
- 点额度百分比，查看重置详情。
- 关闭小窗即可收起，从菜单栏或托盘恢复。

[使用与常见问题](docs/USAGE.zh-CN.md) · [可选功能与详细参考](docs/REFERENCE.zh-CN.md)

非官方项目，日志在本机读取。token 用量不等于订阅额度。不要分享含访问密钥的面板链接。
