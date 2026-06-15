/**
 * 视频 URL 解析：manifest 精确映射 + 扩展名回退 + 预热
 */

import { VIDEO_BASE, useLocalVideoFolder, getVideoSourceMode } from './video-config.js';

/** @type {Record<string, string> | null} stem -> filename */
let manifest = null;
/** @type {Map<string, string>} */
const resolvedUrls = new Map();
/** @type {Map<string, HTMLVideoElement>} */
const warmVideos = new Map();

const EXT_ORDER = ['.mp4', '.MP4', '.mov', '.MOV'];

export function videoStemFromFile(filename) {
  return filename.replace(/\.(mp4|mov|MP4|MOV)$/i, '');
}

function videoUrlForFilename(filename) {
  return VIDEO_BASE + filename;
}

/**
 * manifest 优先；线上 Release 有映射时只试一个 URL，避免错试 + 重复超时
 */
export function buildVideoCandidates(stem) {
  if (manifest?.[stem] && !useLocalVideoFolder()) {
    return [videoUrlForFilename(manifest[stem])];
  }
  const names = new Set();
  if (manifest?.[stem]) names.add(manifest[stem]);
  for (const ext of EXT_ORDER) names.add(stem + ext);
  return [...names].map((name) => videoUrlForFilename(name));
}

export async function loadVideoManifest() {
  try {
    const res = await fetch('data/video-manifest.json', { cache: 'no-cache' });
    if (!res.ok) {
      console.warn('[Video] video-manifest.json HTTP', res.status);
      return;
    }
    manifest = await res.json();
    console.info('[Video] manifest 已加载', Object.keys(manifest).length, '条');
  } catch (err) {
    console.warn('[Video] video-manifest.json 未加载，将使用扩展名回退。', err);
  }
}

export function isVideoManifestLoaded() {
  return manifest !== null;
}

export function getVideoManifestEntry(stem) {
  return manifest?.[stem] ?? null;
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
 * 解析可用视频 URL
 * - manifest 优先（本地与 Release 均信任清单）
 * - 本地无 manifest 时用 HEAD 探测
 * - Release 无 manifest 时用扩展名顺序首项
 */
export async function resolveVideoUrl(stem) {
  const cached = resolvedUrls.get(stem);
  if (cached) return cached;

  if (manifest?.[stem]) {
    const url = videoUrlForFilename(manifest[stem]);
    resolvedUrls.set(stem, url);
    return url;
  }

  const candidates = buildVideoCandidates(stem);

  if (useLocalVideoFolder()) {
    for (const url of candidates) {
      if (await probeUrl(url)) {
        resolvedUrls.set(stem, url);
        return url;
      }
    }
  }

  const fallback = candidates[0];
  if (fallback) resolvedUrls.set(stem, fallback);
  return fallback;
}

export function rememberVideoUrl(stem, url) {
  if (stem && url) resolvedUrls.set(stem, url);
}

export function invalidateVideoUrl(stem) {
  resolvedUrls.delete(stem);
  const warm = warmVideos.get(stem);
  if (warm) {
    warm.remove();
    warmVideos.delete(stem);
  }
}

export function warmVideo(stem, url) {
  // 线上 Release 体积大，预热会与主播放器抢带宽，仅本地开发启用
  if (!useLocalVideoFolder()) return;
  if (!stem || !url || warmVideos.has(stem)) return;

  const v = document.createElement('video');
  v.preload = 'auto';
  v.muted = true;
  v.playsInline = true;
  v.style.cssText = 'position:fixed;width:0;height:0;opacity:0;pointer-events:none';
  v.src = url;
  v.addEventListener('loadeddata', () => rememberVideoUrl(stem, url), { once: true });
  v.addEventListener('error', () => v.remove(), { once: true });
  document.body.appendChild(v);
  warmVideos.set(stem, v);
  v.load();
}

export async function prefetchStoryBranches(node, nodeById) {
  if (!useLocalVideoFolder()) return;
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

export function getVideoDebugInfo(stem) {
  return {
    mode: getVideoSourceMode(),
    base: VIDEO_BASE,
    manifestLoaded: isVideoManifestLoaded(),
    manifest: manifest?.[stem] ?? null,
    candidates: buildVideoCandidates(stem)
  };
}

