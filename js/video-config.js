/**
 * 剧情视频托管地址
 *
 * 【玩家】打开 GitHub Pages 网址 → 自动从 GitHub Releases 拉取视频，无需任何本地操作
 * 【开发者】仅在 localhost / 局域网调试时使用项目内 videos/ 文件夹
 */

const RELEASE_TAG = 'videos-v1';
const REPO = 'Mon3tr-WoW/wandering-baby-plan';
const RELEASE_BASE = `https://github.com/${REPO}/releases/download/${RELEASE_TAG}/`;

/** 是否使用仓库内 videos/ 目录（而非 GitHub Release） */
export function useLocalVideoFolder() {
  if (typeof location === 'undefined') return true;
  const { hostname, protocol } = location;

  if (protocol === 'file:') return true;
  if (hostname.endsWith('github.io')) return false;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') return true;
  if (/^192\.168\.\d+\.\d+$/.test(hostname)) return true;
  if (/^10\.\d+\.\d+\.\d+$/.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(hostname)) return true;

  return false;
}

/** 视频 URL 前缀，末尾带 / */
export const VIDEO_BASE = useLocalVideoFolder() ? 'videos/' : RELEASE_BASE;

export function getVideoSourceMode() {
  return useLocalVideoFolder() ? 'local' : 'release';
}

/** 是否通过 file:// 打开（浏览器无法可靠加载本地视频） */
export function isFileProtocol() {
  return typeof location !== 'undefined' && location.protocol === 'file:';
}
