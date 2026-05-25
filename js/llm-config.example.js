/**
 * 讯飞星火 Spark Lite — 本地配置模板
 *
 * 1. 打开 https://console.xfyun.cn/services/cbm 领取 Lite 免费额度
 * 2. 在对应版本页面找到「HTTP 接口」→ 复制 APIPassword
 *    （HTTP 用 APIPassword；APPID/APISecret/APIKey 主要用于 WebSocket，本项目用 HTTP 即可）
 * 3. 复制本文件为 llm-config.js，填入 apiPassword
 * 4. llm-config.js 已在 .gitignore，勿提交到 GitHub
 */
export const LLM_CONFIG = {
  baseUrl: 'https://spark-api-open.xf-yun.com/v1',

  /** HTTP 接口 APIPassword，请求头：Authorization: Bearer <apiPassword> */
  apiPassword: 'ognWJiqHOxpeEBzINHTD:WFQScIDmDgDdGJyaIQna',

  /** Spark Lite 模型 id，见 docs/调用文档指南.txt */
  model: 'lite',

  maxTokens: 1024,
  temperature: 0.75
};
