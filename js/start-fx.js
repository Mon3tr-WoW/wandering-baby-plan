/**
 * 开始界面：星际尘埃粒子 + 彩色层淡入 + 背景音乐
 */

/** @type {HTMLCanvasElement | null} */
let canvas = null;
/** @type {CanvasRenderingContext2D | null} */
let ctx = null;
/** @type {HTMLAudioElement | null} */
let startMusic = null;

let dustParticles = [];
let dustGrains = [];
let rafId = 0;
let enabled = true;
let canvasActive = false;
let width = 0;
let height = 0;
let floatT = 0;
let introRunning = false;
let introClockStart = 0;
let introAudioSynced = false;
let introRafId = 0;
let reducedMotion = false;

const INTRO = {
  colorFadeEnd: 1.2
};

/** 以 #b7b28a 为中心的色板：亮高光 → 主色 → 暗阴影 */
const DUST_CORE = [183, 178, 138];
const DUST_HI = [232, 227, 198];
const DUST_LO = [92, 88, 72];

let musicRetryTimer = 0;

function clearMusicRetry() {
  if (musicRetryTimer) {
    clearInterval(musicRetryTimer);
    musicRetryTimer = 0;
  }
}

function scheduleMusicRetry() {
  clearMusicRetry();
  musicRetryTimer = window.setInterval(() => {
    if (!document.body.classList.contains('start-screen-active')) {
      clearMusicRetry();
      return;
    }
    if (startMusic?.paused) tryPlayMusic();
    else clearMusicRetry();
  }, 2500);
}

function isStartScreenActive() {
  return document.body.classList.contains('start-screen-active');
}

function lerpRgb(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t)
  ];
}

function pickDustTone() {
  const t = Math.random();
  if (t < 0.22) return lerpRgb(DUST_CORE, DUST_HI, rand(0.35, 1));
  if (t > 0.82) return lerpRgb(DUST_CORE, DUST_LO, rand(0.25, 0.85));
  return lerpRgb(DUST_CORE, DUST_HI, rand(0, 0.35));
}

function createDustParticle(x, y) {
  const scale = rand(0.55, 1.35);
  const rgb = pickDustTone();
  const blobCount = 2 + Math.floor(Math.random() * 3);
  const blobs = [];

  for (let i = 0; i < blobCount; i++) {
    blobs.push({
      ox: rand(-7, 7) * scale,
      oy: rand(-5, 5) * scale,
      r: rand(2.5, 11) * scale,
      weight: rand(0.3, 1)
    });
  }

  return {
    x,
    y,
    vx: rand(-0.14, 0.14),
    vy: rand(-0.2, 0.04),
    scale,
    blobs,
    drift: rand(0.008, 0.022),
    phase: Math.random() * Math.PI * 2,
    twinkle: rand(0.003, 0.01),
    strength: rand(0.55, 0.9),
    rgb,
    wisp: Math.random() > 0.72 ? rand(0.35, 0.85) : 0,
    wispAngle: rand(0, Math.PI * 2)
  };
}

/** 微尘粒：不规则细屑，附于絮团之间 */
function createDustGrain(x, y) {
  const rgb = pickDustTone();
  const size = rand(0.7, 2.4);
  return {
    x,
    y,
    vx: rand(-0.1, 0.1),
    vy: rand(-0.16, 0.04),
    size,
    aspect: rand(0.45, 1.15),
    angle: rand(0, Math.PI * 2),
    drift: rand(0.006, 0.018),
    phase: Math.random() * Math.PI * 2,
    twinkle: rand(0.004, 0.012),
    strength: rand(0.48, 0.92),
    rgb,
    satellite: Math.random() > 0.55
      ? { ox: rand(-2.2, 2.2), oy: rand(-1.8, 1.8), s: rand(0.35, 0.85) }
      : null
  };
}

/** 网格抖动：全屏均匀分布（密度约为此前一半） */
function buildDustField() {
  const area = width * height;
  const count = Math.min(140, Math.max(60, Math.floor(area / 10000)));
  const grainCount = Math.min(200, Math.max(85, Math.floor(area / 7500)));
  const aspect = width / Math.max(height, 1);
  const cols = Math.max(10, Math.round(Math.sqrt(count * aspect)));
  const rows = Math.max(8, Math.ceil(count / cols));
  const cellW = width / cols;
  const cellH = height / rows;

  dustParticles = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (dustParticles.length >= count) break;
      dustParticles.push(
        createDustParticle(
          (col + 0.12 + Math.random() * 0.76) * cellW,
          (row + 0.12 + Math.random() * 0.76) * cellH
        )
      );
    }
  }

  const gAspect = width / Math.max(height, 1);
  const gCols = Math.max(12, Math.round(Math.sqrt(grainCount * gAspect)));
  const gRows = Math.max(9, Math.ceil(grainCount / gCols));
  const gCellW = width / gCols;
  const gCellH = height / gRows;

  dustGrains = [];
  for (let row = 0; row < gRows; row++) {
    for (let col = 0; col < gCols; col++) {
      if (dustGrains.length >= grainCount) break;
      dustGrains.push(
        createDustGrain(
          (col + 0.08 + Math.random() * 0.84) * gCellW,
          (row + 0.08 + Math.random() * 0.84) * gCellH
        )
      );
    }
  }
}

function respawnDust(p) {
  const cols = 12;
  const rows = 8;
  const cellW = width / cols;
  const cellH = height / rows;
  Object.assign(
    p,
    createDustParticle(
      (Math.floor(Math.random() * cols) + 0.12 + Math.random() * 0.76) * cellW,
      (Math.floor(Math.random() * rows) + 0.12 + Math.random() * 0.76) * cellH
    )
  );
}

function respawnGrain(g) {
  const cols = 14;
  const rows = 10;
  const cellW = width / cols;
  const cellH = height / rows;
  Object.assign(
    g,
    createDustGrain(
      (Math.floor(Math.random() * cols) + 0.08 + Math.random() * 0.84) * cellW,
      (Math.floor(Math.random() * rows) + 0.08 + Math.random() * 0.84) * cellH
    )
  );
}

function resize() {
  if (!canvas) return;
  const layer = canvas.parentElement;
  width = layer?.clientWidth || window.innerWidth;
  height = layer?.clientHeight || window.innerHeight;
  if (width < 2 || height < 2) {
    width = window.innerWidth;
    height = window.innerHeight;
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  buildDustField();
}

function getIntroTime() {
  if (introAudioSynced && startMusic && !startMusic.paused) {
    return startMusic.currentTime;
  }
  return (performance.now() - introClockStart) / 1000;
}

function showUnlockHint() {
  document.getElementById('start-unlock-hint')?.classList.remove('hidden');
}

function hideUnlockHint() {
  document.getElementById('start-unlock-hint')?.classList.add('hidden');
}

function dustLayerAlpha() {
  if (!document.body.classList.contains('start-screen-active')) return 0;
  if (document.body.classList.contains('start-reveal-ready')) return 1;
  const t = getIntroTime();
  return Math.max(0.65, Math.min(1, t / INTRO.colorFadeEnd));
}

function rgba(rgb, a) {
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
}

/** 写实尘埃：多团柔边絮云叠合，偶发极淡游丝（避免米粒状长条） */
function drawDustCloud(p, layerA) {
  const flicker = 0.84 + Math.sin(p.phase) * 0.16;
  const a = p.strength * flicker * layerA;
  if (a < 0.06) return;

  const [r, g, b] = p.rgb;
  const hi = lerpRgb([r, g, b], DUST_HI, 0.45);
  const lo = lerpRgb([r, g, b], DUST_LO, 0.35);

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';

  for (const blob of p.blobs) {
    const bx = p.x + blob.ox;
    const by = p.y + blob.oy;
    const br = blob.r;
    const ba = a * blob.weight * 0.52;

    const grad = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    grad.addColorStop(0, rgba(hi, ba * 0.42));
    grad.addColorStop(0.25, rgba([r, g, b], ba * 0.38));
    grad.addColorStop(0.55, rgba([r, g, b], ba * 0.16));
    grad.addColorStop(0.82, rgba(lo, ba * 0.06));
    grad.addColorStop(1, rgba(lo, 0));

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }

  if (p.wisp > 0) {
    const len = 6 + p.scale * 8;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.wispAngle);
    ctx.strokeStyle = rgba(hi, a * 0.12 * p.wisp);
    ctx.lineWidth = 0.45;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-len * 0.35, 0);
    ctx.quadraticCurveTo(0, len * 0.12, len * 0.3, -len * 0.05);
    ctx.stroke();
  }

  ctx.restore();
}

/** 微尘粒：柔边细屑 + 偶发伴生微粒，非长条 */
function drawDustGrain(g, layerA) {
  const flicker = 0.8 + Math.sin(g.phase) * 0.2;
  const a = g.strength * flicker * layerA;
  if (a < 0.05) return;

  const hi = lerpRgb(g.rgb, DUST_HI, 0.5);
  const lo = lerpRgb(g.rgb, DUST_LO, 0.4);
  const coreR = g.size;
  const haloR = coreR * 2.6;

  ctx.save();
  ctx.translate(g.x, g.y);
  ctx.rotate(g.angle);
  ctx.globalCompositeOperation = 'source-over';

  const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, haloR);
  halo.addColorStop(0, rgba(hi, a * 0.55));
  halo.addColorStop(0.35, rgba(g.rgb, a * 0.42));
  halo.addColorStop(0.7, rgba(g.rgb, a * 0.14));
  halo.addColorStop(1, rgba(lo, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.ellipse(0, 0, coreR * g.aspect, coreR, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = rgba(hi, a * 0.38);
  ctx.beginPath();
  ctx.ellipse(coreR * 0.15, -coreR * 0.1, coreR * 0.35, coreR * 0.28, 0.4, 0, Math.PI * 2);
  ctx.fill();

  if (g.satellite) {
    const sx = g.satellite.ox;
    const sy = g.satellite.oy;
    const sr = g.satellite.s * coreR * 0.55;
    const sGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 2);
    sGrad.addColorStop(0, rgba(g.rgb, a * 0.36));
    sGrad.addColorStop(1, rgba(lo, 0));
    ctx.fillStyle = sGrad;
    ctx.beginPath();
    ctx.ellipse(sx, sy, sr * 1.1, sr * 0.75, 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

let lastFrame = 0;

function tick(now) {
  if (!canvasActive || !ctx) {
    rafId = 0;
    return;
  }

  lastFrame = now;
  floatT += 0.011;

  const layerA = dustLayerAlpha();
  ctx.clearRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'source-over';

  const onStart = document.body.classList.contains('start-screen-active');
  if (onStart && layerA > 0.05) {
    for (const p of dustParticles) {
      p.x += p.vx + Math.sin(floatT + p.phase) * p.drift;
      p.y += p.vy + Math.cos(floatT * 0.85 + p.phase) * p.drift * 0.8;
      p.phase += p.twinkle;

      if (p.x < -40 || p.x > width + 40 || p.y < -40 || p.y > height + 40) {
        respawnDust(p);
      }

      drawDustCloud(p, layerA);
    }

    for (const g of dustGrains) {
      g.x += g.vx + Math.sin(floatT * 1.1 + g.phase) * g.drift;
      g.y += g.vy + Math.cos(floatT * 0.9 + g.phase) * g.drift * 0.75;
      g.phase += g.twinkle;

      if (g.x < -24 || g.x > width + 24 || g.y < -24 || g.y > height + 24) {
        respawnGrain(g);
      }

      drawDustGrain(g, layerA);
    }
  }

  rafId = requestAnimationFrame(tick);
}

function stopIntroLoop() {
  introRunning = false;
  if (introRafId) {
    cancelAnimationFrame(introRafId);
    introRafId = 0;
  }
}

function introLoop() {
  if (!introRunning) {
    introRafId = 0;
    return;
  }
  applyIntroTime(getIntroTime());
  introRafId = requestAnimationFrame(introLoop);
}

function startIntroLoop() {
  introRunning = true;
  if (!introRafId) introRafId = requestAnimationFrame(introLoop);
}

async function tryPlayMusic() {
  if (!startMusic || !isStartScreenActive()) return false;
  startMusic.loop = true;
  try {
    const elapsed = getIntroTime();
    if (Number.isFinite(startMusic.duration) && startMusic.duration > 0) {
      startMusic.currentTime = Math.min(elapsed, startMusic.duration);
    }
    await startMusic.play();
    introAudioSynced = true;
    hideUnlockHint();
    clearMusicRetry();
    return true;
  } catch {
    return false;
  }
}

function bindAudioUnlock() {
  const unlock = () => {
    if (!isStartScreenActive() || introAudioSynced || !startMusic) return;
    startMusic.currentTime = getIntroTime();
    startMusic
      .play()
      .then(() => {
        introAudioSynced = true;
        hideUnlockHint();
        clearMusicRetry();
      })
      .catch(() => {});
  };
  document.addEventListener('pointerdown', unlock, { passive: true, once: false });
  document.addEventListener('keydown', unlock, { once: false });
}

function applyIntroTime(t) {
  if (t >= INTRO.colorFadeEnd) {
    document.body.classList.add('start-reveal-ready');
  }
}

function finishIntroInstant() {
  stopIntroLoop();
  document.body.classList.add('start-reveal-ready');
  hideUnlockHint();
}

export function forceRevealStartScreen() {
  introRunning = false;
  document.body.classList.add('start-screen-active', 'start-intro-active', 'start-reveal-ready');
  finishIntroInstant();
}

export function setStartCanvasActive(on) {
  canvasActive = !!on;
  if (canvasActive) {
    resize();
    if (!rafId) {
      lastFrame = 0;
      rafId = requestAnimationFrame(tick);
    }
  }
}

export function initStartFx(targetCanvas, audioEl) {
  canvas = targetCanvas;
  startMusic = audioEl ?? null;
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!canvas) return;
  ctx = canvas.getContext('2d', { alpha: true });
  window.addEventListener('resize', resize);
  bindAudioUnlock();
  canvasActive = true;
  resize();
  requestAnimationFrame(resize);
  setParticlesEnabled(enabled);
  if (!rafId) rafId = requestAnimationFrame(tick);
  if (startMusic && isStartScreenActive()) {
    void tryPlayMusic().then((ok) => {
      if (!ok) scheduleMusicRetry();
    });
  }
}

export async function playStartIntro() {
  document.body.classList.remove('start-reveal-ready');

  introClockStart = performance.now();
  introAudioSynced = false;

  document.body.classList.add('start-intro-active');
  setStartCanvasActive(true);

  hideUnlockHint();
  applyIntroTime(0);
  startIntroLoop();

  if (reducedMotion) {
    finishIntroInstant();
    if (startMusic) await tryPlayMusic();
    return;
  }

  if (startMusic) {
    startMusic.currentTime = 0;
    const played = await tryPlayMusic();
    if (!played) scheduleMusicRetry();
  }
}

export function pauseStartMusic() {
  stopIntroLoop();
  clearMusicRetry();
  if (startMusic) startMusic.pause();
}

export function setStartMusicVolume(v) {
  if (startMusic) startMusic.volume = Math.max(0, Math.min(1, v));
}

export function setParticlesEnabled(on) {
  enabled = !!on;
  if (!canvas) return;
  canvas.classList.toggle('disabled', !enabled);
  canvas.closest('.start-layer-dust')?.classList.toggle('disabled', !enabled);
}
