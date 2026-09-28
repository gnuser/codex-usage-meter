# Product overview video

**English** | [简体中文](README.zh-CN.md)

[Home](../../README.md) · [Watch the video](https://gnuser.github.io/codex-usage-meter/) · [English subtitles](../media/product-story-sidebar.srt)

- 108 seconds, 1920×1080 at 24 fps, H.264 video and AAC English audio.
- Why it was built, conversation/model usage, the compact window, allowance/reset reminders, optional sidebar mode, and optional Tibo updates.
- The recording owner authorized local Qwen3-TTS voice cloning. The narration is AI-generated, not a new human recording.
- Original chapters use actual app captures with edited framing and pauses. The added sidebar chapter uses the real components in a simulated layout with sample data, clearly labeled on screen. Recorded counts and dates are historical, not live account information.
- Original recordings, voice samples, and model weights are excluded.
- Approved English narration: [story.json](story.json). English subtitles are included in the video and available separately.

## Generate the legacy short preview

The legacy [scenes.json](scenes.json) and repository script use macOS Samantha to create a 30-second preview. It does not reproduce the published cloned voice. Output defaults to `codex-usage-video-preview` in the system temporary directory, so it does not overwrite the approved video.

Requires macOS, Python, Pillow, ffmpeg, `ffprobe`, and `say -v Samantha`:

```sh
python3 -m venv /tmp/usage-video-env
/tmp/usage-video-env/bin/python -m pip install Pillow
/tmp/usage-video-env/bin/python tools/make_guide_video.py
```

Use `--output-dir PATH` to choose a preview directory. When publishing different narration, align scenes and subtitles with the new audio and accurately disclose its source.

The [installation guide](../INSTALL.md) is the reference for installation commands.

The 18-second sidebar chapter starts at 01:01.42. Its narration was generated locally with Qwen3-TTS using the previously authorized narration as the voice reference; no reference recording is included. Sidebar mode remains experimental and requires local debugging; the floating window is the default.
