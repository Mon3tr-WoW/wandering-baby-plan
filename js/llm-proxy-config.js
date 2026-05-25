/**
 * 线上 LLM 代理地址（可安全提交到 GitHub，不含 API Key）
 *
 * API Key 只放在 Cloudflare Worker 的加密环境变量里。
 * 部署步骤见 docs/LLM代理部署指南.md
 */
export const LLM_PROXY = {
  /**
   * Cloudflare Worker 公网地址，部署后填入，例如：
   * https://wandering-baby-llm.你的子域.workers.dev
   */
  proxyUrl: '',

  model: 'deepseek-chat',
  maxTokens: 1024,
  temperature: 0.75
};
