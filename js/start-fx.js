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

function spawnDust() {
  const warm = Math.random() > 0.42;
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    vx: rand(-0.22, 0.22),
    vy: rand(-0.38, -0.04),
    r: rand(0.4, warm ? 2.1 : 1.4),
    phase: Math.random() * Math.PI * 2,
    twinkle: rand(0.012, 0.028),
    alpha: rand(0.12, warm ? 0.55 : 0.42),
    warm
  };
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

  const count = Math.min(95, Math.floor((width * height) / 14000));
  dustParticles = Array.from({ length: count }, spawnDust);
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

function drawDustMote(x, y, r, alpha, warm) {
  const a = alpha * dustLayerAlpha();
  if (a < 0.02) return;

  const core = warm ? `rgba(255, 210, 140, ${a})` : `rgba(180, 230, 255, ${a * 0.9})`;
  const glow = warm ? `rgba(255, 160, 90, ${a * 0.25})` : `rgba(0, 240, 255, ${a * 0.2})`;

  ctx.beginPath();
  ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, r * 0.65, 0, Math.PI * 2);
  ctx.fillStyle = core;
  ctx.fill();
}

let lastFrame = 0;

function tick(now) {
  if (!canvasActive || !ctx) {
    rafId = 0;
    return;
  }

  const dt = lastFrame ? now - lastFrame : 16;
  lastFrame = now;
  floatT += 0.012;

  const layerA = dustLayerAlpha();
  ctx.clearRect(0, 0, width, height);

  if (enabled && layerA > 0.02) {
    for (const p of dustParticles) {
      p.x += p.vx;
      p.y += p.vy;
      p.phase += p.twinkle;
      const flicker = 0.45 + Math.sin(p.phase) * 0.55;

      if (p.y < -12 || p.x < -12 || p.x > width + 12) {
        p.x = Math.random() * width;
        p.y = height + rand(0, 40);
      }

      drawDustMote(p.x, p.y, p.r, p.alpha * flicker, p.warm);
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
