"""扫描 videos/ 目录，生成 data/video-manifest.json"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VIDEOS = ROOT / 'videos'
OUT = ROOT / 'data' / 'video-manifest.json'

EXTS = {'.mp4', '.mov', '.MP4', '.MOV'}


def main():
    manifest = {}
    if VIDEOS.is_dir():
        for f in sorted(VIDEOS.iterdir()):
            if not f.is_file() or f.suffix not in EXTS:
                continue
            manifest[f.stem] = f.name

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Wrote {len(manifest)} entries -> {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
