/**
 * 视频 URL 解析：manifest 精确映射 + 扩展名回退
 */

import { getVideoBase, useLocalVideoFolder, getVideoSourceMode } from './video-config.js';

/** @type {Record<string, string> | null} stem -> filename */
let manifest = null;
/** @type {Map<string, string>} */
const resolvedUrls = new Map();

const EXT_ORDER = ['.mp4', '.MP4', '.mov', '.MOV'];

export function videoStemFromFile(filename) {
  return filename.replace(/\.(mp4|mov|MP4|MOV)$/i, '');
}

function videoUrlForFilename(filename) {
  return getVideoBase() + filename;
}

/**
 * manifest 精确文件名优先，再按扩展名回退（兼容大小写差异）
 */
export function buildVideoCandidates(stem) {
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

export function rememberVideoUrl(stem, url) {
  if (stem && url) resolvedUrls.set(stem, url);
}

export function invalidateVideoUrl(stem) {
  resolvedUrls.delete(stem);
}

/** 播放稳定后 metadata 预取（单文件、不抢主视频带宽） */
let prefetchEl = null;
let prefetchStem = null;

export function prefetchVideoMetadata(stem, url) {
  if (!stem || !url || prefetchStem === stem) return;
  cancelVideoPrefetch();
  prefetchEl = document.createElement('video');
  prefetchEl.preload = 'metadata';
  prefetchEl.muted = true;
  prefetchEl.playsInline = true;
  prefetchEl.style.cssText =
    'position:fixed;width:0;height:0;opacity:0;pointer-events:none';
  prefetchEl.src = url;
  document.body.appendChild(prefetchEl);
  prefetchStem = stem;
}

export function cancelVideoPrefetch() {
  if (prefetchEl) {
    prefetchEl.remove();
    prefetchEl = null;
  }
  prefetchStem = null;
}

export function getVideoDebugInfo(stem) {
  return {
    mode: getVideoSourceMode(),
    base: getVideoBase(),
    manifestLoaded: isVideoManifestLoaded(),
    manifest: manifest?.[stem] ?? null,
    candidates: buildVideoCandidates(stem)
  };
}
