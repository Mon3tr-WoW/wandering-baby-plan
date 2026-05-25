/**
 * 浏览器端 LLM 配置（仅存本机）
 */
const PROXY_KEY = 'ark_llm_proxy_url_v1';
const PASSWORD_KEY = 'ark_spark_api_password_v1';
const APP_ID_KEY = 'ark_spark_app_id_v1';
const API_KEY_KEY = 'ark_spark_api_key_v1';
const API_SECRET_KEY = 'ark_spark_api_secret_v1';

export function loadProxyUrlOverride() {
  try {
    return localStorage.getItem(PROXY_KEY)?.trim() || '';
  } catch {
    return '';
  }
}

export function saveProxyUrlOverride(url) {
  const v = url?.trim() || '';
  if (v) localStorage.setItem(PROXY_KEY, v);
  else localStorage.removeItem(PROXY_KEY);
}

export function clearProxyUrlOverride() {
  localStorage.removeItem(PROXY_KEY);
}

export function loadSparkPasswordOverride() {
  try {
    return localStorage.getItem(PASSWORD_KEY)?.trim() || '';
  } catch {
    return '';
  }
}

export function saveSparkPasswordOverride(password) {
  const v = password?.trim() || '';
  if (v) localStorage.setItem(PASSWORD_KEY, v);
  else localStorage.removeItem(PASSWORD_KEY);
}

export function clearSparkPasswordOverride() {
  localStorage.removeItem(PASSWORD_KEY);
}

export function loadSparkWsCredentials() {
  try {
    return {
      appId: localStorage.getItem(APP_ID_KEY)?.trim() || '',
      apiKey: localStorage.getItem(API_KEY_KEY)?.trim() || '',
      apiSecret: localStorage.getItem(API_SECRET_KEY)?.trim() || ''
    };
  } catch {
    return { appId: '', apiKey: '', apiSecret: '' };
  }
}

export function saveSparkWsCredentials({ appId, apiKey, apiSecret }) {
  if (appId) localStorage.setItem(APP_ID_KEY, appId.trim());
  else localStorage.removeItem(APP_ID_KEY);
  if (apiKey) localStorage.setItem(API_KEY_KEY, apiKey.trim());
  else localStorage.removeItem(API_KEY_KEY);
  if (apiSecret) localStorage.setItem(API_SECRET_KEY, apiSecret.trim());
  else localStorage.removeItem(API_SECRET_KEY);
}

export function clearSparkWsCredentials() {
  localStorage.removeItem(APP_ID_KEY);
  localStorage.removeItem(API_KEY_KEY);
  localStorage.removeItem(API_SECRET_KEY);
}

export function hasSparkWsCredentials() {
  const { appId, apiKey, apiSecret } = loadSparkWsCredentials();
  return !!(appId && apiKey && apiSecret);
}

export function hasSparkPasswordOverride() {
  return loadSparkPasswordOverride().length > 0;
}
