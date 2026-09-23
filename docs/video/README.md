# Product overview video

**English** | [简体中文](README.zh-CN.md)

[Home](../../README.md) · [Watch the video](https://gnuser.github.io/codex-usage-meter/) · [English subtitles](../media/getting-started.srt)

- About 29 seconds, 1280×720 at 24 fps, H.264 video and AAC English audio.
- Three essentials: check usage, expand model details, and hide the window.
- The recording owner authorized local Qwen3-TTS voice cloning. The narration is AI-generated, not a new human recording.
- The visuals use illustrative UI and sample data, not a screen recording.
- Only the approved finished video is published. Original recordings, voice samples, and model weights are excluded.
- English narration text is in [scenes.json](scenes.json). Subtitle timing matches the published audio.

## Generate a preview

The repository script uses macOS Samantha to create a 30-second preview. It does not reproduce the published cloned voice. Output defaults to `codex-usage-video-preview` in the system temporary directory, so it does not overwrite the approved video.

Requires macOS, Python, Pillow, ffmpeg, `ffprobe`, and `say -v Samantha`:

```sh
python3 -m venv /tmp/usage-video-env
/tmp/usage-video-env/bin/python -m pip install Pillow
/tmp/usage-video-env/bin/python tools/make_guide_video.py
```

Use `--output-dir PATH` to choose a preview directory. When publishing different narration, align scenes and subtitles with the new audio and accurately disclose its source.

The [installation guide](../INSTALL.md) is the reference for installation commands.
