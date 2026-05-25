# 剧情视频（本地开发用）

线上 **GitHub Pages** 从 **GitHub Releases** 加载视频，不占 Git LFS 配额。  
完整步骤见：[docs/视频托管与发布指南.md](../docs/视频托管与发布指南.md)

## 本地测试

把视频放进本目录，文件名与磁盘上一致（多为 `.mov` / `.MP4`），例如：

`1.mov` `2.mov` … `30.MP4`

`data/story.json` 里写的是逻辑名（如 `1.mp4`），游戏会自动尝试 `.mp4` / `.mov` / `.MP4` / `.MOV` 多种扩展名。

## 线上发布

**不要**把视频 `git push` 进仓库。请上传到 GitHub Release（标签 `videos-v1`），与 `js/video-config.js` 中配置一致。
