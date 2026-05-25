/**
 * 新人类 LLM 对话 API
 *
 * llm-config.js 仅用于本地密钥（已 gitignore），线上缺失时自动回退到 example 默认配置，
 * 避免 Pages 因 404 导致整站 JS 崩溃。
 */

const DEFAULT_LLM_CONFIG = {
  baseUrl: 'https://models.sjtu.edu.cn/api/v1',
  apiKey: '',
  model: 'deepseek-chat',
  maxTokens: 1024,
  temperature: 0.75
};

/** @type {typeof DEFAULT_LLM_CONFIG} */
let LLM_CONFIG = { ...DEFAULT_LLM_CONFIG };
let configLoaded = false;

async function loadLlmConfig() {
  if (configLoaded) return;
  configLoaded = true;

  for (const path of ['./llm-config.js', './llm-config.example.js']) {
    try {
      const mod = await import(path);
      if (mod?.LLM_CONFIG) {
        LLM_CONFIG = { ...DEFAULT_LLM_CONFIG, ...mod.LLM_CONFIG };
        return;
      }
    } catch {
      /* 本地无 llm-config.js 或线上未部署时，继续尝试下一项 */
    }
  }
}

/** @type {string} */
let systemPrompt = '';
/** @type {{ role: string, content: string }[]} */
let history = [];

export async function initLlm() {
  await loadLlmConfig();

  try {
    const res = await fetch('docs/Prompt.txt');
    if (res.ok) {
      systemPrompt = (await res.text()).trim();
    }
  } catch {
    systemPrompt = '你是来自未来的新人类代表，语气平静、俯瞰旧人类。';
  }
}

export function resetLlmChat() {
  history = [];
}

export function isLlmConfigured() {
  const key = LLM_CONFIG.apiKey?.trim() ?? '';
  return key.length > 0 && !key.includes('在此填写');
}

function buildMessages(userText) {
  const msgs = [];
  if (systemPrompt) {
    msgs.push({ role: 'system', content: systemPrompt });
  }
  for (const m of history) {
    msgs.push({ role: m.role, content: m.content });
  }
  msgs.push({ role: 'user', content: userText });
  return msgs;
}

/**
 * @param {string} userText
 * @returns {Promise<string>}
 */
export async function sendToNewHuman(userText) {
  await loadLlmConfig();

  if (!isLlmConfigured()) {
    throw new Error('尚未配置 API Key。本地请编辑 js/llm-config.js；线上需在部署前填入配置或改用环境变量方案。');
  }

  const url = `${LLM_CONFIG.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const body = {
    model: LLM_CONFIG.model,
    messages: buildMessages(userText),
    stream: false,
    max_tokens: LLM_CONFIG.maxTokens,
    temperature: LLM_CONFIG.temperature
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${LLM_CONFIG.apiKey.trim()}`
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`API ${res.status}：${errText.slice(0, 200) || res.statusText}`);
  }

  const data = await res.json();
  const msg = data?.choices?.[0]?.message;
  const reply = (msg?.content ?? msg?.reasoning_content ?? '').trim();

  if (!reply) {
    throw new Error('模型未返回有效内容，请确认请求中包含 user 消息。');
  }

  history.push({ role: 'user', content: userText });
  history.push({ role: 'assistant', content: reply });

  return reply;
}
