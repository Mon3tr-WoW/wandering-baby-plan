/**
 * 线上 LLM 代理地址（可安全提交到 GitHub，不含 API Key）
 *
 * ⚠️ 修改后必须 git push，GitHub Pages 才会生效！
 * 部署步骤见 docs/LLM代理部署指南.md
 */
export const LLM_PROXY = {
  /** Cloudflare Worker 公网地址（不要末尾斜杠） */
  proxyUrl: 'https://wanderingbabyllm.18916673120.workers.dev',

  model: 'deepseek-chat',
  maxTokens: 1024,
  temperature: 0.75
};
