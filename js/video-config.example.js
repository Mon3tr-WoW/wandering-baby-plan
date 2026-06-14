/**
 * 视频托管配置模板（一般无需复制；直接改 video-config.js 即可）
 */
const RELEASE_TAG = 'videos-v4';
const REPO = '你的用户名/仓库名';

const RELEASE_BASE = `https://github.com/${REPO}/releases/download/${RELEASE_TAG}/`;

function isLocalDev() {
  if (typeof location === 'undefined') return false;
  const h = location.hostname;
  return h === 'localhost' || h === '127.0.0.1';
}

export const VIDEO_BASE = isLocalDev() ? 'videos/' : RELEASE_BASE;
