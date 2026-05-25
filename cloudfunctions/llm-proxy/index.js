'use strict';

/**
 * 腾讯云 CloudBase：讯飞星火 Spark Lite 代理
 * 环境变量 SPARK_API_PASSWORD = 控制台 HTTP 接口 APIPassword
 */

const SPARK_BASE = 'https://spark-api-open.xf-yun.com/v1';

function corsHeaders(origin) {
  const allowed = (process.env.ALLOWED_ORIGINS || 'https://mon3tr-wow.github.io')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  let allowOrigin = allowed[0] || '*';
  if (origin && allowed.length) {
    const ok = allowed.some((o) => origin === o || origin.startsWith(o));
    if (ok) allowOrigin = origin;
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Max-Age': '86400'
  };
}

function jsonResponse(statusCode, data, headers) {
  return {
    statusCode,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(data)
  };
}

function getSparkPassword() {
  return (
    process.env.SPARK_API_PASSWORD?.trim() ||
    process.env.LLM_API_KEY?.trim() ||
    ''
  );
}

exports.main = async (event) => {
  const origin =
    event.headers?.origin ||
    event.headers?.Origin ||
    event.headers?.['origin'] ||
    '';

  const method =
    event.httpMethod ||
    event.requestContext?.httpMethod ||
    event.method ||
    'GET';

  const cors = corsHeaders(origin);

  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: cors, body: '' };
  }

  if (method === 'GET') {
    return {
      statusCode: 200,
      headers: { ...cors, 'Content-Type': 'text/plain; charset=utf-8' },
      body: '✓ 流浪婴儿计划 · 星火 Lite 代理 (CloudBase) 运行中'
    };
  }

  if (method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' }, cors);
  }

  const apiPassword = getSparkPassword();
  if (!apiPassword) {
    return jsonResponse(500, { error: '未配置 SPARK_API_PASSWORD' }, cors);
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' }, cors);
  }

  if (!payload?.messages?.length) {
    return jsonResponse(400, { error: 'messages required' }, cors);
  }

  const base = (process.env.SPARK_BASE_URL || SPARK_BASE).replace(/\/$/, '');

  try {
    const upstreamRes = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiPassword}`
      },
      body: JSON.stringify({
        model: payload.model || process.env.SPARK_MODEL || 'lite',
        messages: payload.messages,
        stream: false,
        max_tokens: payload.max_tokens ?? 1024,
        temperature: payload.temperature ?? 0.75
      })
    });

    const text = await upstreamRes.text();
    return {
      statusCode: upstreamRes.status,
      headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
      body: text
    };
  } catch (err) {
    return jsonResponse(502, { error: 'Upstream request failed', detail: String(err) }, cors);
  }
};
