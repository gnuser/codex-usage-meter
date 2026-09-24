# 讲解视频制作说明

[English](README.md) | **简体中文**

成片：[product-story.mp4](https://gnuser.github.io/codex-usage-meter/) · [英文字幕](../media/product-story.srt)

- 83 秒，1920×1080、24 fps，H.264 视频和 AAC 英文音轨。
- 制作原因、会话与模型用量、小窗设计、额度与重置提醒，以及可选的 Tibo 更新。
- 旁白经录音本人授权，使用 Qwen3-TTS 在本机克隆生成；是 AI 合成声音，不是新的真人录音。
- 真实应用画面，经过取景与停顿剪辑。数字和日期为录制时状态，不代表当前账号信息。
- 原始录音、声音样本和模型权重不公开。
- 已确认英文文案见 [story.json](story.json)。视频内置英文字幕，也可单独下载。

## 生成旧版简短预览

旧版 [scenes.json](scenes.json) 和仓库脚本使用 macOS Samantha 系统声音生成 30 秒预览，不会复现发布版的克隆音色。默认写入系统临时目录的 `codex-usage-video-preview`，不会覆盖已批准的成片。

需要 macOS、Python、Pillow、ffmpeg，以及可用的 `ffprobe` 和 `say -v Samantha`：

```sh
python3 -m venv /tmp/usage-video-env
/tmp/usage-video-env/bin/python -m pip install Pillow
/tmp/usage-video-env/bin/python tools/make_guide_video.py
```

可用 `--output-dir 路径` 指定预览输出目录。发布新旁白时，应重新匹配画面与字幕时间轴，并准确标注声音来源。

安装命令以 [安装指南](../INSTALL.zh-CN.md) 为准。
