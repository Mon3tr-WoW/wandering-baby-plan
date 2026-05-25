/**
 * 新人类 LLM 对话 API
 */
import { LLM_CONFIG } from './llm-config.js';

/** @type {string} */
let systemPrompt = '';
/** @type {{ role: string, content: string }[]} */
let history = [];

export async function initLlm() {
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
  if (!isLlmConfigured()) {
    throw new Error('请先在 js/llm-config.js 中填写 API Key 与 Base URL。');
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
