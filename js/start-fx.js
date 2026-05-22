/**
 * 开始界面：Canvas 星空远景 + 参考图精灵（飞船/星球）+ 入场时间轴
 */

/** @type {HTMLCanvasElement | null} */
let canvas = null;
/** @type {CanvasRenderingContext2D | null} */
let ctx = null;
/** @type {HTMLAudioElement | null} */
let startMusic = null;

let particles = [];
let meteors = [];
let deepStars = [];
let brightStars = [];
let galaxyArmDots = [];
let rafId = 0;
let enabled = true;
let canvasActive = false;
let width = 0;
let height = 0;
let sceneAlpha = 0;
let floatT = 0;
let meteorCooldown = 0;
let introRunning = false;
let introClockStart = 0;
let introAudioSynced = false;
let reducedMotion = false;

const INTRO = {
  curtainEnd: 0.35,
  bgEnd: 0.85,
  circuitsEnd: 1.55,
  sceneBegin: 1.7,
  sceneRamp: 0.65,
  titleAt: 5.0,
  charStep: 0.1,
  tagAt: 5.75,
  subtitleCodeAt: 6.05,
  subtitleNameAt: 6.28,
  btnStartAt: 6.55,
  btnContinueAt: 6.78,
  btnLogAt: 6.95,
  btnSettingsAt: 7.12,
  footerAt: 7.28
};

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function seeded(seed) {
  const x = Math.sin(seed * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function spawnParticle() {
  const cyan = Math.random() > 0.38;
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    vx: rand(-0.14, 0.14),
    vy: rand(-0.32, -0.05),
    r: rand(0.35, cyan ? 1.6 : 1.1),
    phase: Math.random() * Math.PI * 2,
    twinkle: rand(0.01, 0.025),
    alpha: rand(0.15, 0.7),
    hue: cyan ? '180' : '270'
  };
}

function buildDeepSky() {
  deepStars = [];
  for (let i = 0; i < 420; i++) {
    deepStars.push({
      x: seeded(i * 1.7) * width,
      y: seeded(i * 2.3) * height,
      r: rand(0.3, 1.25),
      a: rand(0.12, 0.65),
      ph: seeded(i * 4.1) * Math.PI * 2
    });
  }

  brightStars = [];
  for (let i = 0; i < 26; i++) {
    brightStars.push({
      x: seeded(i * 9.2) * width,
      y: seeded(i * 6.5) * height,
      r: rand(1.3, 2.8),
      a: rand(0.65, 1),
      ph: seeded(i * 3.3) * Math.PI * 2,
      spikes: seeded(i * 1.1) > 0.25
    });
  }

  galaxyArmDots = [];
  const gx = width * 0.38;
  const gy = height * 0.34;
  for (let i = 0; i < 240; i++) {
    const arm = i % 2;
    const t = seeded(i * 2.7) * Math.PI * 4;
    const dist = seeded(i * 5.1) * Math.min(width, height) * 0.26;
    const spread = seeded(i * 8.3) * 32 - 16;
    const ang = t + arm * Math.PI + 0.35;
    galaxyArmDots.push({
      x: gx + Math.cos(ang) * dist + spread * 0.3,
      y: gy + Math.sin(ang) * dist * 0.55 + spread * 0.2,
      r: rand(0.45, 2.2),
      a: rand(0.15, 0.62)
    });
  }
}

function resize() {
  if (!canvas) return;
  width = window.innerWidth;
  height = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const count = Math.min(130, Math.floor((width * height) / 9000));
  particles = Array.from({ length: count }, spawnParticle);
  buildDeepSky();
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

function setSceneVisualAlpha(a) {
  sceneAlpha = a;
  document.documentElement.style.setProperty('--start-scene-alpha', String(a));
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

function spawnMeteor() {
  const angle = rand(0.7, 0.9) * Math.PI;
  const speed = rand(8, 14);
  meteors.push({
    x: rand(-width * 0.05, width * 0.55),
    y: rand(-100, height * 0.42),
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    len: rand(80, 160),
    life: 0,
    maxLife: rand(65, 110),
    core: rand(1.2, 2.2)
  });
}

function drawGlowDot(x, y, r, alpha) {
  ctx.beginPath();
  ctx.arc(x, y, r * 2.5, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.14})`;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
  ctx.fill();
}

function drawStarSpikes(x, y, r, alpha) {
  const len = r * 6;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 0.75;
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(a) * len, y - Math.sin(a) * len);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  ctx.restore();
}

/** 星空远景：星场、亮星芒、星系光斑 */
function drawDeepSky(t, layerA) {
  if (layerA < 0.03) return;

  ctx.save();
  const gx = width * 0.36;
  const gy = height * 0.33;

  for (const st of deepStars) {
    const tw = 0.5 + Math.sin(t * 1.6 + st.ph) * 0.5;
    ctx.globalAlpha = st.a * tw * layerA;
    ctx.beginPath();
    ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }

  ctx.globalAlpha = layerA * 0.22;
  const coreGrad = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.min(width, height) * 0.32);
  coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
  coreGrad.addColorStop(0.35, 'rgba(210, 225, 255, 0.12)');
  coreGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = coreGrad;
  ctx.fillRect(0, 0, width, height);

  for (const d of galaxyArmDots) {
    ctx.globalAlpha = d.a * layerA * 0.85;
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fill();
  }

  for (let arm = 0; arm < 2; arm++) {
    ctx.globalAlpha = layerA * 0.28;
    ctx.beginPath();
    for (let i = 0; i <= 28; i++) {
      const ang = arm * Math.PI + 0.45 + (i / 28) * 2.4;
      const dist = (i / 28) * Math.min(width, height) * 0.3;
      const px = gx + Math.cos(ang) * dist;
      const py = gy + Math.sin(ang) * dist * 0.52;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  const smudges = [
    [0.76, 0.14, 0.055], [0.86, 0.24, 0.04], [0.22, 0.16, 0.045], [0.58, 0.08, 0.035]
  ];
  for (const [nx, ny, nr] of smudges) {
    const sx = width * nx;
    const sy = height * ny;
    const rr = Math.min(width, height) * nr;
    ctx.globalAlpha = layerA * 0.14;
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, rr);
    g.addColorStop(0, 'rgba(255,255,255,0.4)');
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(sx, sy, rr, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const st of brightStars) {
    const tw = 0.55 + Math.sin(t * 2.2 + st.ph) * 0.45;
    const a = st.a * tw * layerA;
    drawGlowDot(st.x, st.y, st.r, a);
    if (st.spikes) drawStarSpikes(st.x, st.y, st.r, a * 0.55);
  }

  ctx.restore();
}

function drawMeteors(dt, layerA) {
  if (layerA > 0.2) {
    meteorCooldown -= dt;
    if (meteorCooldown <= 0) {
      spawnMeteor();
      if (Math.random() > 0.55) spawnMeteor();
      meteorCooldown = rand(1400, 2800);
    }
  }

  for (let i = meteors.length - 1; i >= 0; i--) {
    const m = meteors[i];
    m.life++;
    m.x += m.vx;
    m.y += m.vy;
    if (m.life > m.maxLife || m.x > width + 120 || m.y > height + 120) {
      meteors.splice(i, 1);
      continue;
    }
    const fade = 1 - m.life / m.maxLife;
    const spd = Math.hypot(m.vx, m.vy) || 1;
    const tailX = m.x - (m.vx / spd) * m.len;
    const tailY = m.y - (m.vy / spd) * m.len;

    ctx.save();
    ctx.globalAlpha = layerA * fade * 0.92;
    const grad = ctx.createLinearGradient(tailX, tailY, m.x, m.y);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
    grad.addColorStop(0.4, 'rgba(200, 230, 255, 0.3)');
    grad.addColorStop(0.8, 'rgba(0, 240, 255, 0.55)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 1)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = m.core;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(m.x, m.y);
    ctx.stroke();
    drawGlowDot(m.x, m.y, m.core, layerA * fade * 0.9);
    ctx.restore();
  }
}

let lastFrame = 0;

function tick(now) {
  if (!canvasActive || !ctx) {
    rafId = 0;
    return;
  }

  const dt = lastFrame ? now - lastFrame : 16;
  lastFrame = now;
  floatT += 0.014;

  if (introRunning) {
    applyIntroTime(getIntroTime());
  }

  const skyA =
    sceneAlpha > 0.01
      ? sceneAlpha
      : document.body.classList.contains('intro-circuits')
        ? 0.22
        : document.body.classList.contains('intro-bg')
          ? 0.08
          : 0;

  ctx.clearRect(0, 0, width, height);

  drawDeepSky(floatT, skyA);
  drawMeteors(dt, Math.max(skyA, sceneAlpha * 0.85));

  if (enabled) {
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.phase += p.twinkle;
      const flicker = 0.5 + Math.sin(p.phase) * 0.5;
      if (p.y < -8 || p.x < -8 || p.x > width + 8) {
        p.x = Math.random() * width;
        p.y = height + rand(0, 30);
      }
      const a = p.alpha * flicker * Math.max(0.35, skyA);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, 90%, 72%, ${a})`;
      ctx.fill();
      if (p.r > 1 && flicker > 0.65) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 90%, 70%, ${a * 0.12})`;
        ctx.fill();
      }
    }
  }

  rafId = requestAnimationFrame(tick);
}

function setBodyIntroClass(cls) {
  document.body.classList.remove(
    'intro-black',
    'intro-bg',
    'intro-circuits',
    'intro-scene',
    'intro-ui'
  );
  if (cls) document.body.classList.add(cls);
}

function revealElement(sel, visible) {
  const el = document.querySelector(sel);
  if (!el || el.classList.contains('hidden')) return;
  el.classList.toggle('start-revealed', visible);
}

function revealTitleChars(t) {
  document.querySelectorAll('#title-main .title-char').forEach((el, i) => {
    el.classList.toggle('title-char-revealed', t >= INTRO.titleAt + i * INTRO.charStep);
  });
}

function applyIntroTime(t) {
  const curtain = document.getElementById('start-intro-curtain');
  if (curtain) {
    if (t < INTRO.curtainEnd) {
      curtain.style.opacity = '1';
      curtain.classList.remove('hidden');
    } else if (t < INTRO.bgEnd) {
      const p = (t - INTRO.curtainEnd) / (INTRO.bgEnd - INTRO.curtainEnd);
      curtain.style.opacity = String(1 - p);
    } else {
      curtain.style.opacity = '0';
      curtain.classList.add('hidden');
    }
  }

  if (t < INTRO.curtainEnd) setBodyIntroClass('intro-black');
  else if (t < INTRO.bgEnd) setBodyIntroClass('intro-bg');
  else if (t < INTRO.circuitsEnd) setBodyIntroClass('intro-circuits');
  else if (t < INTRO.titleAt) setBodyIntroClass('intro-scene');
  else setBodyIntroClass('intro-ui');

  const a =
    t >= INTRO.sceneBegin ? Math.min(1, (t - INTRO.sceneBegin) / INTRO.sceneRamp) : 0;
  setSceneVisualAlpha(a);

  revealTitleChars(t);
  revealElement('#screen-start .start-tag', t >= INTRO.tagAt);
  revealElement('#screen-start .sub-code', t >= INTRO.subtitleCodeAt);
  revealElement('#screen-start .sub-name', t >= INTRO.subtitleNameAt);
  revealElement('#btn-start', t >= INTRO.btnStartAt);
  revealElement('#btn-continue', t >= INTRO.btnContinueAt);
  revealElement('#btn-open-log', t >= INTRO.btnLogAt);
  revealElement('#btn-open-settings', t >= INTRO.btnSettingsAt);
  revealElement('#screen-start .start-footer', t >= INTRO.footerAt);
}

function finishIntroInstant() {
  const curtain = document.getElementById('start-intro-curtain');
  if (curtain) {
    curtain.style.opacity = '0';
    curtain.classList.add('hidden');
  }
  setBodyIntroClass('intro-ui');
  setSceneVisualAlpha(1);
  hideUnlockHint();
  document.querySelectorAll('#title-main .title-char').forEach((el) => {
    el.classList.add('title-char-revealed');
  });
  document.querySelectorAll('#screen-start .start-reveal-item, #screen-start .sub-part').forEach((el) => {
    if (!el.classList.contains('hidden')) el.classList.add('start-revealed');
  });
}

export function setupTitleChars(titleEl, text) {
  if (!titleEl) return;
  titleEl.textContent = '';
  for (const ch of text) {
    const span = document.createElement('span');
    span.className = 'title-char';
    span.textContent = ch;
    titleEl.appendChild(span);
  }
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
  setSceneVisualAlpha(0);
  if (!rafId) rafId = requestAnimationFrame(tick);
}

export async function playStartIntro() {
  if (!startMusic) return;

  document.querySelectorAll('#screen-start .start-reveal-item').forEach((el) => {
    el.classList.remove('start-revealed');
  });
  document.querySelectorAll('#title-main .title-char').forEach((el) => {
    el.classList.remove('title-char-revealed');
  });

  setSceneVisualAlpha(0);
  meteors = [];
  meteorCooldown = rand(600, 1200);
  introClockStart = performance.now();
  introAudioSynced = false;
  introRunning = true;

  document.body.classList.add('start-intro-active');
  setStartCanvasActive(true);

  const curtain = document.getElementById('start-intro-curtain');
  if (curtain) {
    curtain.classList.remove('hidden');
    curtain.style.opacity = '1';
  }

  hideUnlockHint();
  applyIntroTime(0);

  if (reducedMotion) {
    finishIntroInstant();
    await tryPlayMusic();
    return;
  }

  startMusic.currentTime = 0;
  const played = await tryPlayMusic();
  if (!played) showUnlockHint();
}

export function pauseStartMusic() {
  introRunning = false;
  if (startMusic) startMusic.pause();
}

export function setStartMusicVolume(v) {
  if (startMusic) startMusic.volume = Math.max(0, Math.min(1, v));
}

export function setParticlesEnabled(on) {
  enabled = !!on;
  if (canvas) canvas.classList.toggle('disabled', !enabled);
}
