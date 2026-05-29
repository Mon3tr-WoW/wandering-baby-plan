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
  colorFadeEnd: 1.6
};

/** 以 #b7b28a 为中心的星际尘埃色板 */
const DUST_PALETTE = [
  [183, 178, 138],
  [196, 191, 158],
  [212, 207, 176],
  [168, 163, 128],
  [154, 149, 122],
  [138, 133, 108],
  [201, 196, 165]
];

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function pickDustColor() {
  return DUST_PALETTE[Math.floor(Math.random() * DUST_PALETTE.length)];
}

function createDustParticle(x, y) {
  const scale = rand(0.65, 1.45);
  const [r, g, b] = pickDustColor();
  const angle = rand(0, Math.PI);
  return {
    x,
    y,
    vx: rand(-0.2, 0.2),
    vy: rand(-0.32, 0.05),
    len: rand(11, 34) * scale,
    width: rand(1.6, 5.2) * scale,
    angle,
    drift: rand(0.015, 0.04),
    phase: Math.random() * Math.PI * 2,
    twinkle: rand(0.006, 0.018),
    alpha: rand(0.14, 0.42),
    rgb: [r, g, b],
    strand: rand(0.35, 1)
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
  const next = createDustParticle(
    (col + 0.12 + Math.random() * 0.76) * cellW,
    (row + 0.12 + Math.random() * 0.76) * cellH
  );
  Object.assign(p, next);
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

/** 绘制一缕写实星际尘埃：柔长椭羽 + 细纤维 + 微粒絮团 */
function drawDustWisp(p, layerA) {
  const flicker = 0.72 + Math.sin(p.phase) * 0.28;
  const a = p.alpha * flicker * layerA;
  if (a < 0.02) return;

  const [r, g, b] = p.rgb;
  const ca = a * 0.55;
  const len = p.len;
  const w = p.width;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);

  const bodyGrad = ctx.createLinearGradient(-len * 0.5, 0, len * 0.5, 0);
  bodyGrad.addColorStop(0, `rgba(${r},${g},${b},0)`);
  bodyGrad.addColorStop(0.28, `rgba(${r},${g},${b},${ca * 0.22})`);
  bodyGrad.addColorStop(0.5, `rgba(${r},${g},${b},${ca * 0.48})`);
  bodyGrad.addColorStop(0.72, `rgba(${r},${g},${b},${ca * 0.18})`);
  bodyGrad.addColorStop(1, `rgba(${r},${g},${b},0)`);

  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.ellipse(0, 0, len * 0.48, w * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();

  const hazeGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, len * 0.32);
  hazeGrad.addColorStop(0, `rgba(${r},${g},${b},${ca * 0.2})`);
  hazeGrad.addColorStop(0.55, `rgba(${r},${g},${b},${ca * 0.08})`);
  hazeGrad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = hazeGrad;
  ctx.beginPath();
  ctx.ellipse(0, 0, len * 0.28, w * 0.75, 0.15, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = `rgba(${r},${g},${b},${ca * 0.32})`;
  ctx.lineWidth = Math.max(0.35, w * 0.12);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-len * 0.42, w * 0.08 * p.strand);
  ctx.bezierCurveTo(
    -len * 0.12, -w * 0.28,
    len * 0.1, w * 0.22,
    len * 0.38, -w * 0.04
  );
  ctx.stroke();

  const fleckCount = 2 + Math.floor(p.strand * 2);
  for (let i = 0; i < fleckCount; i++) {
    const t = (i + 0.5) / fleckCount - 0.5;
    const fx = t * len * 0.55 + Math.sin(p.phase * 2.7 + i * 1.9) * 1.15;
    const fy = Math.cos(p.phase * 2.1 + i * 2.3) * w * 0.28;
    const fr = (0.35 + (i % 3) * 0.22) * w * 0.22;
    const fleckGrad = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr * 2.2);
    fleckGrad.addColorStop(0, `rgba(${r},${g},${b},${ca * 0.35})`);
    fleckGrad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = fleckGrad;
    ctx.beginPath();
    ctx.ellipse(fx, fy, fr * 1.6, fr, t * 0.6, 0, Math.PI * 2);
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
  floatT += 0.01;

  const layerA = dustLayerAlpha();
  ctx.clearRect(0, 0, width, height);

  if (enabled && layerA > 0.02) {
    for (const p of dustParticles) {
      p.x += p.vx + Math.sin(floatT + p.phase) * p.drift;
      p.y += p.vy + Math.cos(floatT * 0.82 + p.phase) * p.drift * 0.85;
      p.phase += p.twinkle;
      p.angle += Math.sin(floatT * 0.4 + p.phase) * 0.0008;

      if (p.x < -24 || p.x > width + 24 || p.y < -24 || p.y > height + 24) {
        respawnDust(p);
      }

      drawDustWisp(p, layerA);
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
