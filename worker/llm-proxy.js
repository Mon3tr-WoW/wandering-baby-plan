/**
 * Cloudflare Worker：讯飞星火 Spark Lite 代理
 * 环境变量 SPARK_API_PASSWORD = 控制台 HTTP 接口 APIPassword
 */

const SPARK_BASE = 'https://spark-api-open.xf-yun.com/v1';

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
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
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

function getSparkPassword(env) {
  return env.SPARK_API_PASSWORD?.trim() || env.LLM_API_KEY?.trim() || '';
}

export default {
  async fetch(request, env) {
    const allowedOrigins = env.ALLOWED_ORIGINS || 'https://mon3tr-wow.github.io';
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, allowedOrigins);

    if (request.method === 'GET') {
      return new Response(
        '✓ 流浪婴儿计划 · 星火 Lite 代理 (Cloudflare Worker) 运行中',
        { status: 200, headers: { ...cors, 'Content-Type': 'text/plain; charset=utf-8' } }
      );
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405, cors);
    }

    const apiPassword = getSparkPassword(env);
    if (!apiPassword) {
      return json({ error: 'Worker 未配置 SPARK_API_PASSWORD' }, 500, cors);
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

    const base = (env.SPARK_BASE_URL || SPARK_BASE).replace(/\/$/, '');

    try {
      const upstreamRes = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiPassword}`
        },
        body: JSON.stringify({
          model: payload.model || env.SPARK_MODEL || 'lite',
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
