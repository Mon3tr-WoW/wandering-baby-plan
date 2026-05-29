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

function rand(min, max) {
  return min + Math.random() * (max - min);
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
  const scale = rand(0.8, 1.65);
  const rgb = pickDustTone();
  return {
    x,
    y,
    vx: rand(-0.16, 0.16),
    vy: rand(-0.24, 0.05),
    len: rand(22, 58) * scale,
    width: rand(2.8, 9) * scale,
    angle: rand(0, Math.PI * 2),
    drift: rand(0.01, 0.028),
    phase: Math.random() * Math.PI * 2,
    twinkle: rand(0.004, 0.012),
    strength: rand(0.72, 1),
    rgb,
    seed: Math.random() * 100
  };
}

/** 网格抖动：全屏均匀分布 */
function buildDustField() {
  const area = width * height;
  const count = Math.min(280, Math.max(120, Math.floor(area / 5000)));
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

/** 写实尘缕：暗边 + 主体 + 受光纤维（高对比，确保可见） */
function drawDustStrand(p, layerA) {
  const flicker = 0.82 + Math.sin(p.phase) * 0.18;
  const a = p.strength * flicker * layerA;
  if (a < 0.08) return;

  const [r, g, b] = p.rgb;
  const hi = lerpRgb([r, g, b], DUST_HI, 0.55);
  const lo = lerpRgb([r, g, b], DUST_LO, 0.65);
  const len = p.len;
  const w = p.width;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);

  ctx.globalCompositeOperation = 'source-over';

  const halo = ctx.createLinearGradient(-len * 0.55, 0, len * 0.55, 0);
  halo.addColorStop(0, rgba(lo, 0));
  halo.addColorStop(0.18, rgba(lo, a * 0.42));
  halo.addColorStop(0.5, rgba([r, g, b], a * 0.88));
  halo.addColorStop(0.78, rgba(hi, a * 0.72));
  halo.addColorStop(1, rgba(lo, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.ellipse(0, 0, len * 0.52, w * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = rgba(lo, a * 0.55);
  ctx.lineWidth = Math.max(0.8, w * 0.22);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-len * 0.46, w * 0.05);
  ctx.bezierCurveTo(
    -len * 0.15, -w * 0.34,
    len * 0.14, w * 0.28,
    len * 0.42, -w * 0.03
  );
  ctx.stroke();

  ctx.strokeStyle = rgba(hi, a * 0.92);
  ctx.lineWidth = Math.max(0.45, w * 0.1);
  ctx.beginPath();
  ctx.moveTo(-len * 0.38, -w * 0.06);
  ctx.quadraticCurveTo(len * 0.02, w * 0.1, len * 0.36, w * 0.04);
  ctx.stroke();

  ctx.globalCompositeOperation = 'screen';
  ctx.strokeStyle = rgba(hi, a * 0.38);
  ctx.lineWidth = Math.max(0.35, w * 0.06);
  ctx.beginPath();
  ctx.moveTo(-len * 0.28, 0);
  ctx.lineTo(len * 0.3, -w * 0.02);
  ctx.stroke();

  const flecks = 3 + Math.floor(p.seed % 2);
  for (let i = 0; i < flecks; i++) {
    const t = (i + 0.5) / flecks - 0.5;
    const fx = t * len * 0.62;
    const fy = Math.sin(p.seed + i * 2.1) * w * 0.22;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = rgba(hi, a * (0.35 + i * 0.08));
    ctx.beginPath();
    ctx.ellipse(fx, fy, w * 0.18, w * 0.08, t * 0.5, 0, Math.PI * 2);
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
      p.angle += Math.sin(floatT * 0.35 + p.phase) * 0.0005;

      if (p.x < -40 || p.x > width + 40 || p.y < -40 || p.y > height + 40) {
        respawnDust(p);
      }

      drawDustStrand(p, layerA);
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
  if (!canvas) return;
  canvas.classList.toggle('disabled', !enabled);
  canvas.closest('.start-layer-dust')?.classList.toggle('disabled', !enabled);
}
