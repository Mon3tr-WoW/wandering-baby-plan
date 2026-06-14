/**
 * 视频 URL 解析缓存 + 下一节点预加载
 */

import { VIDEO_BASE } from './video-config.js';

/** @type {Map<string, string>} stem -> 已验证可用的 URL */
const resolvedUrls = new Map();
/** @type {Set<string>} */
const prefetched = new Set();

const EXT_ORDER = ['.mp4', '.mov', '.MP4', '.MOV'];

export function videoStemFromFile(filename) {
  return filename.replace(/\.(mp4|mov|MP4|MOV)$/i, '');
}

export function buildVideoCandidates(stem) {
  return EXT_ORDER.map((ext) => VIDEO_BASE + stem + ext);
}

/**
 * 优先使用缓存；本地开发跳过 HEAD，直接首候选 + onerror 回退
 */
export async function getVideoUrl(stem, { probe = false } = {}) {
  if (resolvedUrls.has(stem)) return resolvedUrls.get(stem);

  const candidates = buildVideoCandidates(stem);
  if (probe) {
    for (const url of candidates) {
      try {
        const res = await fetch(url, { method: 'HEAD' });
        if (res.ok) {
          resolvedUrls.set(stem, url);
          return url;
        }
      } catch {
        /* 本地 file:// 等环境可能不支持 HEAD */
      }
    }
  }

  const url = candidates[0];
  resolvedUrls.set(stem, url);
  return url;
}

export function rememberVideoUrl(stem, url) {
  if (stem && url) resolvedUrls.set(stem, url);
}

export function prefetchVideo(stem) {
  const url = resolvedUrls.get(stem) || buildVideoCandidates(stem)[0];
  if (prefetched.has(url)) return;
  prefetched.add(url);

  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.as = 'video';
  link.href = url;
  document.head.appendChild(link);
}

/** @param {import('./story-types').StoryNode | null | undefined} node */
export function prefetchStoryBranches(node, nodeById) {
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

  for (const stem of stems) prefetchVideo(stem);
}
