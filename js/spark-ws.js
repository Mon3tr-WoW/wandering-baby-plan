/**
 * 讯飞星火 Lite — WebSocket 客户端（浏览器可直连，无 CORS 问题）
 * 文档：https://www.xfyun.cn/doc/spark/Web.html
 */

const SPARK_WS_HOST = 'spark-api.xf-yun.com';
const SPARK_WS_PATH = '/v1.1/chat';
const SPARK_WS_BASE = 'wss://spark-api.xf-yun.com/v1.1/chat';

async function hmacSha256Base64(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  const bytes = new Uint8Array(sig);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export async function buildSparkWsUrl(apiKey, apiSecret) {
  const date = new Date().toUTCString();
  const requestLine = `GET ${SPARK_WS_PATH} HTTP/1.1`;
  const tmp = `host: ${SPARK_WS_HOST}\ndate: ${date}\n${requestLine}`;
  const signature = await hmacSha256Base64(apiSecret, tmp);
  const authorizationOrigin =
    `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
  const authorization = btoa(authorizationOrigin);
  const params = new URLSearchParams({ authorization, date, host: SPARK_WS_HOST });
  return `${SPARK_WS_BASE}?${params.toString()}`;
}

/** Lite 不支持 system 角色，合并进首条 user */
export function toSparkWsText(messages) {
  const out = [];
  let system = '';

  for (const m of messages) {
    if (m.role === 'system') {
      system = m.content;
      continue;
    }
    out.push({ role: m.role, content: m.content });
  }

  if (system && out.length) {
    const firstUser = out.findIndex((x) => x.role === 'user');
    if (firstUser >= 0) {
      out[firstUser] = {
        role: 'user',
        content: `[角色设定]\n${system}\n\n[玩家]\n${out[firstUser].content}`
      };
    }
  }

  return out;
}

/**
 * @param {{ appId: string, apiKey: string, apiSecret: string, messages: object[], domain?: string, maxTokens?: number, temperature?: number }} opts
 */
export function sendSparkWsChat(opts) {
  const {
    appId,
    apiKey,
    apiSecret,
    messages,
    domain = 'lite',
    maxTokens = 1024,
    temperature = 0.75
  } = opts;

  return new Promise(async (resolve, reject) => {
    let url;
    try {
      url = await buildSparkWsUrl(apiKey, apiSecret);
    } catch (err) {
      reject(err);
      return;
    }

    const ws = new WebSocket(url);
    let fullText = '';
    let settled = false;

    const finish = (fn, val) => {
      if (settled) return;
      settled = true;
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      fn(val);
    };

    const timer = setTimeout(() => {
      finish(reject, new Error('星火 WebSocket 响应超时（60s）'));
    }, 60000);

    ws.onerror = () => {
      clearTimeout(timer);
      finish(reject, new Error('WebSocket 连接失败，请检查 APPID / APIKey / APISecret'));
    };

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          header: { app_id: appId, uid: 'wandering_baby_player' },
          parameter: {
            chat: { domain, temperature, max_tokens: maxTokens }
          },
          payload: {
            message: { text: toSparkWsText(messages) }
          }
        })
      );
    };

    ws.onmessage = (ev) => {
      let data;
      try {
        data = JSON.parse(ev.data);
      } catch {
        return;
      }

      const code = data?.header?.code;
      if (code !== undefined && code !== 0) {
        clearTimeout(timer);
        finish(reject, new Error(`星火 ${code}：${data?.header?.message || '请求失败'}`));
        return;
      }

      const choices = data?.payload?.choices;
      if (choices?.text?.length) {
        for (const t of choices.text) {
          if (t?.content) fullText += t.content;
        }
      } else if (typeof choices?.content === 'string') {
        fullText += choices.content;
      }

      const status = choices?.status ?? data?.header?.status;
      if (status === 2) {
        clearTimeout(timer);
        if (!fullText.trim()) {
          finish(reject, new Error('星火未返回文本内容'));
        } else {
          finish(resolve, fullText.trim());
        }
      }
    };

    ws.onclose = () => {
      if (settled) return;
      clearTimeout(timer);
      if (fullText.trim()) finish(resolve, fullText.trim());
      else finish(reject, new Error('连接关闭，未收到完整回复'));
    };
  });
}
