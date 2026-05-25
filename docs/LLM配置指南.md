# 星火 Lite 配置指南（免费 · WebSocket 直连）

星火 Lite **公网可用、有免费额度**。本项目通过 **WebSocket** 在浏览器里直连讯飞，**不需要 CloudBase**，也**不会遇到 HTTP 的 CORS 问题**。

---

## 为什么不能用 APIPassword？

控制台里的 **HTTP 接口 APIPassword** 只能在服务器或 Postman 里用。  
网页（GitHub Pages / 本地浏览器）用 `fetch` 调 `https://spark-api-open.xf-yun.com` 会被浏览器 **CORS 拦截**，所以你会看到「无法连接星火 API」。

**正确做法：** 使用控制台里的 **WebSocket 鉴权信息**（APPID、APIKey、APISecret）。

---

## 推荐做法（0 元）

### 1. 在讯飞控制台获取 WebSocket 密钥

1. 打开 [讯飞星火控制台](https://console.xfyun.cn/services/cbm)
2. 领取 **Spark Lite** 免费额度
3. 进入 Lite 应用 → 找到 **WebSocket 接口** / **鉴权信息**
4. 复制这三项：
   - **APPID**
   - **APIKey**
   - **APISecret**

> 注意：这三项和 HTTP 的 **APIPassword 不是同一套东西**。请复制 WebSocket 那一栏，不要填 APIPassword。

### 2. 在游戏里保存（仅存本机）

1. 打开游戏（本地 `python -m http.server 8080` 或 GitHub Pages 均可）
2. **系统设置** → **量子通讯 · 星火 Lite**
3. 分别粘贴 **APPID、APIKey、APISecret**
4. 点 **保存密钥**
5. 返回 → **与新人类对话** 测试

状态应显示：**量子链路 · 星火 Lite（WebSocket）**

密钥保存在 **本机浏览器 localStorage**，不会上传到 GitHub。

---

## 三种配置方式对比

| 方式 | 费用 | 谁都能用 | 说明 |
|------|------|----------|------|
| **系统设置保存** ⭐ | 免费 | 仅本机浏览器 | 最推荐 |
| `js/llm-config.js` | 免费 | 仅本地开发 | 已 gitignore，填 appId/apiKey/apiSecret |
| HTTP 代理（高级） | 视部署而定 | 可全员 | CloudBase / Worker，需自行部署 |

---

## 还要不要 CloudBase？

**一般不需要。** 只有 WebSocket 也连不上、或你想把 HTTP APIPassword 藏在服务端时，才在「高级 → HTTP 代理」填 CloudBase 地址。

---

## 推送到 GitHub

```powershell
cd "C:\Users\Mon3tr\Desktop\GamePrograming\Mini works\wandering-baby-plan"
git add .
git commit -m "星火 Lite WebSocket 直连，修复浏览器 CORS"
git push origin main
```

**不要** commit 含真实密钥的 `js/llm-config.js`。

---

## 常见问题

| 现象 | 处理 |
|------|------|
| 无法连接星火 API / CORS | 改用 WebSocket 三件套，不要用 APIPassword |
| WebSocket 连接失败 | 检查 APPID/APIKey/APISecret 是否来自 WebSocket 鉴权 |
| 尚未配置密钥 | 系统设置里保存三项并点「保存密钥」 |
| 11201 日流控超限 | 免费额度用完，次日再试 |
| 401 / 鉴权失败 | 密钥复制错误或已重置，到控制台重新复制 |
