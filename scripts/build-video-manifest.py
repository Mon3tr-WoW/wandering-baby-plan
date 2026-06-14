"""扫描 videos/ 目录，生成 data/video-manifest.json"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VIDEOS = ROOT / 'videos'
OUT = ROOT / 'data' / 'video-manifest.json'

EXTS = {'.mp4', '.mov', '.MP4', '.MOV'}

# 旧文件名 stem → 当前磁盘 stem（如 B10.1 → B10_1）
STEM_ALIASES = {
    'B10.1': 'B10_1',
}


def main():
    manifest = {}
    if VIDEOS.is_dir():
        for f in sorted(VIDEOS.iterdir()):
            if not f.is_file() or f.suffix not in EXTS:
                continue
            manifest[f.stem] = f.name

    for alias, target in STEM_ALIASES.items():
        if target in manifest and alias not in manifest:
            manifest[alias] = manifest[target]

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Wrote {len(manifest)} entries -> {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
