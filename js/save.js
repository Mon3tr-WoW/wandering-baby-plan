/**
 * 本地存档：路径、已访问节点、已解锁结局
 */
const SAVE_KEY = 'ark_voyage_save_v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeSave(state) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

export function clearSave() {
  localStorage.removeItem(SAVE_KEY);
}

export function createFreshSave(startNode) {
  return {
    currentNodeId: startNode,
    path: [startNode],
    visited: [startNode],
    unlockedEndings: [],
    settings: {
      volume: 1,
      particles: true,
      scanline: true
    }
  };
}
