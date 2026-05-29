/**
 * 开始界面：灰尘粒子 + 彩色层淡入 + 背景音乐
 */

/** @type {HTMLCanvasElement | null} */
let canvas = null;
/** @type {CanvasRenderingContext2D | null} */
let ctx = null;
/** @type {HTMLAudioElement | null} */
let startMusic = null;

let dustParticles = [];
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
  colorFadeEnd: 1.6
};

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function createDustParticle(x, y) {
  const warm = Math.random() > 0.38;
  const bright = Math.random() > 0.88;
  return {
    x,
    y,
    vx: rand(-0.28, 0.28),
    vy: rand(-0.42, 0.08),
    r: bright ? rand(1.8, 3.4) : rand(0.55, warm ? 2.6 : 2.0),
    phase: Math.random() * Math.PI * 2,
    twinkle: rand(0.014, 0.034),
    alpha: bright ? rand(0.55, 0.92) : rand(0.32, warm ? 0.78 : 0.68),
    warm,
    bright
  };
}

/** 网格抖动：全屏均匀分布，避免灰尘扎堆 */
function buildDustField() {
  const area = width * height;
  const count = Math.min(320, Math.max(140, Math.floor(area / 4200)));
  const aspect = width / Math.max(height, 1);
  const cols = Math.max(10, Math.round(Math.sqrt(count * aspect)));
  const rows = Math.max(8, Math.ceil(count / cols));
  const cellW = width / cols;
  const cellH = height / rows;

  dustParticles = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (dustParticles.length >= count) break;
      const jitterX = 0.1 + Math.random() * 0.8;
      const jitterY = 0.1 + Math.random() * 0.8;
      dustParticles.push(
        createDustParticle((col + jitterX) * cellW, (row + jitterY) * cellH)
      );
    }
  }

  while (dustParticles.length < count) {
    dustParticles.push(createDustParticle(Math.random() * width, Math.random() * height));
  }
}

function respawnDust(p) {
  const cols = 12;
  const rows = 8;
  const cellW = width / cols;
  const cellH = height / rows;
  const col = Math.floor(Math.random() * cols);
  const row = Math.floor(Math.random() * rows);
  p.x = (col + 0.12 + Math.random() * 0.76) * cellW;
  p.y = (row + 0.12 + Math.random() * 0.76) * cellH;
  p.vx = rand(-0.28, 0.28);
  p.vy = rand(-0.42, 0.08);
  p.phase = Math.random() * Math.PI * 2;
}

function resize() {
  if (!canvas) return;
  width = window.innerWidth;
  height = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
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
  return Math.min(1, t / INTRO.colorFadeEnd);
}

function drawDustMote(x, y, r, alpha, warm, bright) {
  const a = alpha * dustLayerAlpha();
  if (a < 0.03) return;

  const glowScale = bright ? 3.4 : 2.8;
  const coreA = bright ? a : a * 0.95;
  const glowA = bright ? a * 0.42 : a * 0.34;

  const core = warm
    ? `rgba(255, 225, 175, ${coreA})`
    : `rgba(210, 245, 255, ${coreA})`;
  const glow = warm
    ? `rgba(255, 175, 100, ${glowA})`
    : `rgba(140, 230, 255, ${glowA})`;

  ctx.beginPath();
  ctx.arc(x, y, r * glowScale, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, r * (bright ? 0.75 : 0.6), 0, Math.PI * 2);
  ctx.fillStyle = core;
  ctx.fill();

  if (bright) {
    ctx.beginPath();
    ctx.arc(x, y, r * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${a * 0.85})`;
    ctx.fill();
  }
}

let lastFrame = 0;

function tick(now) {
  if (!canvasActive || !ctx) {
    rafId = 0;
    return;
  }

  lastFrame = now;
  floatT += 0.012;

  const layerA = dustLayerAlpha();
  ctx.clearRect(0, 0, width, height);

  if (enabled && layerA > 0.02) {
    for (const p of dustParticles) {
      p.x += p.vx + Math.sin(floatT + p.phase) * 0.04;
      p.y += p.vy + Math.cos(floatT * 0.85 + p.phase) * 0.03;
      p.phase += p.twinkle;
      const flicker = 0.5 + Math.sin(p.phase) * 0.5;

      if (p.x < -16 || p.x > width + 16 || p.y < -16 || p.y > height + 16) {
        respawnDust(p);
      }

      drawDustMote(p.x, p.y, p.r, p.alpha * flicker, p.warm, p.bright);
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
  if (!startMusic) return false;
  startMusic.loop = true;
  startMusic.load();
  try {
    const elapsed = getIntroTime();
    startMusic.currentTime = Math.min(elapsed, startMusic.duration || elapsed);
    await startMusic.play();
    introAudioSynced = true;
    hideUnlockHint();
    return true;
  } catch {
    return false;
  }
}

function bindAudioUnlock() {
  const unlock = () => {
    if (introAudioSynced || !startMusic) return;
    startMusic.currentTime = getIntroTime();
    startMusic
      .play()
      .then(() => {
        introAudioSynced = true;
        hideUnlockHint();
      })
      .catch(() => {});
  };
  document.addEventListener('pointerdown', unlock, { passive: true });
  document.addEventListener('keydown', unlock);
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

/** 兜底：跳过入场动画，直接显示开始界面 */
export function forceRevealStartScreen() {
  introRunning = false;
  document.body.classList.add('start-screen-active', 'start-intro-active', 'start-reveal-ready');
  finishIntroInstant();
}

export function setStartCanvasActive(on) {
  canvasActive = !!on;
  if (canvasActive && !rafId) {
    lastFrame = 0;
    rafId = requestAnimationFrame(tick);
  }
}

export function initStartFx(targetCanvas, audioEl) {
  canvas = targetCanvas;
  startMusic = audioEl ?? null;
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!canvas) return;
  ctx = canvas.getContext('2d', { alpha: true });
  resize();
  window.addEventListener('resize', resize);
  bindAudioUnlock();
  canvasActive = true;
  if (!rafId) rafId = requestAnimationFrame(tick);
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
    if (!played) showUnlockHint();
  }
}

export function pauseStartMusic() {
  stopIntroLoop();
  if (startMusic) startMusic.pause();
}

export function setStartMusicVolume(v) {
  if (startMusic) startMusic.volume = Math.max(0, Math.min(1, v));
}

export function setParticlesEnabled(on) {
  enabled = !!on;
  if (canvas) canvas.classList.toggle('disabled', !enabled);
}
