/**
 * 浏览器端 LLM 配置（仅存本机，不上传 GitHub）
 */
const PROXY_KEY = 'ark_llm_proxy_url_v1';
const PASSWORD_KEY = 'ark_spark_api_password_v1';

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

export function hasSparkPasswordOverride() {
  return loadSparkPasswordOverride().length > 0;
}
