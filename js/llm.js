/**
 * 新人类 LLM 对话 API
 *
 * - 本地 localhost：直连 API，密钥写在 js/llm-config.js（不上传 GitHub）
 * - 线上 GitHub Pages：经 Cloudflare Worker 代理，密钥只存在 Worker 服务端
 */

const DEFAULT_LLM_CONFIG = {
  baseUrl: 'https://models.sjtu.edu.cn/api/v1',
  apiKey: '',
  model: 'deepseek-chat',
  maxTokens: 1024,
  temperature: 0.75
};

const DEFAULT_LLM_PROXY = {
  proxyUrl: '',
  model: 'deepseek-chat',
  maxTokens: 1024,
  temperature: 0.75
};

/** @type {typeof DEFAULT_LLM_CONFIG} */
let LLM_CONFIG = { ...DEFAULT_LLM_CONFIG };
/** @type {typeof DEFAULT_LLM_PROXY} */
let LLM_PROXY = { ...DEFAULT_LLM_PROXY };
let configLoaded = false;

function isLocalDev() {
  if (typeof location === 'undefined') return false;
  const h = location.hostname;
  return h === 'localhost' || h === '127.0.0.1';
}

function useProxyMode() {
  if (isLocalDev()) return false;
  const url = LLM_PROXY.proxyUrl?.trim() ?? '';
  return url.length > 0 && !url.includes('你的-worker');
}

async function loadLlmConfig() {
  if (configLoaded) return;
  configLoaded = true;

  for (const path of ['./llm-proxy-config.js', './llm-proxy-config.example.js']) {
    try {
      const mod = await import(path);
      if (mod?.LLM_PROXY) {
        LLM_PROXY = { ...DEFAULT_LLM_PROXY, ...mod.LLM_PROXY };
        break;
      }
    } catch {
      /* 忽略 */
    }
  }

  if (isLocalDev()) {
    for (const path of ['./llm-config.js', './llm-config.example.js']) {
      try {
        const mod = await import(path);
        if (mod?.LLM_CONFIG) {
          LLM_CONFIG = { ...DEFAULT_LLM_CONFIG, ...mod.LLM_CONFIG };
          return;
        }
      } catch {
        /* 忽略 */
      }
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
  if (useProxyMode()) return true;

  const key = LLM_CONFIG.apiKey?.trim() ?? '';
  return key.length > 0 && !key.includes('在此填写');
}

export function getLlmModeLabel() {
  if (useProxyMode()) return '量子链路 · 代理模式';
  if (isLlmConfigured()) return '链路就绪 · 本地直连';
  return '未配置';
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

function notConfiguredError() {
  if (isLocalDev()) {
    throw new Error('尚未配置 API Key。请复制 js/llm-config.example.js 为 js/llm-config.js 并填入密钥。');
  }
  throw new Error(
    '线上尚未启用 LLM 代理。请部署 Cloudflare Worker 并在 js/llm-proxy-config.js 填入 proxyUrl。详见 docs/LLM代理部署指南.md'
  );
}

function parseAssistantReply(data) {
  const msg = data?.choices?.[0]?.message;
  return (msg?.content ?? msg?.reasoning_content ?? '').trim();
}

async function sendViaProxy(userText) {
  const url = LLM_PROXY.proxyUrl.replace(/\/$/, '');
  const body = {
    model: LLM_PROXY.model,
    messages: buildMessages(userText),
    stream: false,
    max_tokens: LLM_PROXY.maxTokens,
    temperature: LLM_PROXY.temperature
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`代理 ${res.status}：${errText.slice(0, 200) || res.statusText}`);
  }

  const data = await res.json();
  const reply = parseAssistantReply(data);
  if (!reply) {
    throw new Error('模型未返回有效内容。');
  }
  return reply;
}

async function sendDirect(userText) {
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
  const reply = parseAssistantReply(data);
  if (!reply) {
    throw new Error('模型未返回有效内容。');
  }
  return reply;
}

/**
 * @param {string} userText
 * @returns {Promise<string>}
 */
export async function sendToNewHuman(userText) {
  await loadLlmConfig();

  if (!isLlmConfigured()) {
    notConfiguredError();
  }

  const reply = useProxyMode() ? await sendViaProxy(userText) : await sendDirect(userText);

  history.push({ role: 'user', content: userText });
  history.push({ role: 'assistant', content: reply });

  return reply;
}
