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

### 视频体积提示

GitHub 单文件建议不超过 100MB，仓库总大小也有限制。视频较多时建议：

- 使用 [Git LFS](https://git-lfs.github.com/)，或
- 将 `videos/` 放到外链 CDN，并修改 `js/app.js` 中的 `VIDEO_BASE` 为你的 CDN 地址。

## 修改剧情

编辑 `data/story.json` 即可增删节点，无需改核心逻辑。节点 `id` 与视频文件名对应（小数点用下划线，如 `4_1` → `4_1.mp4`）。

## 预留功能

- `flags` 含 `llm_hook` / `yolo_hook` 的节点（完美结局 27）会在界面右下角显示预留面板。
- 后续可在 `js/` 下新增 `llm.js`、`gesture.js` 并挂接。

## 技术栈

- HTML / CSS / ES Modules
- `localStorage` 自动存档
- 无构建步骤，适合 GitHub Pages
