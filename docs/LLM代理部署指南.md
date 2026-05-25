# LLM 部署指南 — 讯飞星火 Spark Lite

游戏使用 **讯飞星火 Spark Lite**（免费、公网可访问）。  
GitHub Pages 不能把密钥写进网页，线上需 **云函数代理** 转发请求。

---

## 一、申请星火 Lite 密钥

1. 打开 [讯飞开放平台控制台](https://console.xfyun.cn/services/cbm)
2. 领取 **Spark Lite** 免费额度
3. 进入 Lite 版本页面，找到 **HTTP 接口** 认证信息
4. 复制 **APIPassword**（一串字符，用作 Bearer Token）

> **说明：** 控制台还会显示 APPID、APIKey、APISecret，它们主要用于 **WebSocket** 接口。  
> 本项目按 `docs/调用文档指南.txt` 使用 **HTTP 接口**，只需 **APIPassword**，无需自己拼 WebSocket 鉴权。

HTTP 请求格式：

```
POST https://spark-api-open.xf-yun.com/v1/chat/completions
Authorization: Bearer <你的 APIPassword>
model: lite
```

---

## 二、本地开发（localhost）

```powershell
copy js\llm-config.example.js js\llm-config.js
```

编辑 `js/llm-config.js`：

```javascript
export const LLM_CONFIG = {
  baseUrl: 'https://spark-api-open.xf-yun.com/v1',
  apiPassword: '你的APIPassword',  // ← 填这里
  model: 'lite',
  maxTokens: 1024,
  temperature: 0.75
};
```

```powershell
python -m http.server 8080
```

打开 `http://localhost:8080/` 测试对话。

若浏览器报 CORS 错误，请改用下方 **CloudBase 代理**，在系统设置填代理地址。

---

## 三、线上 GitHub Pages（必须走代理）

### 1. 部署腾讯云 CloudBase 云函数

1. [腾讯云开发 CloudBase](https://cloud.tencent.com/product/tcb) 新建环境
2. 云函数 `llm-proxy` → 粘贴 `cloudfunctions/llm-proxy/index.js`
3. **环境变量**：

| 变量 | 值 |
|------|-----|
| `SPARK_API_PASSWORD` | 你的 APIPassword |
| `SPARK_MODEL` | `lite` |
| `ALLOWED_ORIGINS` | `https://mon3tr-wow.github.io` |

4. 开启 **HTTP 访问**，路径 `/llm-proxy`，复制地址

### 2. 配置游戏

**方式 A（推荐测试）：** 游戏 → **系统设置** → **量子通讯代理** → 粘贴 CloudBase 地址 → 保存

**方式 B（全员默认）：** 编辑 `js/llm-proxy-config.js` 的 `proxyUrl`

### 3. 更新 Cloudflare Worker（若在用）

重新粘贴 `worker/llm-proxy.js`，环境变量改为 `SPARK_API_PASSWORD`（可删除旧的 `LLM_API_KEY` / 交大 URL）。

---

## 四、推送到 GitHub

```powershell
cd "C:\Users\Mon3tr\Desktop\GamePrograming\Mini works\wandering-baby-plan"
git add .
git commit -m "切换讯飞星火 Spark Lite"
git push origin main
```

**切勿** commit `js/llm-config.js`（已在 .gitignore）。

---

## 五、常见问题

| 现象 | 处理 |
|------|------|
| 401 invalid user | APIPassword 错误或过期，重新复制 |
| 11201 日流控超限 | 免费额度用完，次日再试或升级套餐 |
| Failed to fetch | 代理地址错，或 workers.dev 被墙 → 用 CloudBase |
| 本地 CORS 错误 | 改用 CloudBase 代理，不要浏览器直连 |

---

## 检查清单

- [ ] 讯飞控制台已领取 Lite 额度
- [ ] 已复制 **APIPassword**（HTTP 接口）
- [ ] 本地 `llm-config.js` 或 CloudBase `SPARK_API_PASSWORD` 已配置
- [ ] 游戏设置页或 `llm-proxy-config.js` 已填代理 URL
- [ ] `git push` 后 Pages 对话成功
