/**
 * 讯飞星火 Spark Lite — 线上代理默认参数（可提交 GitHub，不含密钥）
 */
export const LLM_PROXY = {
  /** CloudBase / Worker 代理地址；留空则用设置页本机保存的地址 */
  proxyUrl: '',

  model: 'lite',
  maxTokens: 1024,
  temperature: 0.75
};
