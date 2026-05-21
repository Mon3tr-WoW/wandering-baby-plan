# 流浪婴儿计划：方舟号

B 站风格互动视频网页游戏（静态版）。播放视频 → 选择分支 → 星图回溯 → 多结局收集。

## 本地测试

因浏览器安全策略，**不要**直接双击 `index.html`，请用本地 HTTP 服务：

```powershell
cd wandering-baby-plan
python -m http.server 8080
```

浏览器打开：<http://localhost:8080/>

将视频文件放入 `videos/` 目录，命名与 `data/story.json` 中一致，例如：

- `1.mp4`, `2.mp4`, `4_1.mp4`, `15_1.mp4`, `18_1.mp4` …

## 部署到 GitHub Pages

1. 在 GitHub 新建仓库，上传本文件夹全部内容（或只上传 `wandering-baby-plan` 内文件到仓库根目录）。
2. 仓库 **Settings → Pages → Build and deployment → Source** 选 **Deploy from a branch**。
3. Branch 选 `main`，文件夹选 `/ (root)`，保存。
4. 访问：`https://<你的用户名>.github.io/<仓库名>/`

若仓库名是 `wandering-baby-plan`，网址即为该路径。

### 视频太大？用 Git LFS + Actions 部署

普通 `git push` 无法上传超过约 100MB 的单文件。请使用 **Git LFS** 存放 `videos/*.mp4`。

**注意：** GitHub Pages 若选「从分支部署」，LFS 视频可能无法播放。本项目已包含 `.github/workflows/deploy-pages.yml`，请在仓库 **Settings → Pages → Source** 选择 **GitHub Actions**。

**新人完整图文步骤见：** [docs/部署与Git-LFS指南.md](docs/部署与Git-LFS指南.md)

若 LFS 流量不够，可将视频放外链 CDN，并修改 `js/app.js` 中的 `VIDEO_BASE`。

## 修改剧情

编辑 `data/story.json` 即可增删节点，无需改核心逻辑。节点 `id` 与视频文件名对应（小数点用下划线，如 `4_1` → `4_1.mp4`）。

## 预留功能

- `flags` 含 `llm_hook` / `yolo_hook` 的节点（完美结局 27）会在界面右下角显示预留面板。
- 后续可在 `js/` 下新增 `llm.js`、`gesture.js` 并挂接。

## 技术栈

- HTML / CSS / ES Modules
- `localStorage` 自动存档
- 无构建步骤，适合 GitHub Pages
