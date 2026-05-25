# 星火 Lite 配置指南（免费 · 无需 CloudBase）

星火 Lite **公网可用、有免费额度**。本项目默认 **浏览器直连**，不需要 CloudBase、不需要付费 HTTP 访问服务。

---

## 推荐做法（0 元）

### 1. 申请免费 APIPassword

1. 打开 [讯飞星火控制台](https://console.xfyun.cn/services/cbm)
2. 领取 **Spark Lite** 免费额度
3. 进入 Lite 页面 → **HTTP 接口** → 复制 **APIPassword**

> HTTP 接口只用 **APIPassword** 即可。APPID / APIKey / APISecret 是 WebSocket 用的，本项目不需要。

### 2. 在游戏里保存（仅存本机）

1. 打开游戏（本地或 GitHub Pages 均可）
2. **系统设置** → **量子通讯 · 星火 Lite**
3. 粘贴 **APIPassword**
4. 点 **保存密钥**
5. 返回 → **与新人类对话** 测试

状态应显示：**量子链路 · 星火 Lite（直连）**

密钥保存在 **本机浏览器**，不会上传到 GitHub。

---

## 三种配置方式对比

| 方式 | 费用 | 谁都能用 | 说明 |
|------|------|----------|------|
| **系统设置保存** ⭐ | 免费 | 仅本机浏览器 | 最推荐，你自己玩足够 |
| `js/llm-config.js` | 免费 | 仅本地开发 | 已 gitignore，不上传 |
| `js/llm-spark-public.js` | 免费 | 所有访客 | 密钥会进 GitHub，可能被他人盗用额度 |

若希望 **所有玩家免配置**：复制 `js/llm-spark-public.example.js` 为 `llm-spark-public.js`，填入 APIPassword 并 push（需接受额度被盗风险）。

---

## 还要不要 CloudBase？

**一般不需要。** 只有浏览器报 CORS 错误时才考虑「高级 → HTTP 代理」。

---

## 推送到 GitHub

```powershell
cd "C:\Users\Mon3tr\Desktop\GamePrograming\Mini works\wandering-baby-plan"
git add .
git commit -m "星火 Lite 直连：系统设置保存 APIPassword，无需 CloudBase"
git push origin main
```

**不要** commit `js/llm-config.js` 或含真实密钥的 `llm-spark-public.js`（除非你接受公开密钥）。

---

## 常见问题

| 现象 | 处理 |
|------|------|
| 尚未配置 APIPassword | 系统设置里保存密钥 |
| 401 invalid user | APIPassword 复制错误 |
| CORS / Failed to fetch | 展开「高级」填代理，或换浏览器试 |
| 11201 日流控超限 | 免费额度用完，次日再试 |
