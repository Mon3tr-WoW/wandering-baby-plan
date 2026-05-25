/**
 * LLM API 配置模板
 * 使用方法：复制本文件为 llm-config.js，填入你的 baseUrl 与 apiKey。
 * llm-config.js 已加入 .gitignore，请勿将密钥提交到公开仓库。
 */
export const LLM_CONFIG = {
  /** API 根地址，末尾不要加斜杠。交大默认示例： */
  baseUrl: 'https://models.sjtu.edu.cn/api/v1',

  /** 申请到的 API Key（Bearer Token） */
  apiKey: '在此填写你的 API Key',

  /** 调用模型 id，参见 docs/调用文档指南.txt */
  model: 'deepseek-chat',

  maxTokens: 1024,
  temperature: 0.75
};
