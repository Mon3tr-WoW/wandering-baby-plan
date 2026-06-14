import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
data = json.loads((ROOT / 'docs/videoline.json').read_text(encoding='utf-8'))

endings = {
    '1': {'title': '结局一 · 敲门', 'description': '让他敲门，你被新人类捕食。探索在第一次接触时就戛然而止。'},
    '2': {'title': '结局二 · 黑暗', 'description': '你选择出去寻找，却被黑暗中的怪物捕食。'},
    '3': {'title': '结局三 · 捕食', 'description': '无论你如何挣扎，最终仍倒在捕食者的利爪之下。'},
    '4': {'title': '结局四 · 沉默', 'description': '你保持警惕乘上飞船离开，两人突然不再说话——航程在沉默中继续。'},
    '5': {'title': '结局五 · 永夜', 'description': '你选择不开枪，永远留在黑暗之中。'},
    'A': {'title': '结局 · 沼泽', 'description': '在沼泽与密林的追踪中，你未能逃过新人类的猎杀。'},
    'B': {'title': '结局 · 巢穴', 'description': '深入巢穴的抉择成为最后一次选择，新人类终结了这次探索。'},
    'perfect': {
        'title': '完美结局 · 真相',
        'description': '你握上了新人类伸出的手，他笑着告诉我们真相。量子通讯的序幕就此拉开……'
    }
}


def video_file(v, manifest):
    if manifest and v in manifest:
        return manifest[v]
    mapping = {
        '4_1': '4_1.mov',
        '15_1': '15_1.MP4',
        '18_1': '18_1.MP4',
        '21_1': '21_1.MP4',
    }
    return mapping.get(v, f'{v}.mp4')


def main():
    manifest_path = ROOT / 'data' / 'video-manifest.json'
    manifest = {}
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text(encoding='utf-8'))

    nodes = {}
    for row in data['rows']:
        vid = row['video']
        node = {
            'map': row['map'],
            'title': f"节点 {row['map']}",
            'log': row['log'],
            'video': video_file(vid, manifest)
        }
        if row.get('gestureChoice'):
            node['gestureChoice'] = True
        if row.get('autoNext'):
            node['autoNext'] = row['autoNext']
        if row.get('ending'):
            node['ending'] = row['ending']
            if row['ending'] == 'perfect':
                node['flags'] = ['perfect', 'llm_hook', 'yolo_hook']
        if row.get('choices'):
            texts = row.get('choiceTexts') or row['choices']
            node['choices'] = [
                {'text': texts[i], 'next': row['choices'][i]}
                for i in range(len(row['choices']))
            ]
            if node.get('gestureChoice'):
                for c in node['choices']:
                    if c['text'] == '警惕':
                        c['gesture'] = 'gun'
                    elif c['text'] == '握上':
                        c['gesture'] = 'handshake'
        nodes[vid] = node

    story = {
        'meta': {'title': '流浪婴儿计划', 'version': 2, 'startNode': '1'},
        'endings': endings,
        'nodes': nodes
    }

    (ROOT / 'data/story.json').write_text(
        json.dumps(story, ensure_ascii=False, indent=2) + '\n',
        encoding='utf-8'
    )
    print(f'Wrote {len(nodes)} nodes to data/story.json')


if __name__ == '__main__':
    main()
