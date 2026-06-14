"""校验 story.json 引用的视频是否在 manifest / videos/ 中存在"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STORY = ROOT / 'data' / 'story.json'
MANIFEST = ROOT / 'data' / 'video-manifest.json'
VIDEOS = ROOT / 'videos'


def stem_from_file(name):
    import re
    return re.sub(r'\.(mp4|mov|MP4|MOV)$', '', name, flags=re.I)


def main():
    story = json.loads(STORY.read_text(encoding='utf-8'))
    manifest = json.loads(MANIFEST.read_text(encoding='utf-8')) if MANIFEST.exists() else {}

    missing = []
    for node_id, node in story.get('nodes', {}).items():
        vf = node.get('video')
        if not vf:
            continue
        stem = stem_from_file(vf)
        fname = manifest.get(stem)
        if fname and (VIDEOS / fname).is_file():
            continue
        if (VIDEOS / vf).is_file():
            continue
        missing.append((node_id, node.get('map'), vf, stem, fname))

    if missing:
        print('以下节点缺少本地视频文件：')
        for node_id, map_id, vf, stem, fname in missing:
            print(f'  节点 {node_id} (map {map_id}): {vf}  stem={stem}  manifest={fname or "无"}')
        sys.exit(1)

    print(f'OK: {len(story["nodes"])} 个节点视频均已在 videos/ 中找到。')


if __name__ == '__main__':
    main()
