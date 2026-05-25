/**
 * Cloudflare Worker：LLM API 代理
 *
 * API Key 只存在 Worker 的加密环境变量 LLM_API_KEY 中，不会出现在前端或 GitHub 仓库。
 *
 * 部署：见 docs/LLM代理部署指南.md
 */

const DEFAULT_BASE = 'https://models.sjtu.edu.cn/api/v1';

function corsHeaders(origin, allowedOrigins) {
  const list = allowedOrigins
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  let allowOrigin = list[0] || '*';
  if (origin && list.length > 0) {
    const ok = list.some((o) => origin === o || origin.startsWith(o));
    if (ok) allowOrigin = origin;
    else if (!list.includes('*')) allowOrigin = list[0];
  } else if (list.includes('*')) {
    allowOrigin = '*';
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Max-Age': '86400'
  };
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers }
  });
}

export default {
  /** @param {Request} request @param {Record<string, string>} env */
  async fetch(request, env) {
    const allowedOrigins = env.ALLOWED_ORIGINS || 'https://mon3tr-wow.github.io';
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, allowedOrigins);

    if (request.method === 'GET') {
      return new Response(
        `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>LLM 代理运行中</title></head><body style="font-family:sans-serif;background:#0a0814;color:#e8f4ff;padding:2rem"><h1>✓ 流浪婴儿计划 · LLM 代理</h1><p>Worker 已在线。请在游戏内「与新人类对话」发送消息（本页不支持 GET 对话）。</p><p style="color:#6b7d9a">若游戏内仍失败，请确认已 push <code>js/llm-proxy-config.js</code> 中的 proxyUrl，并检查交大 API 是否允许公网访问。</p></body></html>`,
        { status: 200, headers: { ...cors, 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405, cors);
    }

    if (!env.LLM_API_KEY?.trim()) {
      return json({ error: 'Worker 未配置 LLM_API_KEY' }, 500, cors);
    }

    const list = allowedOrigins.split(',').map((s) => s.trim()).filter(Boolean);
    if (list.length && origin && !list.includes('*')) {
      const ok = list.some((o) => origin === o || origin.startsWith(o));
      if (!ok) {
        return json({ error: 'Origin not allowed' }, 403, cors);
      }
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400, cors);
    }

    if (!payload?.messages?.length) {
      return json({ error: 'messages required' }, 400, cors);
    }

    const base = (env.LLM_BASE_URL || DEFAULT_BASE).replace(/\/$/, '');
    const upstream = `${base}/chat/completions`;

    try {
      const upstreamRes = await fetch(upstream, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.LLM_API_KEY.trim()}`
        },
        body: JSON.stringify({
          model: payload.model || env.LLM_MODEL || 'deepseek-chat',
          messages: payload.messages,
          stream: false,
          max_tokens: payload.max_tokens ?? 1024,
          temperature: payload.temperature ?? 0.75
        })
      });

      const text = await upstreamRes.text();
      return new Response(text, {
        status: upstreamRes.status,
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return json({ error: 'Upstream request failed', detail: String(err) }, 502, cors);
    }
  }
};
