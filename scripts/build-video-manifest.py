"""扫描 videos/ 并生成 data/video-manifest.json（与 Release 全 MP4 对齐）"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VIDEOS = ROOT / 'videos'
STORY = ROOT / 'data' / 'story.json'
OUT = ROOT / 'data' / 'video-manifest.json'

EXTS = {'.mp4', '.mov', '.MP4', '.MOV'}

STEM_ALIASES = {
    'B10.1': 'B10_1',
}


def file_priority(path: Path) -> tuple:
    ext = path.suffix.lower()
    return (0 if ext == '.mp4' else 1, path.name.lower())


def stem_from_video_field(name: str) -> str:
    return re.sub(r'\.(mp4|mov|MP4|MOV)$', '', name, flags=re.I)


def release_filename(stem: str) -> str:
    return f'{stem}.mp4'


def main():
    best: dict[str, Path] = {}
    if VIDEOS.is_dir():
        for f in VIDEOS.iterdir():
            if not f.is_file() or f.suffix not in EXTS:
                continue
            prev = best.get(f.stem)
            if prev is None or file_priority(f) < file_priority(prev):
                best[f.stem] = f

    manifest: dict[str, str] = {}
    for stem, path in sorted(best.items()):
        if path.suffix.lower() == '.mp4':
            manifest[stem] = path.name if path.suffix == '.mp4' else release_filename(stem)
        else:
            # 本地仅有 .mov，Release v4 已全量 .mp4
            manifest[stem] = release_filename(stem)

    if STORY.exists():
        story = json.loads(STORY.read_text(encoding='utf-8'))
        for node in story.get('nodes', {}).values():
            vf = node.get('video')
            if not vf:
                continue
            stem = stem_from_video_field(vf)
            if stem not in manifest:
                manifest[stem] = release_filename(stem)

    for alias, target in STEM_ALIASES.items():
        if target in manifest and alias not in manifest:
            manifest[alias] = manifest[target]

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    mp4_count = sum(1 for v in manifest.values() if v.lower().endswith('.mp4'))
    print(f'Wrote {len(manifest)} entries ({mp4_count} mp4) -> {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
