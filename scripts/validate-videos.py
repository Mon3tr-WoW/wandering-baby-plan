"""校验 Release 所需 mp4 是否在本地 videos/ 或仅 mov 备份"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'data' / 'video-manifest.json'
VIDEOS = ROOT / 'videos'


def stem_from_name(name: str) -> str:
    return re.sub(r'\.(mp4|mov|MP4|MOV)$', '', name, flags=re.I)


def main():
    manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
    on_disk = {p.stem: p.name for p in VIDEOS.iterdir() if p.is_file()} if VIDEOS.is_dir() else {}

    missing_mp4 = []
    mov_only = []

    for stem, fname in sorted(manifest.items()):
        if stem.startswith('B10.') and stem != 'B10.1':
            continue
        if not fname.lower().endswith('.mp4'):
            continue
        mp4_path = VIDEOS / fname
        if mp4_path.is_file():
            continue
        mov_path = VIDEOS / f'{stem}.mov'
        if mov_path.is_file():
            mov_only.append((stem, fname, mov_path.name))
        else:
            alt = on_disk.get(stem)
            if alt:
                mov_only.append((stem, fname, alt))
            else:
                missing_mp4.append((stem, fname))

    if mov_only:
        print('以下条目 manifest 为 mp4，本地仅有 mov/其他（Release 须上传 mp4）：')
        for stem, want, have in mov_only:
            print(f'  {stem}: 需要 {want}，本地有 {have}')
    if missing_mp4:
        print('以下条目本地与 Release 可能均缺失：')
        for stem, fname in missing_mp4:
            print(f'  {stem}: {fname}')

    if mov_only or missing_mp4:
        print('\n请确认 videos-v4 Release 中已包含全部 .mp4，尤其是 2.mp4。')
        sys.exit(1)

    print(f'OK: manifest 中 {len(manifest)} 条 mp4 映射，本地均可找到对应 mp4 或 mov。')


if __name__ == '__main__':
    main()
