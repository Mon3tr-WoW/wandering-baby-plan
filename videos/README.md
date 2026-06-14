# 剧情视频（本地开发用）

线上 **GitHub Pages** 从 **GitHub Releases** 加载视频，不占 Git LFS 配额。  
完整步骤见：[docs/视频托管与发布指南.md](../docs/视频托管与发布指南.md)

## 本地测试（重要）

1. 把视频放进本目录（文件名与磁盘一致，如 `1.mov`、`B10.1.mp4`）
2. 在项目根目录运行：

```powershell
python scripts/build-video-manifest.py
```

3. 用 **HTTP 服务器** 打开游戏（不要用 `file://` 双击 HTML）：

```powershell
python -m http.server 8080
```

浏览器访问：`http://localhost:8080`

游戏通过 `data/video-manifest.json` 精确匹配文件名，不再猜测扩展名。

## 线上发布

**不要**把视频 `git push` 进仓库。请：

1. 运行 `python scripts/build-video-manifest.py` 更新清单
2. 提交 `data/video-manifest.json` 到 Git
3. 将全部视频 + `video-manifest.json` 上传到 GitHub Release（标签 `videos-v1`）
