#!/usr/bin/env python3
"""Create a 30-second narrated English product overview using illustrative usage data."""
import json
from functools import lru_cache
from pathlib import Path
import subprocess
import argparse
import tempfile
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
WIDTH, HEIGHT, FPS, SECONDS = 1280, 720, 24, 30
FONT = '/System/Library/Fonts/STHeiti Medium.ttc'
BG, CARD, INK, MUTED, ACCENT = '#10191e', '#25333c', '#f1f6f7', '#9dafb9', '#8ae1c0'


@lru_cache
def font(size):
    return ImageFont.truetype(FONT, size)


def text(draw, xy, value, size=24, color=INK):
    draw.text(xy, value, font=font(size), fill=color)


def ease(value):
    value = max(0, min(1, value))
    return value * value * (3 - 2 * value)


def panel(expansion, growth):
    height = round(280 + 102 * expansion)
    image = Image.new('RGBA', (470, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((0, 0, 469, height-1), 17, fill=CARD)
    for x, color in [(22, '#df8178'), (43, '#dfc184'), (64, ACCENT)]:
        draw.ellipse((x, 17, x+10, 27), fill=color)
    text(draw, (135, 13), 'Week 40% · Resets in 4d', 20, MUTED)
    draw.line((16, 47, 454, 47), fill='#3c4c56')
    text(draw, (20, 64), '1 active', 20, MUTED)
    text(draw, (270, 64), '40% left this week', 18, ACCENT)
    text(draw, (20, 104), 'Update login page', 25)
    text(draw, (20, 145), 'Turn 24.50K · Total 1.20M', 20, MUTED)
    text(draw, (20, 184), 'Input 23.80K · Output 700.00', 19)
    for i, value in enumerate([.2,.5,.35,.85,.55,.3,.9,.6]):
        x = 320+i*15
        draw.rounded_rectangle((x, 112, x+9, 165), 3, fill='#40505b')
        draw.rounded_rectangle((x, 165-max(3, 52*value*growth), x+9, 165), 3,
                               fill=ACCENT if i<7 else '#7dacf7')
    text(draw, (430, 184), '−' if expansion>.5 else '+', 23, ACCENT)
    if expansion>.8:
        draw.rounded_rectangle((15, 221, 455, 294), 8, fill='#34454e')
        text(draw, (28, 233), 'Example model', 20, ACCENT)
        text(draw, (28, 265), 'input 1.12M · output 80.00K', 20)
    draw.line((16, height-51, 454, height-51), fill='#3c4c56')
    text(draw, (20, height-34), '3 resets · Next credit expires in 6d', 18, MUTED)
    return image


def frame(t, scenes):
    index = min(int(t/10), len(scenes)-1)
    local = t-index*10
    scene = scenes[index]
    image = Image.new('RGB', (WIDTH, HEIGHT), BG)
    draw = ImageDraw.Draw(image)
    text(draw, (68, 50), 'CODEX USAGE METER', 21, ACCENT)
    text(draw, (68, 175), scene['title'], 40)
    text(draw, (70, 253), scene['detail'], 24, MUTED)
    text(draw, (70, 337), f'0{index+1}', 76, ACCENT)
    # An abstract workspace keeps attention on the floating panel.
    draw.rounded_rectangle((655, 132, 1230, 564), 18, fill='#18242c')
    draw.rounded_rectangle((675, 155, 1210, 180), 8, fill='#213139')
    for row, width in enumerate([245, 365, 285, 190, 330]):
        draw.rounded_rectangle((684, 215+row*45, 684+width, 223+row*45), 4, fill='#213139')
    expansion = ease((local-1.7)/.5) if index==1 else 0
    shrink = ease((local-1.7)/.7) if index==2 else 0
    card = panel(expansion, ease((t-.2)/1.2))
    if shrink < 1:
        scale = 1-shrink*.8
        card = card.resize((round(card.width*scale), round(card.height*scale)), Image.Resampling.LANCZOS)
        if shrink:
            card.putalpha(card.getchannel('A').point(lambda a: round(a*(1-shrink))))
        x = round(714 + shrink*260)
        y = round(538-card.height - shrink*160)
        image.paste(card, (x,y), card)
    if shrink>.6:
        draw.rounded_rectangle((934, 146, 1200, 188), 14, fill=CARD)
        text(draw, (956, 155), '1 active · 40% left', 21, ACCENT)
    if index in (1,2) and 1.2<local<2.2:
        x, y = (1155, 452) if index==1 else (783, 280)
        radius = round(10+ease((local-1.2))*12)
        draw.ellipse((x-radius,y-radius,x+radius,y+radius),outline=ACCENT,width=2)
    text(draw, (68, 613), scene['caption'], 28)
    text(draw, (70, 683), 'Illustrative UI · Sample data · Unofficial project', 15, MUTED)
    text(draw, (777, 683), 'github.com/gnuser/codex-usage-meter', 17, MUTED)
    draw.rectangle((68, 660, 1212, 663), fill='#25333c')
    draw.rectangle((68, 660, 68+int(1144*t/SECONDS), 663), fill=ACCENT)
    return image


def narration(scenes, folder):
    clips = []
    for index, scene in enumerate(scenes):
        source, raw, clip = folder/f'{index}.txt', folder/f'{index}.aiff', folder/f'{index}.wav'
        source.write_text(scene['voice'])
        subprocess.run(['say', '-v', 'Samantha', '-r', '165', '-f', str(source), '-o', str(raw)], check=True)
        duration = float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration',
                        '-of','default=noprint_wrappers=1:nokey=1',str(raw)]))
        if duration > 9.7:
            raise ValueError(f'Scene {index+1} narration too long: {duration:.2f}s')
        subprocess.run(['ffmpeg','-y','-v','error','-i',str(raw),'-af',
                        'loudnorm=I=-16:TP=-1.5:LRA=7,adelay=200,apad','-t','10',
                        '-ar','48000','-ac','1',str(clip)],check=True)
        clips.append(f"file '{clip}'\n")
        print(f'Scene {index+1}: {duration:.2f}s of speech', flush=True)
    manifest = folder/'audio.concat'
    manifest.write_text(''.join(clips))
    audio = folder/'narration.wav'
    subprocess.run(['ffmpeg','-y','-v','error','-f','concat','-safe','0','-i',str(manifest),
                    '-c','copy',str(audio)],check=True)
    return audio


def main():
    scenes = json.loads((ROOT/'docs/video/scenes.json').read_text())
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', type=Path, default=Path(tempfile.gettempdir())/'codex-usage-video-preview')
    output = parser.parse_args().output_dir
    output.mkdir(exist_ok=True, parents=True)
    target = output/'getting-started.mp4'
    with tempfile.TemporaryDirectory(prefix='usage-english-') as folder:
        audio = narration(scenes, Path(folder))
        command = ['ffmpeg','-y','-v','error','-f','rawvideo','-pix_fmt','rgb24',
                   '-s',f'{WIDTH}x{HEIGHT}','-r',str(FPS),'-i','-', '-i',str(audio),
                   '-map','0:v:0','-map','1:a:0','-t',str(SECONDS),
                   '-c:v','libx264','-preset','fast','-crf','22','-c:a','aac','-b:a','160k',
                   '-pix_fmt','yuv420p','-movflags','+faststart',str(target)]
        process = subprocess.Popen(command, stdin=subprocess.PIPE)
        try:
            for n in range(FPS*SECONDS):
                process.stdin.write(frame(n/FPS, scenes).tobytes())
            process.stdin.close()
            if process.wait():
                raise RuntimeError('Video encoding failed')
        finally:
            if process.poll() is None:
                process.kill()
                process.wait()
    frame(3, scenes).save(output/'getting-started.png')
    (output/'getting-started.srt').write_text('\n'.join(
        f'{i+1}\n00:00:{i*10:02d},000 --> 00:00:{(i+1)*10:02d},000\n{s["voice"]}\n'
        for i,s in enumerate(scenes)))
    print('Created 30-second English overview with AAC narration')


if __name__ == '__main__':
    main()
