# 讲解视频制作说明

成片：[getting-started.mp4](../media/getting-started.mp4) · [英文字幕](../media/getting-started.srt)

- 约 29 秒，1280×720、24 fps，H.264 视频和 AAC 英文音轨。
- 只讲三个重点：查看用量、展开模型、收起窗口。
- 旁白经录音本人授权，使用 Qwen3-TTS 在本机克隆生成；是 AI 合成声音，不是新的真人录音。
- 画面使用示意界面和虚构数据，不是屏幕实录。
- 仓库只发布获准的成片，不包含原始录音、声音样本或模型权重。
- 英文文案见 [scenes.json](scenes.json)。字幕时间轴与发布版音轨一致。

## 生成画面预览

仓库中的脚本使用 macOS Samantha 系统声音生成 30 秒预览，不会复现发布版的克隆音色。默认写入系统临时目录的 `codex-usage-video-preview`，不会覆盖已批准的成片。

需要 macOS、Python、Pillow、ffmpeg，以及可用的 `ffprobe` 和 `say -v Samantha`：

```sh
python3 -m venv /tmp/usage-video-env
/tmp/usage-video-env/bin/python -m pip install Pillow
/tmp/usage-video-env/bin/python tools/make_guide_video.py
```

可用 `--output-dir 路径` 指定预览输出目录。发布新旁白时，应重新匹配画面与字幕时间轴，并准确标注声音来源。

安装命令以 [安装指南](../INSTALL.md) 为准。
