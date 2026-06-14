import {
  loadSave,
  writeSave,
  clearSave,
  createFreshSave
} from './save.js';
import {
  initStartFx,
  setParticlesEnabled,
  playStartIntro,
  pauseStartMusic,
  setStartMusicVolume,
  setStartCanvasActive,
  forceRevealStartScreen
} from './start-fx.js';
import { setupStartScan, resetStartScan } from './start-scan.js';
import {
  initStartSfx,
  setSfxMasterVolume,
  setupGlobalButtonSfx
} from './start-sfx.js';
import {
  videoStemFromFile,
  buildVideoCandidates,
  resolveVideoUrl,
  rememberVideoUrl,
  invalidateVideoUrl,
  prefetchStoryBranches,
  warmVideo
} from './video-cache.js';
import {
  loadProxyUrlOverride,
  saveProxyUrlOverride,
  clearProxyUrlOverride,
  loadSparkWsCredentials,
  saveSparkWsCredentials,
  clearSparkWsCredentials,
  hasSparkWsCredentials,
  hasSparkPasswordOverride,
  clearSparkPasswordOverride
} from './llm-storage.js';
import { reloadLlmRuntimeConfig, getLlmModeLabel } from './llm.js';

const WARP_MS = 1600;
let videoLoadToken = 0;

/** @type {(show: boolean) => void} */
let showPerfectLlmButton = () => {};

/** @type {import('./story-types').StoryData} */
let story = null;
/** @type {ReturnType<typeof createFreshSave>} */
let save = null;

let screen = 'start';

const $ = (sel) => document.querySelector(sel);

const screens = {
  start: $('#screen-start'),
  game: $('#screen-game'),
  log: $('#screen-log'),
  settings: $('#screen-settings'),
  ending: $('#screen-ending')
};

const els = {
  video: $('#main-video'),
  videoWrap: $('#video-wrap'),
  scanline: $('#scanline-overlay'),
  choices: $('#choices-panel'),
  shipLog: $('#ship-log-text'),
  coord: $('#hud-coord'),
  starMap: $('#star-map'),
  volume: $('#volume-slider'),
  warp: $('#warp-overlay'),
  endingTitle: $('#ending-title'),
  endingDesc: $('#ending-desc'),
  endingList: $('#ending-list'),
  particles: $('#particles'),
  particleCanvas: $('#particle-canvas'),
  startMusic: $('#start-music'),
  toggleParticles: $('#toggle-particles'),
  toggleScanline: $('#toggle-scanline'),
  perfectHooks: $('#perfect-hooks')
};

function showScreen(name) {
  screen = name;
  Object.entries(screens).forEach(([key, el]) => {
    if (el) el.classList.toggle('active', key === name);
  });

  document.body.classList.toggle('start-screen-active', name === 'start');

  if (name === 'start') {
    setStartCanvasActive(true);
    playStartIntro();
  } else {
    setStartCanvasActive(false);
    pauseStartMusic();
    resetStartScan();
  }
}

function nodeById(id) {
  return story?.nodes[id] ?? null;
}

/** story.json 里写的是 1.mp4，实际文件可能是 1.mov / B10.1.mp4 */
function videoStem(node) {
  return videoStemFromFile(node.video);
}

function videoCandidates(node) {
  return buildVideoCandidates(videoStem(node));
}

function videoUrl(node) {
  return videoCandidates(node)[0];
}

function persist() {
  writeSave(save);
}

function normalizeSave(raw, startNode) {
  const base = createFreshSave(startNode);
  if (!raw || typeof raw !== 'object') return base;
  return {
    ...base,
    ...raw,
    settings: { ...base.settings, ...(raw.settings || {}) },
    path: Array.isArray(raw.path) ? raw.path : base.path,
    visited: Array.isArray(raw.visited) ? raw.visited : base.visited,
    unlockedEndings: Array.isArray(raw.unlockedEndings) ? raw.unlockedEndings : base.unlockedEndings
  };
}

async function initLlmModule() {
  try {
    const mod = await import('./llm-chat.js');
    await mod.setupLlmChat();
    showPerfectLlmButton = mod.showPerfectLlmButton;
  } catch (err) {
    console.warn('LLM 模块未加载，游戏主流程不受影响。', err);
  }
}

function unlockEnding(endingKey) {
  if (!endingKey || save.unlockedEndings.includes(endingKey)) return;
  save.unlockedEndings.push(endingKey);
  persist();
}

function pathIndexOf(nodeId) {
  return save.path.indexOf(nodeId);
}

function markVisited(nodeId) {
  if (!save.visited.includes(nodeId)) {
    save.visited.push(nodeId);
  }
}

function truncatePathAfter(nodeId) {
  const idx = pathIndexOf(nodeId);
  if (idx === -1) {
    save.path = [nodeId];
  } else {
    save.path = save.path.slice(0, idx + 1);
  }
  save.currentNodeId = nodeId;
  markVisited(nodeId);
  persist();
}

function renderStarMap() {
  if (!els.starMap) return;
  els.starMap.innerHTML = '';
  const ordered = save.path.slice();
  const extra = save.visited.filter((id) => !ordered.includes(id));
  const displayIds = [...ordered, ...extra];

  displayIds.forEach((id) => {
    const node = nodeById(id);
    if (!node) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'star-node';
    const onPath = save.path.includes(id);
    const isCurrent = id === save.currentNodeId;
    if (onPath) btn.classList.add('on-path');
    if (isCurrent) btn.classList.add('current');
    if (node.ending) btn.classList.add('is-ending');
    btn.dataset.nodeId = id;
    btn.title = node.log || node.title || `节点 ${node.map || id}`;
    btn.innerHTML = `<span class="star-id">${node.map || id}</span>`;
    btn.addEventListener('click', () => jumpToNode(id, true));
    els.starMap.appendChild(btn);
  });
}

function hideChoices() {
  els.choices?.classList.add('hidden');
  els.choices.innerHTML = '';
}

function showChoices(node) {
  if (!node.choices?.length) {
    hideChoices();
    return;
  }
  els.choices.classList.remove('hidden');
  els.choices.innerHTML = '';
  node.choices.forEach((choice, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'choice-btn';
    btn.innerHTML = `
      <span class="choice-label">选项 ${String.fromCharCode(65 + i)}</span>
      <span class="choice-text">${escapeHtml(choice.text)}</span>
    `;
    btn.addEventListener('click', () => onChoiceSelected(choice.next));
    els.choices.appendChild(btn);
  });
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

async function playWarpTransition() {
  return new Promise((resolve) => {
    els.warp?.classList.add('active');
    setTimeout(() => {
      els.warp?.classList.remove('active');
      resolve();
    }, WARP_MS);
  });
}

function applySettings() {
  const vol = save.settings.volume ?? 1;
  if (els.video) els.video.volume = vol;
  setStartMusicVolume(vol);
  setSfxMasterVolume(vol);
  if (els.volume) els.volume.value = String(vol);
  if (els.particles) {
    els.particles.classList.toggle('disabled', !save.settings.particles);
  }
  setParticlesEnabled(!!save.settings.particles);
  if (els.scanline) {
    els.scanline?.classList.toggle('hidden', !save.settings.scanline);
  }
  if (els.toggleParticles) els.toggleParticles.checked = !!save.settings.particles;
  if (els.toggleScanline) els.toggleScanline.checked = !!save.settings.scanline;
}

function updateHud(node) {
  if (els.coord) els.coord.textContent = `X-${nodeIdToCoord(save.currentNodeId)}`;
  if (els.shipLog) els.shipLog.textContent = node.log || '';
}

function nodeIdToCoord(id) {
  const n = id.replace(/_/g, '');
  const hash = [...n].reduce((a, c) => a + c.charCodeAt(0), 0);
  return (9000 + hash * 17) % 10000;
}

function onVideoEnded() {
  const node = nodeById(save.currentNodeId);
  if (!node) return;
  if (node.ending) {
    showEndingScreen(node);
    return;
  }
  if (node.gestureChoice) {
    openNodeGestureChoice(node);
    return;
  }
  if (node.autoNext) {
    void autoAdvanceTo(node.autoNext);
    return;
  }
  showChoices(node);
}

async function autoAdvanceTo(nextId) {
  hideChoices();
  save.currentNodeId = nextId;
  markVisited(nextId);
  if (save.path[save.path.length - 1] !== nextId) {
    save.path.push(nextId);
  }
  persist();
  const next = nodeById(nextId);
  if (!next) return;
  await loadNodeVideo(next);
}

async function openNodeGestureChoice(node) {
  hideChoices();
  try {
    const mod = await import('./gesture-detection.js');
    await mod.openGestureOverlay({
      mode: 'story',
      title: '地球轨道 · 最后抉择',
      subtitle: '新人类在地球向你伸出了手。比出手枪 → 警惕；伸手握手 → 握上。保持约 1 秒确认。',
      choices: (node.choices || []).map((c) => ({
        label: c.text,
        next: c.next,
        gesture: c.gesture || (c.text.includes('警惕') ? 'gun' : 'handshake')
      })),
      onSelect: (nextId) => onChoiceSelected(nextId)
    });
  } catch (err) {
    console.warn('手势模块加载失败，回退为鼠标选项。', err);
    showChoices(node);
  }
}

async function waitForMainVideoReady(video, timeoutMs = 20000) {
  if (video.readyState >= 2) return;

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('视频加载超时'));
    }, timeoutMs);

    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('视频解码失败'));
    };
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('canplay', onReady);
      video.removeEventListener('error', onError);
    };

    video.addEventListener('loadeddata', onReady);
    video.addEventListener('canplay', onReady);
    video.addEventListener('error', onError);
  });
}

function setVideoLoading(on) {
  els.videoWrap?.classList.toggle('video-loading', on);
}

async function tryPlayMainVideo() {
  if (!els.video) return false;
  try {
    await els.video.play();
    return true;
  } catch (err) {
    console.warn('视频自动播放被阻止，请手动点击播放。', err);
    return false;
  }
}

async function loadNodeVideo(node, autoplay = true) {
  if (!els.video || !node) return;

  const loadToken = ++videoLoadToken;
  hideChoices();
  setVideoLoading(true);

  const stem = videoStem(node);
  const candidates = videoCandidates(node);
  let lastErr = null;

  for (let i = 0; i < candidates.length; i++) {
    if (loadToken !== videoLoadToken) return;

    const url = i === 0 ? await resolveVideoUrl(stem) : candidates[i];

    try {
      els.video.onerror = null;
      els.video.pause();
      els.video.removeAttribute('src');
      els.video.load();

      els.video.src = url;
      els.video.load();

      await waitForMainVideoReady(els.video);
      if (loadToken !== videoLoadToken) return;

      rememberVideoUrl(stem, url);
      updateHud(node);
      renderStarMap();
      setVideoLoading(false);

      if (autoplay) await tryPlayMainVideo();

      prefetchStoryBranches(node, nodeById);
      return;
    } catch (err) {
      lastErr = err;
      invalidateVideoUrl(stem);
      console.warn(`视频候选失败 (${url}):`, err?.message || err);
    }
  }

  setVideoLoading(false);
  console.error('所有视频候选均失败:', stem, lastErr);
  if (els.shipLog) {
    els.shipLog.textContent = `信号丢失 · 无法加载视频「${stem}」。请确认 videos/ 或 Release 中已有该文件。`;
  }
}

async function jumpToNode(nodeId, fromStarMap = false) {
  const node = nodeById(nodeId);
  if (!node) return;

  if (fromStarMap) {
    truncatePathAfter(nodeId);
  } else {
    save.currentNodeId = nodeId;
    markVisited(nodeId);
    if (save.path[save.path.length - 1] !== nodeId) {
      save.path.push(nodeId);
    }
    persist();
  }

  showScreen('game');
  hideEndingUI();
  await loadNodeVideo(node);
}

async function onChoiceSelected(nextId) {
  hideChoices();
  await playWarpTransition();
  const node = nodeById(save.currentNodeId);
  if (!node) return;

  save.currentNodeId = nextId;
  markVisited(nextId);
  save.path.push(nextId);
  persist();

  const next = nodeById(nextId);
  if (!next) return;
  await loadNodeVideo(next);
}

function hideEndingUI() {
  screens.ending?.classList.remove('active');
  els.perfectHooks?.classList.add('hidden');
  showPerfectLlmButton(false);
}

function showEndingScreen(node) {
  const key = node.ending;
  const info = story.endings[key] || { title: '未知结局', description: '' };
  unlockEnding(key);
  hideChoices();

  if (els.endingTitle) els.endingTitle.textContent = info.title;
  if (els.endingDesc) els.endingDesc.textContent = info.description;

  const isPerfect = node.flags?.includes('perfect');
  showPerfectLlmButton(isPerfect);
  if (isPerfect && els.perfectHooks) {
    els.perfectHooks.classList.remove('hidden');
  } else if (els.perfectHooks) {
    els.perfectHooks.classList.add('hidden');
  }

  showScreen('game');
  screens.ending?.classList.add('active');
}

function renderEndingLog() {
  if (!els.endingList || !story) return;
  els.endingList.innerHTML = '';
  const allKeys = Object.keys(story.endings);
  allKeys.forEach((key) => {
    const info = story.endings[key];
    const li = document.createElement('li');
    const unlocked = save.unlockedEndings.includes(key);
    li.className = unlocked ? 'unlocked' : 'locked';
    li.innerHTML = unlocked
      ? `<strong>${escapeHtml(info.title)}</strong><p>${escapeHtml(info.description)}</p>`
      : `<strong>？？？</strong><p>尚未抵达的结局</p>`;
    els.endingList.appendChild(li);
  });
}

function startNewGame() {
  save = createFreshSave(story.meta.startNode);
  persist();
  showScreen('game');
  hideEndingUI();
  jumpToNode(story.meta.startNode, false);
}

function resumeGame() {
  if (!save?.currentNodeId) {
    startNewGame();
    return;
  }
  showScreen('game');
  hideEndingUI();
  jumpToNode(save.currentNodeId, false);
}

async function loadStory() {
  const res = await fetch('data/story.json');
  if (!res.ok) throw new Error('无法加载 story.json');
  story = await res.json();
}

function updateLlmSparkSettingsUi() {
  const appIdInput = $('#llm-spark-appid');
  const apiKeyInput = $('#llm-spark-apikey');
  const apiSecretInput = $('#llm-spark-apisecret');
  const status = $('#llm-spark-status');
  const migrate = $('#llm-spark-migrate');
  const saved = loadSparkWsCredentials();

  if (status) {
    status.textContent = hasSparkWsCredentials()
      ? '已保存 WebSocket 密钥（本机）· ' + getLlmModeLabel()
      : '未配置 WebSocket 密钥';
  }

  if (migrate) {
    if (hasSparkPasswordOverride() && !hasSparkWsCredentials()) {
      migrate.classList.remove('hidden');
      migrate.textContent =
        '⚠ 检测到旧版 APIPassword 配置。HTTP 直连在浏览器中会 CORS 失败，请改填下方 APPID / APIKey / APISecret（讯飞控制台 WebSocket 鉴权信息）。';
    } else {
      migrate.classList.add('hidden');
      migrate.textContent = '';
    }
  }

  if (appIdInput && !appIdInput.matches(':focus') && saved.appId) {
    appIdInput.value = saved.appId;
  }
  if (apiKeyInput && !apiKeyInput.matches(':focus') && saved.apiKey) {
    apiKeyInput.value = '********';
  }
  if (apiSecretInput && !apiSecretInput.matches(':focus') && saved.apiSecret) {
    apiSecretInput.value = '********';
  }
}

function updateLlmProxySettingsUi() {
  const input = $('#llm-proxy-url');
  const status = $('#llm-proxy-status');
  const saved = loadProxyUrlOverride();
  if (input && !input.matches(':focus')) {
    input.value = saved;
  }
  if (status) {
    status.textContent = saved
      ? `已保存本机代理：${saved}`
      : '未配置本机代理（将使用 js/llm-proxy-config.js 中的地址）';
  }
}

function bindLlmSparkSettings() {
  updateLlmSparkSettingsUi();

  $('#btn-save-spark-key')?.addEventListener('click', () => {
    const appId = $('#llm-spark-appid')?.value.trim() ?? '';
    const apiKey = $('#llm-spark-apikey')?.value.trim() ?? '';
    const apiSecret = $('#llm-spark-apisecret')?.value.trim() ?? '';
    const saved = loadSparkWsCredentials();

    const finalAppId = appId || saved.appId;
    const finalApiKey = !apiKey || apiKey === '********' ? saved.apiKey : apiKey;
    const finalApiSecret = !apiSecret || apiSecret === '********' ? saved.apiSecret : apiSecret;

    if (!finalAppId || !finalApiKey || !finalApiSecret) {
      alert('请填写完整的 APPID、APIKey、APISecret（来自讯飞控制台 WebSocket 鉴权信息）');
      return;
    }

    saveSparkWsCredentials({
      appId: finalAppId,
      apiKey: finalApiKey,
      apiSecret: finalApiSecret
    });
    clearSparkPasswordOverride();
    reloadLlmRuntimeConfig();
    updateLlmSparkSettingsUi();
    alert('密钥已保存到本机浏览器。\n' + getLlmModeLabel());
  });

  $('#btn-clear-spark-key')?.addEventListener('click', () => {
    clearSparkWsCredentials();
    clearSparkPasswordOverride();
    reloadLlmRuntimeConfig();
    const appIdInput = $('#llm-spark-appid');
    const apiKeyInput = $('#llm-spark-apikey');
    const apiSecretInput = $('#llm-spark-apisecret');
    if (appIdInput) appIdInput.value = '';
    if (apiKeyInput) apiKeyInput.value = '';
    if (apiSecretInput) apiSecretInput.value = '';
    updateLlmSparkSettingsUi();
  });
}

function bindLlmProxySettings() {
  updateLlmProxySettingsUi();

  $('#btn-save-llm-proxy')?.addEventListener('click', () => {
    const url = $('#llm-proxy-url')?.value.trim() ?? '';
    if (!url) {
      alert('请填写 CloudBase 或其它代理的 HTTPS 地址');
      return;
    }
    if (!/^https:\/\/.+/i.test(url)) {
      alert('代理地址必须以 https:// 开头');
      return;
    }
    saveProxyUrlOverride(url);
    reloadLlmRuntimeConfig();
    updateLlmProxySettingsUi();
    alert(`代理已保存。\n当前链路：${getLlmModeLabel()}`);
  });

  $('#btn-clear-llm-proxy')?.addEventListener('click', () => {
    clearProxyUrlOverride();
    reloadLlmRuntimeConfig();
    const input = $('#llm-proxy-url');
    if (input) input.value = '';
    updateLlmProxySettingsUi();
  });
}

function bindEvents() {
  bindLlmSparkSettings();
  bindLlmProxySettings();

  $('#btn-start')?.addEventListener('click', () => {
    const existing = loadSave();
    if (existing?.currentNodeId && nodeById(existing.currentNodeId)) {
      save = existing;
      applySettings();
      resumeGame();
    } else {
      startNewGame();
    }
  });

  $('#btn-continue')?.addEventListener('click', () => {
    const existing = loadSave();
    if (existing) {
      save = existing;
      applySettings();
      resumeGame();
    }
  });

  $('#btn-new-game')?.addEventListener('click', () => {
    if (confirm('确定要开始新漂流？当前进度将被清除。')) {
      clearSave();
      save = createFreshSave(story.meta.startNode);
      startNewGame();
    }
  });

  $('#btn-open-log')?.addEventListener('click', () => {
    renderEndingLog();
    showScreen('log');
  });

  $('#btn-open-settings')?.addEventListener('click', () => {
    applySettings();
    updateLlmSparkSettingsUi();
    updateLlmProxySettingsUi();
    showScreen('settings');
  });

  $('#btn-back-start')?.addEventListener('click', () => showScreen('start'));
  $('#btn-back-from-log')?.addEventListener('click', () => showScreen(save?.currentNodeId ? 'game' : 'start'));
  $('#btn-back-from-settings')?.addEventListener('click', () => showScreen(save?.currentNodeId ? 'game' : 'start'));

  $('#btn-pause')?.addEventListener('click', () => {
    if (els.video.paused) els.video.play();
    else els.video.pause();
  });

  $('#btn-exit-game')?.addEventListener('click', () => {
    persist();
    showScreen('start');
  });

  $('#btn-ending-map')?.addEventListener('click', () => {
    screens.ending?.classList.remove('active');
    renderStarMap();
  });

  $('#btn-ending-restart')?.addEventListener('click', () => {
    screens.ending?.classList.remove('active');
    startNewGame();
  });

  els.video?.addEventListener('ended', onVideoEnded);

  els.video?.addEventListener('timeupdate', () => {
    const node = nodeById(save?.currentNodeId);
    if (!node || node.ending || node.autoNext || !node.choices?.length) return;
    if (node.gestureChoice) return;
    if (els.video.duration && els.video.currentTime >= els.video.duration - 0.25) {
      if (els.choices.classList.contains('hidden')) {
        showChoices(node);
      }
    }
  });

  els.volume?.addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    save.settings.volume = v;
    els.video.volume = v;
    setStartMusicVolume(v);
    setSfxMasterVolume(v);
    persist();
  });

  els.toggleParticles?.addEventListener('change', (e) => {
    save.settings.particles = e.target.checked;
    applySettings();
    persist();
  });

  els.toggleScanline?.addEventListener('change', (e) => {
    save.settings.scanline = e.target.checked;
    applySettings();
    persist();
  });

  document.addEventListener('mousemove', (e) => {
    const x = (e.clientX / window.innerWidth - 0.5) * 12;
    const y = (e.clientY / window.innerHeight - 0.5) * 8;
    document.documentElement.style.setProperty('--parallax-x', `${x}px`);
    document.documentElement.style.setProperty('--parallax-y', `${y}px`);
  });
}

async function init() {
  try {
    await loadStory();
  } catch (err) {
    alert('加载剧情数据失败：' + err.message);
    forceRevealStartScreen();
    return;
  }

  const startNode = story.meta.startNode;
  const existing = loadSave();
  const continueBtn = $('#btn-continue');
  save = normalizeSave(existing, startNode);

  if (existing?.currentNodeId && continueBtn) {
    continueBtn.classList.remove('hidden');
  }

  try {
    applySettings();
    bindEvents();
    initStartSfx();
    setupGlobalButtonSfx();
    initStartFx(els.particleCanvas, els.startMusic);
    applySettings();
    setupStartScan();

    showScreen('start');
    document.body.classList.add('app-booted');

    // 预解析首个剧情视频，缩短「开始漂流」等待
    const firstNode = nodeById(story.meta.startNode);
    if (firstNode) {
      resolveVideoUrl(videoStem(firstNode))
        .then((url) => {
          warmVideo(videoStem(firstNode), url);
          prefetchStoryBranches(firstNode, nodeById);
        })
        .catch(() => {});
    }

    // LLM 异步加载，绝不阻塞开始界面
    initLlmModule();

    // 手势检测：测试按钮 + 预加载 MediaPipe
    import('./gesture-detection.js')
      .then((mod) => {
        mod.setupGestureTestButton();
        mod.preloadGestureEngine();
      })
      .catch((err) => console.warn('手势模块未加载。', err));

    // 若入场动画 4 秒内未就绪，强制显示 UI（防黑屏兜底）
    setTimeout(() => {
      if (!document.body.classList.contains('start-reveal-ready')) {
        forceRevealStartScreen();
      }
    }, 4000);
  } catch (err) {
    console.error('游戏初始化失败：', err);
    forceRevealStartScreen();
    document.body.classList.add('app-booted');
    alert('界面初始化异常，已尝试恢复显示。若仍异常请 Ctrl+F5 强刷后重试。\n' + err.message);
  }
}

init().catch((err) => {
  console.error('启动失败：', err);
  forceRevealStartScreen();
  document.body.classList.add('app-booted');
});
