# 流浪婴儿计划：方舟号

B 站风格互动视频网页游戏（静态版）。播放视频 → 选择分支 → 星图回溯 → 多结局收集。

## 本地测试

因浏览器安全策略，**不要**直接双击 `index.html`，请用本地 HTTP 服务：

```powershell
cd wandering-baby-plan
python -m http.server 8080
```

浏览器打开：<http://localhost:8080/>

将视频文件放入 `videos/` 目录（本地开发用，勿提交进 Git）。

## 部署到 GitHub Pages

1. 仓库 **Settings → Pages → Source** 选 **GitHub Actions**（不要选 Deploy from a branch）。
2. 剧情视频放在 **GitHub Releases**（标签 `videos-v1`），不占 LFS 配额。
3. 推送代码后 Actions 自动部署。

**完整步骤（Release 上传 + push + 验证）：** [docs/视频托管与发布指南.md](docs/视频托管与发布指南.md)

线上视频地址配置：`js/video-config.js`

## 修改剧情

编辑 `data/story.json` 即可增删节点，无需改核心逻辑。节点 `id` 与视频文件名对应（小数点用下划线，如 `4_1` → `4_1.mov`）。

## LLM「与新人类对话」

| 环境 | 配置 |
|------|------|
| 本地 `localhost` | 复制 `js/llm-config.example.js` → `js/llm-config.js`，填入 API Key（**不上传 GitHub**） |
| 线上 GitHub Pages | 部署 **Cloudflare Worker** 代理，在 `js/llm-proxy-config.js` 填 Worker 地址（**不含 Key**） |

完整步骤：[docs/LLM代理部署指南.md](docs/LLM代理部署指南.md)

## 技术栈

- HTML / CSS / ES Modules
- `localStorage` 自动存档
- 无构建步骤，适合 GitHub Pages
