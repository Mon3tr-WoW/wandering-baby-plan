/**
 * 新人类 LLM — 讯飞星火 Spark Lite
 *
 * 浏览器无法 HTTP 直连（CORS），默认走 WebSocket（免费、无需 CloudBase）。
 */

import {
  loadProxyUrlOverride,
  loadSparkPasswordOverride,
  loadSparkWsCredentials
} from './llm-storage.js';
import { sendSparkWsChat } from './spark-ws.js';

const SPARK_BASE = 'https://spark-api-open.xf-yun.com/v1';

const DEFAULT_LLM_CONFIG = {
  baseUrl: SPARK_BASE,
  appId: '',
  apiKey: '',
  apiSecret: '',
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

function getWsCredentials() {
  const stored = loadSparkWsCredentials();
  if (stored.appId && stored.apiKey && stored.apiSecret) return stored;
  const { appId, apiKey, apiSecret } = LLM_CONFIG;
  if (appId?.trim() && apiKey?.trim() && apiSecret?.trim()) {
    return { appId: appId.trim(), apiKey: apiKey.trim(), apiSecret: apiSecret.trim() };
  }
  return null;
}

function useWebSocketMode() {
  return !!getWsCredentials();
}

function getEffectiveProxyUrl() {
  const override = loadProxyUrlOverride();
  if (override && !override.includes('你的')) return override;
  const url = LLM_PROXY.proxyUrl?.trim() ?? '';
  if (url && !url.includes('你的')) return url;
  return '';
}

function useProxyMode() {
  return !useWebSocketMode() && getEffectiveProxyUrl().length > 0;
}

function getApiPassword() {
  const fromStorage = loadSparkPasswordOverride();
  if (fromStorage) return fromStorage;
  const pw = LLM_CONFIG.apiPassword?.trim() ?? '';
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

  for (const path of ['./llm-config.js', './llm-config.example.js']) {
    try {
      const mod = await import(path);
      if (mod?.LLM_CONFIG) {
        LLM_CONFIG = { ...DEFAULT_LLM_CONFIG, ...mod.LLM_CONFIG };
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
    if (res.ok) systemPrompt = (await res.text()).trim();
  } catch {
    systemPrompt = '你是来自未来的新人类代表，语气平静、俯瞰旧人类。';
  }
}

export function resetLlmChat() {
  history = [];
}

export function isLlmConfigured() {
  return useWebSocketMode() || useProxyMode();
}

export function getLlmModeLabel() {
  if (useWebSocketMode()) return '量子链路 · 星火 Lite（WebSocket）';
  if (useProxyMode()) return '量子链路 · 星火 Lite（代理）';
  if (getApiPassword()) return '量子链路 · 星火 Lite（HTTP，可能受 CORS 限制）';
  return '未配置';
}

function buildMessages(userText) {
  const msgs = [];
  if (systemPrompt) msgs.push({ role: 'system', content: systemPrompt });
  for (const m of history) msgs.push({ role: m.role, content: m.content });
  msgs.push({ role: 'user', content: userText });
  return msgs;
}

function notConfiguredError() {
  throw new Error(
    '尚未配置星火密钥。请打开「系统设置 → 量子通讯」，填写 APPID、APIKey、APISecret 并保存。' +
    '详见 docs/LLM配置指南.md'
  );
}

function parseSparkHttpResponse(data) {
  if (data?.code !== undefined && data.code !== 0) {
    throw new Error(`星火 API ${data.code}：${data.message || '请求失败'}`);
  }
  if (data?.error?.message) throw new Error(String(data.error.message));
  const msg = data?.choices?.[0]?.message;
  return (msg?.content ?? msg?.reasoning_content ?? '').trim();
}

async function sendViaWebSocket(userText) {
  const creds = getWsCredentials();
  if (!creds) notConfiguredError();

  return sendSparkWsChat({
    appId: creds.appId,
    apiKey: creds.apiKey,
    apiSecret: creds.apiSecret,
    messages: buildMessages(userText),
    domain: LLM_CONFIG.model || 'lite',
    maxTokens: LLM_CONFIG.maxTokens,
    temperature: LLM_CONFIG.temperature
  });
}

async function sendViaProxy(userText) {
  const url = getEffectiveProxyUrl().replace(/\/$/, '');
  const body = {
    model: LLM_PROXY.model,
    messages: buildMessages(userText),
    stream: false,
    max_tokens: LLM_PROXY.maxTokens,
    temperature: LLM_PROXY.temperature
  };

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
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
  const reply = parseSparkHttpResponse(data);
  if (!reply) throw new Error('星火模型未返回有效内容。');
  return reply;
}

async function sendViaHttp(userText) {
  const password = getApiPassword();
  const url = `${(LLM_CONFIG.baseUrl || SPARK_BASE).replace(/\/$/, '')}/chat/completions`;

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${password}`
      },
      body: JSON.stringify({
        model: LLM_CONFIG.model,
        messages: buildMessages(userText),
        stream: false,
        max_tokens: LLM_CONFIG.maxTokens,
        temperature: LLM_CONFIG.temperature
      })
    });
  } catch {
    throw new Error(
      '浏览器无法 HTTP 直连星火（CORS 限制）。请在系统设置填写 APPID、APIKey、APISecret 使用 WebSocket。'
    );
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`星火 API ${res.status}：${errText.slice(0, 240) || res.statusText}`);
  }

  const data = await res.json();
  const reply = parseSparkHttpResponse(data);
  if (!reply) throw new Error('星火模型未返回有效内容。');
  return reply;
}

/**
 * @param {string} userText
 * @returns {Promise<string>}
 */
export async function sendToNewHuman(userText) {
  await loadLlmConfig();

  if (!isLlmConfigured()) notConfiguredError();

  let reply;
  if (useWebSocketMode()) {
    reply = await sendViaWebSocket(userText);
  } else if (useProxyMode()) {
    reply = await sendViaProxy(userText);
  } else {
    reply = await sendViaHttp(userText);
  }

  history.push({ role: 'user', content: userText });
  history.push({ role: 'assistant', content: reply });

  return reply;
}
