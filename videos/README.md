# 剧情视频

## 玩家（线上）

**不需要下载任何东西。** 打开 GitHub Pages 网址即可，视频自动从 **GitHub Releases** 加载。

## 开发者（本地调试）

把视频放进本目录，运行：

```powershell
python scripts/build-video-manifest.py
python -m http.server 8080
```

浏览器访问 `http://localhost:8080`（仅开发用，玩家不走此路径）。

## 更新线上视频

1. 修改或新增 `videos/` 内文件后运行 `python scripts/build-video-manifest.py`
2. `git add data/video-manifest.json` 并 push
3. 把**同名文件**上传到 GitHub Release 标签 `videos-v1`

详见 [docs/视频托管与发布指南.md](../docs/视频托管与发布指南.md)
