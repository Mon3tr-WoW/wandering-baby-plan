/**
 * 视频 URL 解析缓存 + 下一节点预加载
 */

import { VIDEO_BASE } from './video-config.js';

/** @type {Map<string, string>} stem -> 已验证可用的 URL */
const resolvedUrls = new Map();
/** @type {Map<string, HTMLVideoElement>} */
const warmVideos = new Map();
/** @type {Set<string>} */
const warming = new Set();

/** 本地 videos/ 以 .mov 为主，优先尝试 */
const EXT_ORDER = ['.mov', '.mp4', '.MOV', '.MP4'];

export function videoStemFromFile(filename) {
  return filename.replace(/\.(mp4|mov|MP4|MOV)$/i, '');
}

export function buildVideoCandidates(stem) {
  return EXT_ORDER.map((ext) => VIDEO_BASE + stem + ext);
}

function isLocalDev() {
  if (typeof location === 'undefined') return false;
  const h = location.hostname;
  return h === 'localhost' || h === '127.0.0.1';
}

async function probeUrl(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * 解析可用视频 URL（HEAD 探测，避免 .mp4/.mov 错配导致无法播放）
 */
export async function resolveVideoUrl(stem) {
  const cached = resolvedUrls.get(stem);
  if (cached && (await probeUrl(cached))) return cached;
  if (cached) resolvedUrls.delete(stem);

  const candidates = buildVideoCandidates(stem);
  if (isLocalDev()) {
    const checks = await Promise.all(candidates.map((url) => probeUrl(url)));
    const hit = candidates.find((_, i) => checks[i]);
    if (hit) {
      resolvedUrls.set(stem, hit);
      return hit;
    }
  } else {
    for (const url of candidates) {
      if (await probeUrl(url)) {
        resolvedUrls.set(stem, url);
        return url;
      }
    }
  }

  const fallback = candidates[0];
  resolvedUrls.set(stem, fallback);
  return fallback;
}

/** @deprecated 使用 resolveVideoUrl */
export async function getVideoUrl(stem) {
  return resolveVideoUrl(stem);
}

export function rememberVideoUrl(stem, url) {
  if (stem && url) resolvedUrls.set(stem, url);
}

export function invalidateVideoUrl(stem) {
  resolvedUrls.delete(stem);
  const warm = warmVideos.get(stem);
  if (warm) {
    warm.removeAttribute('src');
    warm.load();
    warmVideos.delete(stem);
  }
}

/** 后台预热：hidden video 元素 */
export function warmVideo(stem, url) {
  if (!stem || !url || warmVideos.has(stem) || warming.has(stem)) return;
  warming.add(stem);

  const v = document.createElement('video');
  v.preload = 'auto';
  v.muted = true;
  v.playsInline = true;
  v.style.display = 'none';
  v.src = url;
  v.addEventListener(
    'loadeddata',
    () => {
      rememberVideoUrl(stem, url);
      warmVideos.set(stem, v);
      warming.delete(stem);
    },
    { once: true }
  );
  v.addEventListener(
    'error',
    () => {
      warming.delete(stem);
      v.remove();
    },
    { once: true }
  );
  document.body.appendChild(v);
  v.load();
}

export async function prefetchStoryBranches(node, nodeById) {
  if (!node) return;
  const stems = new Set();

  if (node.autoNext) {
    const n = nodeById(node.autoNext);
    if (n?.video) stems.add(videoStemFromFile(n.video));
  }

  for (const c of node.choices || []) {
    const n = nodeById(c.next);
    if (n?.video) stems.add(videoStemFromFile(n.video));
  }

  for (const stem of stems) {
    resolveVideoUrl(stem)
      .then((url) => warmVideo(stem, url))
      .catch(() => {});
  }
}

export function takeWarmVideo(stem) {
  return warmVideos.get(stem) || null;
}

export function clearWarmVideo(stem) {
  const v = warmVideos.get(stem);
  if (v) {
    v.remove();
    warmVideos.delete(stem);
  }
}
