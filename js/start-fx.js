/**
 * 开始界面：全屏星空远景 + 参考图精灵 + 入场时间轴
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
  planetsRamp: 0.8,
  shipDelay: 0.15,
  shipRamp: 0.65,
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
  const count = Math.min(200, Math.floor((width * height) / 12000));
  for (let i = 0; i < count; i++) {
    deepStars.push({
      x: seeded(i * 1.91) * width,
      y: seeded(i * 2.47) * height,
      r: rand(0.45, 1.05),
      a: rand(0.25, 0.75),
      ph: seeded(i * 4.3) * Math.PI * 2
    });
  }

  brightStars = [];
  for (let i = 0; i < 22; i++) {
    brightStars.push({
      x: seeded(i * 9.7) * width,
      y: seeded(i * 6.9) * height,
      r: rand(1.6, 3.2),
      a: rand(0.75, 1),
      ph: seeded(i * 3.8) * Math.PI * 2,
      spikeLen: rand(10, 18),
      twSpeed: rand(2.8, 5.5)
    });
  }
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

function setSpriteAlphas(planetsA, shipA) {
  const p = Math.max(0, Math.min(1, planetsA));
  const s = Math.max(0, Math.min(1, shipA));
  sceneAlpha = Math.max(p, s);
  document.documentElement.style.setProperty('--start-planets-alpha', String(p));
  document.documentElement.style.setProperty('--start-ship-alpha', String(s));
}

function computeSpriteAlphas(t) {
  let planetsA = 0;
  let shipA = 0;
  if (t >= INTRO.sceneBegin) {
    planetsA = Math.min(1, (t - INTRO.sceneBegin) / INTRO.planetsRamp);
  }
  const shipStart = INTRO.sceneBegin + INTRO.planetsRamp + INTRO.shipDelay;
  if (t >= shipStart) {
    shipA = Math.min(1, (t - shipStart) / INTRO.shipRamp);
  }
  return { planetsA, shipA };
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
  const angle = rand(0.68, 0.92) * Math.PI;
  const speed = rand(9, 16);
  meteors.push({
    x: rand(0, width * 0.65),
    y: rand(-120, height * 0.45),
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    len: rand(100, 200),
    life: 0,
    maxLife: rand(55, 95),
    core: rand(2.8, 5.2)
  });
}

/** 锐利星点：小光晕 + 清晰核心 */
function drawSharpStar(x, y, r, alpha, layerA) {
  const a = alpha * layerA;
  if (a < 0.02) return;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.15, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 255, 255, ${a * 0.22})`;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
  ctx.fill();
}

function drawStarSpikes(x, y, r, len, alpha, layerA) {
  const a = alpha * layerA;
  if (a < 0.05) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
  ctx.lineWidth = 1.1;
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(ang) * len, y - Math.sin(ang) * len);
    ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.stroke();
  }
  ctx.restore();
}

/** 全画面均匀星野 + 分散远景光斑 */
function drawDeepSky(t, layerA) {
  if (layerA < 0.03) return;

  ctx.save();

  for (const st of deepStars) {
    const tw = 0.65 + Math.sin(t * 1.4 + st.ph) * 0.35;
    drawSharpStar(st.x, st.y, st.r, st.a * tw, layerA);
  }

  const smudges = [
    [0.18, 0.22, 0.028], [0.82, 0.18, 0.025], [0.72, 0.78, 0.022],
    [0.15, 0.72, 0.024], [0.5, 0.12, 0.02], [0.55, 0.88, 0.02]
  ];
  for (const [nx, ny, nr] of smudges) {
    const sx = width * nx;
    const sy = height * ny;
    const rr = Math.min(width, height) * nr;
    ctx.globalAlpha = layerA * 0.09;
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, rr);
    g.addColorStop(0, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(sx, sy, rr, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const st of brightStars) {
    const tw = 0.35 + Math.sin(t * st.twSpeed + st.ph) * 0.65;
    const flash = 0.5 + Math.pow(Math.max(0, Math.sin(t * st.twSpeed * 1.3 + st.ph * 2)), 3) * 0.5;
    const a = st.a * (0.55 + tw * 0.45) * flash;
    drawSharpStar(st.x, st.y, st.r, a, layerA);
    drawStarSpikes(st.x, st.y, st.r, st.spikeLen, a * 0.95, layerA);
  }

  ctx.restore();
}

function drawMeteors(dt, layerA) {
  if (layerA > 0.15) {
    meteorCooldown -= dt;
    if (meteorCooldown <= 0) {
      spawnMeteor();
      if (Math.random() > 0.35) spawnMeteor();
      if (Math.random() > 0.7) spawnMeteor();
      meteorCooldown = rand(700, 1400);
    }
  }

  for (let i = meteors.length - 1; i >= 0; i--) {
    const m = meteors[i];
    m.life++;
    m.x += m.vx;
    m.y += m.vy;
    if (m.life > m.maxLife || m.x > width + 150 || m.y > height + 150) {
      meteors.splice(i, 1);
      continue;
    }

    const fade = 1 - m.life / m.maxLife;
    const spd = Math.hypot(m.vx, m.vy) || 1;
    const tailX = m.x - (m.vx / spd) * m.len;
    const tailY = m.y - (m.vy / spd) * m.len;
    const a = layerA * fade;

    ctx.save();
    ctx.globalAlpha = a * 0.75;
    const grad = ctx.createLinearGradient(tailX, tailY, m.x, m.y);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
    grad.addColorStop(0.55, 'rgba(220, 240, 255, 0.55)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 1)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = Math.max(1.5, m.core * 0.45);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(m.x, m.y);
    ctx.stroke();

    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.core * 1.1, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.core * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 1)';
    ctx.fill();
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
        ? 0.2
        : document.body.classList.contains('intro-bg')
          ? 0.06
          : 0;

  ctx.clearRect(0, 0, width, height);
  drawDeepSky(floatT, skyA);
  drawMeteors(dt, Math.max(skyA, sceneAlpha * 0.9));

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
      drawSharpStar(p.x, p.y, p.r, a, 1);
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

  const { planetsA, shipA } = computeSpriteAlphas(t);
  setSpriteAlphas(planetsA, shipA);

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
  setSpriteAlphas(1, 1);
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
  setSpriteAlphas(0, 0);
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

  setSpriteAlphas(0, 0);
  meteors = [];
  meteorCooldown = rand(400, 900);
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
