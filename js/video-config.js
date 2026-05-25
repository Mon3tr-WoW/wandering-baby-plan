/**
 * 剧情视频托管地址
 *
 * 线上 Pages：从 GitHub Releases 拉取（免费，不占 Git LFS 配额）
 * 本地开发：自动使用项目内 videos/ 文件夹
 *
 * 修改 RELEASE_TAG 前，请先在 GitHub 创建同名 Release 并上传视频，详见 docs/视频托管与发布指南.md
 */
const RELEASE_TAG = 'videos-v1';
const REPO = 'Mon3tr-WoW/wandering-baby-plan';

const RELEASE_BASE = `https://github.com/${REPO}/releases/download/${RELEASE_TAG}/`;

function isLocalDev() {
  if (typeof location === 'undefined') return false;
  const h = location.hostname;
  return h === 'localhost' || h === '127.0.0.1';
}

/** 视频 URL 前缀，末尾带 / */
export const VIDEO_BASE = isLocalDev() ? 'videos/' : RELEASE_BASE;
