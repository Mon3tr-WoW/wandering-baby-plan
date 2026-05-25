/**
 * 新人类 LLM — 讯飞星火 Spark Lite（HTTP 直连，免费）
 *
 * 默认：系统设置填写 APIPassword → 浏览器直连星火公网 API，无需 CloudBase。
 * 可选：填代理 URL（高级，一般不需要）。
 */

import {
  loadProxyUrlOverride,
  loadSparkPasswordOverride
} from './llm-storage.js';

const SPARK_BASE = 'https://spark-api-open.xf-yun.com/v1';

const DEFAULT_LLM_CONFIG = {
  baseUrl: SPARK_BASE,
  apiPassword: '',
  model: 'lite',
  maxTokens: 1024,
  temperature: 0.75
};

const DEFAULT_LLM_PROXY = {
  proxyUrl: '',
  model: 'lite',
  maxTokens: 1024,
  temperature: 0.75
};

/** @type {typeof DEFAULT_LLM_CONFIG} */
let LLM_CONFIG = { ...DEFAULT_LLM_CONFIG };
/** @type {typeof DEFAULT_LLM_PROXY} */
let LLM_PROXY = { ...DEFAULT_LLM_PROXY };
let configLoaded = false;

function getEffectiveProxyUrl() {
  const override = loadProxyUrlOverride();
  if (override && !override.includes('你的')) return override;
  const url = LLM_PROXY.proxyUrl?.trim() ?? '';
  if (url && !url.includes('你的')) return url;
  return '';
}

function useProxyMode() {
  return getEffectiveProxyUrl().length > 0 && !getApiPassword();
}

function getApiPassword() {
  const fromStorage = loadSparkPasswordOverride();
  if (fromStorage) return fromStorage;

  const pw = LLM_CONFIG.apiPassword?.trim() ?? LLM_CONFIG.apiKey?.trim() ?? '';
  if (!pw || pw.includes('在此填写')) return '';
  return pw;
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

  for (const path of ['./llm-spark-public.js', './llm-spark-public.example.js']) {
    try {
      const mod = await import(path);
      const pub = mod?.SPARK_API_PASSWORD?.trim() ?? '';
      if (pub && !pub.includes('在此填写')) {
        LLM_CONFIG.apiPassword = pub;
        break;
      }
    } catch {
      /* 忽略 */
    }
  }

  for (const path of ['./llm-config.js', './llm-config.example.js']) {
    try {
      const mod = await import(path);
      if (mod?.LLM_CONFIG) {
        LLM_CONFIG = { ...DEFAULT_LLM_CONFIG, ...mod.LLM_CONFIG };
        if (mod.LLM_CONFIG.apiKey && !mod.LLM_CONFIG.apiPassword) {
          LLM_CONFIG.apiPassword = mod.LLM_CONFIG.apiKey;
        }
        break;
      }
    } catch {
      /* 忽略 */
    }
  }
}

export function reloadLlmRuntimeConfig() {
  configLoaded = false;
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
  return useProxyMode() || !!getApiPassword();
}

export function getLlmModeLabel() {
  if (useProxyMode()) return '量子链路 · 星火 Lite（代理）';
  if (getApiPassword()) return '量子链路 · 星火 Lite（直连）';
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
  throw new Error(
    '尚未配置星火 APIPassword。请打开「系统设置 → 量子通讯」，粘贴讯飞控制台 HTTP 接口的 APIPassword 并保存。' +
    '申请免费额度见 docs/LLM配置指南.md'
  );
}

function parseSparkResponse(data) {
  if (data?.code !== undefined && data.code !== 0) {
    throw new Error(`星火 API ${data.code}：${data.message || '请求失败'}`);
  }
  if (data?.error?.message) {
    throw new Error(String(data.error.message));
  }
  const msg = data?.choices?.[0]?.message;
  return (msg?.content ?? msg?.reasoning_content ?? '').trim();
}

function buildSparkBody(messages, model, maxTokens, temperature) {
  return {
    model,
    messages,
    stream: false,
    max_tokens: maxTokens,
    temperature
  };
}

async function sendViaProxy(userText) {
  const url = getEffectiveProxyUrl().replace(/\/$/, '');
  const body = buildSparkBody(
    buildMessages(userText),
    LLM_PROXY.model,
    LLM_PROXY.maxTokens,
    LLM_PROXY.temperature
  );

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
  } catch {
    throw new Error('无法连接 LLM 代理（Failed to fetch）。');
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`代理 ${res.status}：${errText.slice(0, 240) || res.statusText}`);
  }

  const data = await res.json();
  const reply = parseSparkResponse(data);
  if (!reply) throw new Error('星火模型未返回有效内容。');
  return reply;
}

async function sendDirect(userText) {
  const password = getApiPassword();
  const url = `${(LLM_CONFIG.baseUrl || SPARK_BASE).replace(/\/$/, '')}/chat/completions`;
  const body = buildSparkBody(
    buildMessages(userText),
    LLM_CONFIG.model,
    LLM_CONFIG.maxTokens,
    LLM_CONFIG.temperature
  );

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${password}`
      },
      body: JSON.stringify(body)
    });
  } catch {
    throw new Error(
      '无法连接星火 API。若浏览器报 CORS 错误，可改用代理（见 docs/LLM配置指南.md 高级选项）。'
    );
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`星火 API ${res.status}：${errText.slice(0, 240) || res.statusText}`);
  }

  const data = await res.json();
  const reply = parseSparkResponse(data);
  if (!reply) throw new Error('星火模型未返回有效内容。');
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
