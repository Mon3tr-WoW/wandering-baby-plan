/**
 * MediaPipe 手势检测 — 节点 24「警惕 / 握上」
 * 手枪状 → 警惕 · 伸手/握手状 → 握上
 */

const VISION_CDN_CANDIDATES = [
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14',
  'https://unpkg.com/@mediapipe/tasks-vision@0.10.14'
];

const MODEL_URL_CANDIDATES = [
  new URL('../assets/models/hand_landmarker.task', import.meta.url).href,
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
];

const HOLD_FRAMES = 18;
const FALLBACK_AFTER_MS = 28000;
const CPU_FALLBACK_AFTER_MS = 4500;

/** @type {import('@mediapipe/tasks-vision').HandLandmarker | null} */
let handLandmarker = null;
let landmarkerLoading = null;
let activeDelegate = '';
let activeModelUrl = '';
let cpuFallbackAttempted = false;

/** @type {MediaStream | null} */
let mediaStream = null;
let detectRafId = 0;
let activeSession = null;

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17]
];

const LANDMARKER_OPTIONS = {
  runningMode: 'VIDEO',
  numHands: 1,
  minHandDetectionConfidence: 0.35,
  minHandPresenceConfidence: 0.35,
  minTrackingConfidence: 0.35
};

const els = {
  overlay: null,
  video: null,
  canvas: null,
  hint: null,
  status: null,
  meterGun: null,
  meterHandshake: null,
  fallback: null,
  skipBtn: null,
  closeBtn: null
};

function $(sel) {
  return document.querySelector(sel);
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** 手指是否伸直（图像坐标 y 向下） */
function isFingerExtended(lm, tip, pip, mcp) {
  const tipPt = lm[tip];
  const pipPt = lm[pip];
  const mcpPt = lm[mcp];
  const lenTip = dist(tipPt, mcpPt);
  const lenPip = dist(pipPt, mcpPt);
  return tipPt.y < pipPt.y - 0.015 && lenTip > lenPip * 0.85;
}

function isFingerCurled(lm, tip, pip) {
  return lm[tip].y > lm[pip].y - 0.01;
}

/**
 * @param {import('@mediapipe/tasks-vision').NormalizedLandmark[]} lm
 * @returns {'gun' | 'handshake' | null}
 */
export function classifyGesture(lm) {
  if (!lm || lm.length < 21) return null;

  const indexExt = isFingerExtended(lm, 8, 6, 5);
  const middleExt = isFingerExtended(lm, 12, 10, 9);
  const ringExt = isFingerExtended(lm, 16, 14, 13);
  const pinkyExt = isFingerExtended(lm, 20, 18, 17);

  const middleCurled = isFingerCurled(lm, 12, 10);
  const ringCurled = isFingerCurled(lm, 16, 14);
  const pinkyCurled = isFingerCurled(lm, 20, 18);

  if (indexExt && middleCurled && ringCurled && pinkyCurled) {
    return 'gun';
  }

  if (indexExt && middleExt && ringExt && pinkyExt) {
    const spread =
      dist(lm[8], lm[12]) + dist(lm[12], lm[16]) + dist(lm[16], lm[20]);
    if (spread > 0.08) return 'handshake';
  }

  return null;
}

async function loadVisionModule(visionCdn) {
  return import(`${visionCdn}/vision_bundle.mjs`);
}

async function probeModelUrl(url) {
  if (!url.includes('/assets/models/')) return;
  const res = await fetch(url, { method: 'HEAD' });
  if (!res.ok) throw new Error(`本地模型不可达 (${res.status})`);
}

async function createHandLandmarker(delegate, visionCdn, modelUrl) {
  const { HandLandmarker, FilesetResolver } = await loadVisionModule(visionCdn);
  const vision = await FilesetResolver.forVisionTasks(`${visionCdn}/wasm`);
  return HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: modelUrl,
      delegate
    },
    ...LANDMARKER_OPTIONS
  });
}

async function tryCreateLandmarker(delegate) {
  const errors = [];

  for (const modelUrl of MODEL_URL_CANDIDATES) {
    try {
      await probeModelUrl(modelUrl);
    } catch (err) {
      errors.push(String(err?.message || err));
      continue;
    }

    for (const visionCdn of VISION_CDN_CANDIDATES) {
      try {
        const landmarker = await createHandLandmarker(delegate, visionCdn, modelUrl);
        activeDelegate = delegate;
        activeModelUrl = modelUrl;
        return landmarker;
      } catch (err) {
        errors.push(`${delegate} @ ${visionCdn}: ${err?.message || err}`);
      }
    }
  }

  throw new Error(errors.join(' | ') || 'HandLandmarker 初始化失败');
}

async function ensureHandLandmarker(forceDelegate) {
  if (handLandmarker && (!forceDelegate || activeDelegate === forceDelegate)) {
    return handLandmarker;
  }

  if (landmarkerLoading && !forceDelegate) return landmarkerLoading;

  const delegates = forceDelegate ? [forceDelegate] : ['GPU', 'CPU'];

  landmarkerLoading = (async () => {
    const errors = [];
    for (const delegate of delegates) {
      try {
        handLandmarker = await tryCreateLandmarker(delegate);
        return handLandmarker;
      } catch (err) {
        errors.push(String(err?.message || err));
        handLandmarker = null;
      }
    }
    landmarkerLoading = null;
    throw new Error(errors.join(' · ') || 'MediaPipe 无法初始化');
  })();

  try {
    return await landmarkerLoading;
  } finally {
    if (handLandmarker) landmarkerLoading = null;
  }
}

async function switchToCpuLandmarker() {
  if (cpuFallbackAttempted || activeDelegate === 'CPU') return false;
  cpuFallbackAttempted = true;

  try {
    handLandmarker?.close?.();
  } catch (_) {
    /* ignore */
  }
  handLandmarker = null;
  landmarkerLoading = null;

  try {
    await ensureHandLandmarker('CPU');
    setStatus('已切换为 CPU 推理 · 请重新将手放入画面');
    return true;
  } catch (err) {
    console.warn('CPU 回退失败', err);
    setStatus('检测引擎异常 · 请使用下方鼠标确认');
    showFallback(true);
    return false;
  }
}

function bindDom() {
  if (els.overlay) return;
  els.overlay = $('#gesture-overlay');
  els.video = $('#gesture-video');
  els.canvas = $('#gesture-canvas');
  els.hint = $('#gesture-hint');
  els.status = $('#gesture-status');
  els.meterGun = $('#gesture-meter-gun');
  els.meterHandshake = $('#gesture-meter-handshake');
  els.fallback = $('#gesture-fallback');
  els.skipBtn = $('#gesture-skip');
  els.closeBtn = $('#gesture-close');
}

function setHint(text) {
  if (els.hint) els.hint.textContent = text;
}

function setStatus(text) {
  if (els.status) els.status.textContent = text;
}

function setMeter(el, value) {
  if (!el) return;
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  el.style.setProperty('--meter', String(pct));
  const fill = el.querySelector('.gesture-meter-fill');
  if (fill) fill.style.width = `${pct}%`;
}

function showFallback(show) {
  els.fallback?.classList.toggle('hidden', !show);
}

function drawLandmarks(landmarks, width, height) {
  const ctx = els.canvas?.getContext('2d');
  if (!ctx || !landmarks?.length) return;

  ctx.clearRect(0, 0, width, height);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.75)';
  ctx.fillStyle = 'rgba(255, 80, 120, 0.9)';

  for (const hand of landmarks) {
    for (const [a, b] of HAND_CONNECTIONS) {
      const p1 = hand[a];
      const p2 = hand[b];
      ctx.beginPath();
      ctx.moveTo(p1.x * width, p1.y * height);
      ctx.lineTo(p2.x * width, p2.y * height);
      ctx.stroke();
    }
    for (const pt of hand) {
      ctx.beginPath();
      ctx.arc(pt.x * width, pt.y * height, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function waitForVideoReady(video, timeoutMs = 15000) {
  if (video.readyState >= 2 && video.videoWidth > 0) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const onReady = () => {
      cleanup();
      if (video.videoWidth > 0) resolve();
      else reject(new Error('摄像头画面尺寸无效'));
    };
    const onError = () => {
      cleanup();
      reject(new Error('摄像头画面加载失败'));
    };
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error('摄像头画面加载超时'));
    }, timeoutMs);

    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onReady);
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('canplay', onReady);
      video.removeEventListener('error', onError);
      clearTimeout(timer);
    };

    video.addEventListener('loadedmetadata', onReady);
    video.addEventListener('loadeddata', onReady);
    video.addEventListener('canplay', onReady);
    video.addEventListener('error', onError);
  });
}

async function startCamera() {
  if (!els.video) throw new Error('摄像头元素未就绪');
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('当前浏览器不支持摄像头（需 HTTPS 或 localhost）');
  }

  mediaStream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: 'user',
      width: { ideal: 1280, min: 640 },
      height: { ideal: 720, min: 480 }
    },
    audio: false
  });

  els.video.srcObject = mediaStream;
  els.video.playsInline = true;
  els.video.muted = true;
  await els.video.play();
  await waitForVideoReady(els.video);
}

function stopCamera() {
  if (detectRafId) cancelAnimationFrame(detectRafId);
  detectRafId = 0;

  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop());
    mediaStream = null;
  }
  if (els.video) {
    els.video.srcObject = null;
  }
  const ctx = els.canvas?.getContext('2d');
  ctx?.clearRect(0, 0, els.canvas.width, els.canvas.height);
}

function resizeCanvas() {
  if (!els.video || !els.canvas) return;
  const w = els.video.videoWidth || 640;
  const h = els.video.videoHeight || 480;
  if (els.canvas.width !== w || els.canvas.height !== h) {
    els.canvas.width = w;
    els.canvas.height = h;
  }
}

function finishSession(nextId, gestureLabel) {
  if (!activeSession || activeSession.settled) return;
  activeSession.settled = true;
  activeSession.cleanup?.();
  stopCamera();
  els.overlay?.classList.add('hidden');
  els.overlay?.setAttribute('aria-hidden', 'true');

  const cb = activeSession.onSelect;
  activeSession = null;
  cpuFallbackAttempted = false;

  if (cb && nextId) cb(nextId, gestureLabel);
}

function stopSession() {
  if (!activeSession) return;
  activeSession.settled = true;
  activeSession.cleanup?.();
  stopCamera();
  els.overlay?.classList.add('hidden');
  els.overlay?.setAttribute('aria-hidden', 'true');
  activeSession = null;
  cpuFallbackAttempted = false;
}

function bindFallbackButtons(session) {
  if (!els.fallback) return;
  els.fallback.querySelectorAll('[data-next]').forEach((btn) => {
    btn.onclick = () => {
      const next = btn.getAttribute('data-next');
      finishSession(next, 'mouse');
    };
  });
}

function startDetectLoop(session) {
  let holdGesture = null;
  let holdCount = 0;
  let lastVideoTime = -1;
  let fallbackShown = false;
  let detectStartedAt = 0;
  let cpuFallbackTimer = 0;
  let switchingDelegate = false;

  const fallbackTimer = setTimeout(() => {
    if (session.settled) return;
    fallbackShown = true;
    showFallback(true);
    setHint('长时间未识别手势 · 请使用下方鼠标确认，或继续尝试比出手势');
  }, FALLBACK_AFTER_MS);

  const scheduleCpuFallback = () => {
    clearTimeout(cpuFallbackTimer);
    if (activeDelegate === 'CPU' || cpuFallbackAttempted) return;
    cpuFallbackTimer = window.setTimeout(async () => {
      if (session.settled || switchingDelegate) return;
      switchingDelegate = true;
      const ok = await switchToCpuLandmarker();
      switchingDelegate = false;
      if (ok) scheduleCpuFallback();
    }, CPU_FALLBACK_AFTER_MS);
  };

  const tick = () => {
    detectRafId = requestAnimationFrame(tick);
    if (session.settled || !handLandmarker || !els.video) return;
    if (els.video.readyState < 2 || els.video.videoWidth === 0) return;

    if (els.video.currentTime === lastVideoTime) return;
    lastVideoTime = els.video.currentTime;

    if (!detectStartedAt) {
      detectStartedAt = performance.now();
      scheduleCpuFallback();
    }

    resizeCanvas();
    const now = performance.now();
    let results;
    try {
      results = handLandmarker.detectForVideo(els.video, now);
    } catch (err) {
      console.warn('detectForVideo 失败', err);
      setStatus('检测帧异常 · 正在尝试恢复…');
      scheduleCpuFallback();
      return;
    }

    if (results.landmarks?.length) {
      clearTimeout(cpuFallbackTimer);
      drawLandmarks(results.landmarks, els.canvas.width, els.canvas.height);
      const gesture = classifyGesture(results.landmarks[0]);

      if (gesture === 'gun') {
        setMeter(els.meterGun, Math.min(1, (holdCount + 1) / HOLD_FRAMES));
        setMeter(els.meterHandshake, 0);
        setStatus('识别中：手枪手势 · 警惕');
      } else if (gesture === 'handshake') {
        setMeter(els.meterHandshake, Math.min(1, (holdCount + 1) / HOLD_FRAMES));
        setMeter(els.meterGun, 0);
        setStatus('识别中：伸手/握手 · 握上');
      } else {
        setMeter(els.meterGun, 0);
        setMeter(els.meterHandshake, 0);
        setStatus('扫描中… 请比出手枪或伸手手势');
      }

      if (gesture && gesture === holdGesture) {
        holdCount += 1;
      } else {
        holdGesture = gesture;
        holdCount = gesture ? 1 : 0;
      }

      if (holdCount >= HOLD_FRAMES && holdGesture) {
        clearTimeout(fallbackTimer);
        clearTimeout(cpuFallbackTimer);
        const choice = session.choices.find((c) => c.gesture === holdGesture);
        if (choice) {
          setStatus(`手势确认：${choice.label}`);
          setTimeout(() => finishSession(choice.next, holdGesture), 400);
        }
      }
    } else {
      drawLandmarks([], els.canvas.width, els.canvas.height);
      holdGesture = null;
      holdCount = 0;
      setMeter(els.meterGun, 0);
      setMeter(els.meterHandshake, 0);
      if (!fallbackShown) setStatus('等待手部进入扫描框…');
    }
  };

  detectRafId = requestAnimationFrame(tick);

  session.cleanup = () => {
    clearTimeout(fallbackTimer);
    clearTimeout(cpuFallbackTimer);
    if (detectRafId) cancelAnimationFrame(detectRafId);
    detectRafId = 0;
  };
}

/**
 * @param {{
 *   mode?: 'story' | 'test',
 *   title?: string,
 *   subtitle?: string,
 *   choices?: { label: string, next: string, gesture: 'gun' | 'handshake' }[],
 *   onSelect?: (nextId: string, via: string) => void
 * }} options
 */
export async function openGestureOverlay(options = {}) {
  bindDom();
  if (!els.overlay) throw new Error('手势弹窗 DOM 未找到');

  if (activeSession) stopSession();
  cpuFallbackAttempted = false;

  const session = {
    mode: options.mode || 'test',
    choices: options.choices || [
      { label: '警惕', next: '26', gesture: 'gun' },
      { label: '握上', next: '27', gesture: 'handshake' }
    ],
    onSelect: options.onSelect || null,
    settled: false,
    cleanup: null
  };
  activeSession = session;

  els.overlay.classList.remove('hidden');
  els.overlay.setAttribute('aria-hidden', 'false');
  showFallback(false);
  setMeter(els.meterGun, 0);
  setMeter(els.meterHandshake, 0);

  const titleEl = $('#gesture-title');
  const subEl = $('#gesture-subtitle');
  if (titleEl) titleEl.textContent = options.title || '生物特征验证 · 手势协议';
  if (subEl) {
    subEl.textContent =
      options.subtitle ||
      '新人类伸出了手。比出手枪手势 → 警惕；伸手握手 → 握上。保持姿势约 1 秒以确认。';
  }

  setHint('正在加载手势模型…');
  setStatus('系统初始化');

  els.skipBtn.onclick = () => {
    showFallback(true);
    setHint('已跳过自动检测 · 请用鼠标选择，或继续比出手势');
  };

  els.closeBtn.onclick = () => {
    if (session.mode === 'test') {
      session.cleanup?.();
      stopSession();
    } else {
      showFallback(true);
      setHint('可关闭弹窗并使用下方选项（剧情需做出选择）');
    }
  };

  bindFallbackButtons(session);

  try {
    await ensureHandLandmarker();
    setHint('正在请求摄像头权限…');
    await startCamera();
    const modelLabel = activeModelUrl.includes('assets/') ? '本地模型' : 'CDN 模型';
    setHint('摄像头已就绪 · 请将手部置于画面中央');
    setStatus(`检测就绪 · ${activeDelegate} · ${modelLabel}`);
    startDetectLoop(session);
  } catch (err) {
    console.error(err);
    showFallback(true);
    setHint('无法启动摄像头或 MediaPipe · 请使用鼠标选择');
    setStatus(err?.message || '初始化失败');
  }
}

export function setupGestureTestButton() {
  bindDom();
  const btn = $('#btn-gesture-test');
  btn?.addEventListener('click', () => {
    openGestureOverlay({
      mode: 'test',
      title: '手势实时检测 · 测试模式',
      subtitle: 'Development build · 手枪手势 = 警惕 · 伸手/握手 = 握上'
    });
  });
}

export async function preloadGestureEngine() {
  try {
    await ensureHandLandmarker();
    console.info(
      `[Gesture] MediaPipe 预加载完成 · delegate=${activeDelegate} · model=${activeModelUrl}`
    );
  } catch (err) {
    console.warn('MediaPipe 预加载失败，首次打开手势检测时会重试。', err);
  }
}
