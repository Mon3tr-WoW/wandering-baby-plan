# 新人向：本地测试 + GitHub + Git LFS + Pages 完整步骤

---

## 第一部分：为什么 localhost 拒绝连接？

**最常见原因：本地网站服务器根本没有在运行。**

浏览器访问 `http://localhost:8080` 时，必须有一个程序在监听 8080 端口。只双击 `index.html` 不会启动服务器，而且会报错。

### 正确做法（Windows PowerShell）

1. 按 `Win` 键，输入 **PowerShell**，打开「Windows PowerShell」。
2. **逐行**复制粘贴下面命令（不要一次粘一整段带 `&&` 的）：

```powershell
cd "C:\Users\Mon3tr\Desktop\GamePrograming\Mini works\wandering-baby-plan"
```

```powershell
python -m http.server 8080
```

3. 若成功，窗口会显示类似：`Serving HTTP on :: port 8080 ...`  
   **不要关闭这个窗口**，保持它开着。
4. 打开浏览器，地址栏输入：`http://localhost:8080/` 回车。

### 若提示「找不到 python」

说明没装 Python，可以二选一：

**方案 A：安装 Python**  
- 打开 https://www.python.org/downloads/  
- 安装时勾选 **Add python.exe to PATH**  
- 装完重新打开 PowerShell，再执行上面两条命令。

**方案 B：用 Node（若已安装 Node.js）**

```powershell
cd "C:\Users\Mon3tr\Desktop\GamePrograming\Mini works\wandering-baby-plan"
npx --yes serve -l 8080
```

### 若仍拒绝连接，请检查

| 检查项 | 做法 |
|--------|------|
| 端口是否写对 | 命令里是 `8080`，浏览器也要 `http://localhost:8080/` |
| 服务器窗口是否还开着 | 关掉 PowerShell 窗口 = 服务器停止 |
| 是否用了 https | 本地用 **http** 不是 https |
| 换端口试试 | `python -m http.server 5500` → 浏览器访问 `http://localhost:5500/` |

---

## 第二部分：重要说明（Git LFS 和 GitHub Pages）

- 普通 Git 上传：**单个文件不能超过约 100MB**。
- **Git LFS**：专门存大视频，但 GitHub 免费版 LFS 有容量/流量额度（约 1GB 存储，每月约 1GB 下载流量，超出可能收费）。
- **关键点**：若在 GitHub 里用「从分支直接发布 Pages」，**LFS 里的视频可能无法在网页里播放**。

因此本项目已包含 **GitHub Actions 自动部署**（`.github/workflows/deploy-pages.yml`），会在云端把 LFS 视频正确打包后再发布到 Pages。

你需要在 GitHub 仓库设置里把 Pages 来源改成 **GitHub Actions**（下面第 7 步会写）。

---

## 第三部分：从零发布到 GitHub（一步一步）

### 步骤 0：安装软件（只需装一次）

1. **Git**  
   - 下载：https://git-scm.com/download/win  
   - 安装一路「下一步」即可。

2. **Git LFS**  
   - 下载：https://git-lfs.com/  
   - 安装后打开 **新的** PowerShell，执行一次：

```powershell
git lfs install
```

看到 `Git LFS initialized` 即成功。

3. **注册 / 登录 GitHub**  
   - https://github.com  

---

### 步骤 1：在 GitHub 网站新建空仓库

1. 登录 GitHub，右上角 **+** → **New repository**。
2. Repository name 填例如：`wandering-baby-plan`（英文、无空格）。
3. 选 **Public**（公开才能免费用 Pages）。
4. **不要**勾选 “Add a README”（我们本地已有文件）。
5. 点 **Create repository**。
6. 记下页面上的地址，类似：  
   `https://github.com/你的用户名/wandering-baby-plan.git`

---

### 步骤 2：把视频放进项目文件夹

把所有 `.mp4` 放进：

`C:\Users\Mon3tr\Desktop\GamePrograming\Mini works\wandering-baby-plan\videos\`

文件名要和 `videos\README.md` 里一致（如 `4_1.mp4`）。

---

### 步骤 3：在本地用 Git 初始化并提交

打开 PowerShell：

```powershell
cd "C:\Users\Mon3tr\Desktop\GamePrograming\Mini works\wandering-baby-plan"
```

确认 LFS 会跟踪 mp4（项目里已有 `.gitattributes`，再执行一次更稳妥）：

```powershell
git lfs track "*.mp4"
```

初始化仓库：

```powershell
git init
git add .
git status
```

`git status` 里视频应显示为 `LFS` 或 `*.mp4` 被 LFS 跟踪。若全是普通 `new file` 且视频很大，先检查 `git lfs install` 是否做过。

提交：

```powershell
git commit -m "首次提交：流浪婴儿计划互动游戏"
```

---

### 步骤 4：关联 GitHub 并推送

把下面地址换成**你自己的**仓库地址：

```powershell
git branch -M main
git remote add origin https://github.com/你的用户名/wandering-baby-plan.git
git push -u origin main
```

第一次推送会弹出登录：

- 推荐用 **GitHub Personal Access Token** 当密码（不是 GitHub 登录密码）。  
- 生成 Token：GitHub → 头像 → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)** → **Generate new token**，勾选 `repo`，生成后复制保存，在 `git push` 要密码时粘贴。

视频多、体积大时，**第一次 push 会较慢**，属正常现象。

---

### 步骤 5：开启 GitHub Pages（必须用 Actions）

1. 打开你的仓库页面 on GitHub。
2. 点 **Settings** → 左侧 **Pages**。
3. **Build and deployment** → **Source** 选 **GitHub Actions**（不要选 Deploy from a branch）。
4. 回到仓库 **Actions** 标签，应能看到 “Deploy to GitHub Pages” 正在运行或已完成。
5. 等出现绿色勾后，Settings → Pages 会显示网址，形如：  
   `https://你的用户名.github.io/wandering-baby-plan/`

在浏览器打开该网址即可游玩（无需 localhost）。

---

### 步骤 6：以后更新视频或剧情

改完文件后：

```powershell
cd "C:\Users\Mon3tr\Desktop\GamePrograming\Mini works\wandering-baby-plan"
git add .
git commit -m "更新视频或剧情"
git push
```

推送后 Actions 会自动重新部署，等 1～3 分钟再刷新网页。

---

## 第四部分：常见问题

### Q：push 时仍提示文件太大？

- 确认已执行 `git lfs install`。
- 确认 `.gitattributes` 里有 `*.mp4 filter=lfs ...`。
- 若视频在**第一次 `git add` 之前**就没走 LFS，需要：

```powershell
git lfs migrate import --include="*.mp4"
git push -u origin main --force
```

（`--force` 仅在你第一次推送失败、且仓库里还没有重要内容时使用。）

### Q：网页能打开但视频黑屏/无法播放？

- 检查 `videos` 里文件名是否与 `data/story.json` 一致。
- 打开浏览器 F12 → **Network**，看视频请求是 404 还是几十字节的文本（那是 LFS 指针，说明 Pages 没用 Actions 部署）。

### Q：LFS 流量/容量不够怎么办？

- 把视频放到网盘/对象存储/CDN，修改 `js/app.js` 里的 `VIDEO_BASE` 为外链地址，仓库只保留代码和 `story.json`。

---

## 第五部分：推荐操作顺序（总结）

1. 本地：PowerShell 运行 `python -m http.server 8080` 测试（可选）。  
2. 安装 Git + Git LFS，`git lfs install`。  
3. 视频放入 `videos/`，`git init` → `git add .` → `git commit`。  
4. GitHub 新建仓库 → `git remote add` → `git push`。  
5. Settings → Pages → Source 选 **GitHub Actions**。  
6. 用 Pages 给的网址游玩，分享给玩家。

如有某一步的具体报错截图或英文错误信息，可以对照报错继续排查。
