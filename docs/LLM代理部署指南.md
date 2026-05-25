# LLM 代理部署指南（API Key 不泄露）

GitHub Pages 是**纯静态**网站，浏览器里不能直接写 API Key（会被任何人看到）。

解决方案：**Cloudflare Worker 免费代理** —— Key 只存在 Cloudflare 服务端，网页只访问你的 Worker 公网地址。

---

## 原理

```
玩家浏览器 (GitHub Pages)
    ↓ POST（无 Key）
Cloudflare Worker（持有 LLM_API_KEY 加密变量）
    ↓ POST + Authorization
交大 API (models.sjtu.edu.cn)
```

---

## 第一步：注册 Cloudflare（免费）

1. 打开 <https://dash.cloudflare.com/sign-up>
2. 注册并登录（免费套餐即可）

---

## 第二步：创建 Worker

### 方式 A：网页控制台（推荐，最简单）

1. 登录 Cloudflare → 左侧 **Workers & Pages**
2. 点 **Create** → **Create Worker**
3. 名称填例如：`wandering-baby-llm` → **Deploy**
4. 进入该 Worker → **Edit code**
5. **删除**编辑器里默认代码，粘贴本项目文件：

   `worker/llm-proxy.js` 的全部内容

6. 点 **Save and deploy**

### 方式 B：命令行（可选）

```powershell
cd "C:\Users\Mon3tr\Desktop\GamePrograming\Mini works\wandering-baby-plan\worker"
```

```powershell
copy wrangler.toml.example wrangler.toml
```

```powershell
npx wrangler login
```

```powershell
npx wrangler secret put LLM_API_KEY
```

（粘贴你的交大 API Key，回车）

```powershell
npx wrangler deploy
```

---

## 第三步：配置 Worker 环境变量

在 Cloudflare Worker 页面 → **Settings** → **Variables**：

| 变量名 | 类型 | 值 |
|--------|------|-----|
| `LLM_API_KEY` | **Encrypt**（加密） | 你的交大 API Key |
| `LLM_BASE_URL` | Plain text | `https://models.sjtu.edu.cn/api/v1` |
| `LLM_MODEL` | Plain text | `deepseek-chat` |
| `ALLOWED_ORIGINS` | Plain text | `https://mon3tr-wow.github.io` |

⚠️ 填完变量后，必须回到 Worker 编辑器点 **Save and deploy**（或 Deploy），否则变量不生效。

保存后 Worker 会自动重新部署。

---

## 第四步：复制 Worker 地址

在 Worker 概览页找到访问地址，形如：

```
https://wandering-baby-llm.你的子域.workers.dev
```

---

## 第五步：写入项目配置

编辑 `js/llm-proxy-config.js`：

```javascript
export const LLM_PROXY = {
  proxyUrl: 'https://wandering-baby-llm.你的子域.workers.dev',
  model: 'deepseek-chat',
  maxTokens: 1024,
  temperature: 0.75
};
```

把 `proxyUrl` 换成你的 Worker 地址。**这里只有 URL，没有 Key，可以安全提交到 GitHub。**

⚠️ **常见遗漏：** 只在本地改了 `llm-proxy-config.js`，忘记 `git push` —— Pages 上的 `proxyUrl` 仍是空的，游戏就会提示「尚未启用 LLM 代理」。  
推送后可在浏览器打开验证：  
<https://mon3tr-wow.github.io/wandering-baby-plan/js/llm-proxy-config.js>  
应能看到你的 `proxyUrl` 地址，而不是空字符串 `''`。

---

## 第六步：推送到 GitHub

```powershell
cd "C:\Users\Mon3tr\Desktop\GamePrograming\Mini works\wandering-baby-plan"
```

```powershell
git add js/llm-proxy-config.js worker/ docs/LLM代理部署指南.md
```

```powershell
git commit -m "启用 LLM Cloudflare 代理，线上可安全对话"
```

```powershell
git push origin main
```

等 Actions 部署完成后，打开 Pages → **与新人类对话** → 发送消息测试。

---

## 本地 vs 线上

| 环境 | 调用方式 | Key 放哪里 |
|------|----------|------------|
| `localhost` | 直连交大 API | `js/llm-config.js`（不上传） |
| GitHub Pages | Cloudflare Worker | Worker 加密变量 `LLM_API_KEY` |

---

## 常见问题

### Q：提示「线上尚未启用 LLM 代理」

1. 打开 <https://mon3tr-wow.github.io/wandering-baby-plan/js/llm-proxy-config.js>  
2. 若 `proxyUrl: ''` 仍是空的 → **本地改完后没有 push**  
3. 在 PowerShell 执行 `git add js/llm-proxy-config.js` → `git commit` → `git push`  
4. 等 Actions 绿勾后 **Ctrl+Shift+R** 强刷游戏页

### Q：浏览器打开 Worker 地址显示「无法访问此页面」

- **正常情况：** 旧版 Worker 只接受 POST，浏览器 GET 可能报错；更新 `worker/llm-proxy.js` 后 GET 会显示「代理运行中」页面  
- **若完全打不开（DNS 错误）：** 国内网络可能无法访问 `*.workers.dev`，需换网络/VPN 测试，或改用国内云函数代理（见文末）  
- **验证 Worker 是否在线：** 能打开并看到 JSON `Method not allowed` 或「LLM 代理运行中」即表示 Worker 本身正常

### Q：提示「代理 403 Origin not allowed」

检查 Worker 的 `ALLOWED_ORIGINS` 是否为：

`https://mon3tr-wow.github.io`

（不要漏掉 `https`，不要加末尾斜杠）

### Q：提示「Worker 未配置 LLM_API_KEY」

在 Cloudflare Variables 里添加加密的 `LLM_API_KEY` 并重新部署。

### Q：代理 502 / API 401

- Key 是否有效、是否过期
- `LLM_BASE_URL` 是否正确
- 交大 API 是否需校园网（Worker 在海外/公网可能无法访问校内 API）

若交大 API **仅校内可访问**，Cloudflare Worker（公网）可能无法连通，需换可公网访问的 API，或改用校内可部署的代理（如学校服务器 / 阿里云函数）。

### Q：会被盗刷吗？

已限制 `ALLOWED_ORIGINS` 只允许你的 Pages 域名调用。如需更强防护，可在 Worker 里再加每日请求次数限制。

---

## 检查清单

- [ ] Cloudflare Worker 已部署 `worker/llm-proxy.js`
- [ ] `LLM_API_KEY` 已设为加密变量
- [ ] `ALLOWED_ORIGINS` = `https://mon3tr-wow.github.io`
- [ ] `js/llm-proxy-config.js` 已填 `proxyUrl`
- [ ] `git push` 后 Pages 对话测试成功
