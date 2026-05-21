/**
 * 开始界面：Canvas 场景 + 入场时间轴（与音乐同步）
 */

/** @type {HTMLCanvasElement | null} */
let canvas = null;
/** @type {CanvasRenderingContext2D | null} */
let ctx = null;
/** @type {HTMLAudioElement | null} */
let startMusic = null;

let particles = [];
let meteors = [];
let rafId = 0;
let enabled = true;
let canvasActive = false;
let width = 0;
let height = 0;
let sceneAlpha = 0;
let floatT = 0;
let meteorCooldown = 0;
let introRunning = false;
let reducedMotion = false;
let shipDots = [];

const SHIP_DESIGN_W = 240;

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

function spawnParticle() {
  const cyan = Math.random() > 0.4;
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    vx: rand(-0.12, 0.12),
    vy: rand(-0.28, -0.06),
    r: rand(0.35, cyan ? 1.4 : 1),
    phase: Math.random() * Math.PI * 2,
    twinkle: rand(0.01, 0.02),
    alpha: rand(0.12, 0.6),
    hue: cyan ? '180' : '270'
  };
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

  const count = Math.min(72, Math.floor((width * height) / 14000));
  particles = Array.from({ length: count }, spawnParticle);
  buildShipDots();
}

function buildShipDots() {
  shipDots = [
    [118, 0], [148, 0], [42, -8], [42, 10], [70, -6], [70, 6], [88, -4], [88, 4],
    [28, 2], [52, 28], [78, 22], [28, -2], [52, -28], [78, -22], [0, 0], [-14, -7],
    [-14, 7], [-8, -6], [-8, 6], [62, 0], [95, 0], [112, 0], [135, -12], [135, 12],
    [168, -8], [168, 8], [185, -4], [185, 4], [200, 0], [55, 18], [55, -18], [30, 0]
  ];
}

function spawnMeteor() {
  const angle = rand(0.72, 0.88) * Math.PI;
  const speed = rand(7, 12);
  meteors.push({
    x: rand(-width * 0.1, width * 0.5),
    y: rand(-60, height * 0.4),
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    len: rand(60, 120),
    life: 0,
    maxLife: rand(70, 120),
    core: rand(1, 1.8)
  });
}

function drawGlowDot(x, y, r, alpha = 1) {
  const a = alpha * sceneAlpha;
  if (a < 0.02) return;
  ctx.beginPath();
  ctx.arc(x, y, r * 2, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 255, 255, ${a * 0.12})`;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 255, 255, ${a * 0.92})`;
  ctx.fill();
}

function drawGlowLine(x1, y1, x2, y2, alpha = 1, lw = 1) {
  const a = alpha * sceneAlpha;
  if (a < 0.02) return;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = `rgba(255, 255, 255, ${a * 0.22})`;
  ctx.lineWidth = lw * 2.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = `rgba(255, 255, 255, ${a * 0.88})`;
  ctx.lineWidth = lw;
  ctx.stroke();
}

function drawPolyline(points, closed, alpha, lw = 1) {
  for (let i = 0; i < points.length - 1; i++) {
    drawGlowLine(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], alpha, lw);
  }
  if (closed && points.length > 2) {
    const a = points[0];
    const b = points[points.length - 1];
    drawGlowLine(a[0], a[1], b[0], b[1], alpha, lw);
  }
}

function tx(x, y, cx, cy, s) {
  return [cx + x * s, cy + y * s];
}

/** 左下大型线框飞船（设计宽约页面 1/3） */
function drawSpaceship(ox, oy, phase) {
  const targetW = width * 0.33;
  const s = targetW / SHIP_DESIGN_W;
  const bobX = Math.sin(phase) * 4 * s;
  const bobY = Math.cos(phase * 0.73) * 5 * s;
  const cx = ox + bobX;
  const cy = oy + bobY;
  const T = (x, y) => tx(x, y, cx, cy, s);

  const hull = [
    [0, 0], [18, -3], [48, -10], [88, -12], [128, -10], [168, -6], [200, -2],
    [218, 0], [200, 2], [168, 6], [128, 10], [88, 12], [48, 10], [18, 3]
  ].map(([x, y]) => T(x, y));

  const deck = [
    [52, -4], [52, 4], [98, 3], [98, -3], [142, -2], [142, 2]
  ].map(([x, y]) => T(x, y));

  const bridge = [
    [108, -14], [108, 14], [132, 10], [132, -10], [118, 0]
  ].map(([x, y]) => T(x, y));

  const wingU = [
    [38, 6], [62, 42], [108, 32], [142, 18], [118, 8], [72, 14], [48, 8]
  ].map(([x, y]) => T(x, y));

  const wingD = [
    [38, -6], [62, -42], [108, -32], [142, -18], [118, -8], [72, -14], [48, -8]
  ].map(([x, y]) => T(x, y));

  const finU = [
    [155, 10], [175, 38], [195, 28], [178, 12]
  ].map(([x, y]) => T(x, y));

  const finD = [
    [155, -10], [175, -38], [195, -28], [178, -12]
  ].map(([x, y]) => T(x, y));

  const engine = [
    [-8, -16], [-8, 16], [-28, 20], [-28, -20], [-42, 14], [-42, -14]
  ].map(([x, y]) => T(x, y));

  const trussLines = [
    [[72, -8], [72, 8]], [[72, -8], [128, -6]], [[128, -6], [128, 6]],
    [[48, 0], [168, 0]], [[88, -12], [88, 12]], [[142, -10], [142, 10]],
    [[98, 0], [142, 0]], [[62, 0], [108, 0]]
  ];
  for (const [[x1, y1], [x2, y2]] of trussLines) {
    const a = T(x1, y1);
    const b = T(x2, y2);
    drawGlowLine(a[0], a[1], b[0], b[1], 0.55, 0.7);
  }

  drawPolyline(hull, true, 1, 1.1);
  drawPolyline(deck, true, 0.75, 0.8);
  drawPolyline(bridge, true, 0.85, 0.9);
  drawPolyline(wingU, true, 0.8, 0.85);
  drawPolyline(wingD, true, 0.8, 0.85);
  drawPolyline(finU, true, 0.65, 0.75);
  drawPolyline(finD, true, 0.65, 0.75);
  drawPolyline(engine, true, 0.9, 1);

  for (const [rx, ry, rw, rh] of [
    [95, 0, 22, 7], [138, 0, 14, 5]
  ]) {
    const p = T(rx, ry);
    ctx.save();
    ctx.globalAlpha = sceneAlpha * 0.4;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(p[0], p[1], rw * s, rh * s, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  for (const [dx, dy] of shipDots) {
    const p = T(dx, dy);
    drawGlowDot(p[0], p[1], 1.15 * s, 0.85);
  }

  const thrust = 0.45 + Math.sin(phase * 2.2) * 0.45;
  const ex = T(-42, 0);
  ctx.save();
  ctx.globalAlpha = sceneAlpha * thrust * 0.65;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.moveTo(ex[0], ex[1] - 10 * s);
  ctx.lineTo(ex[0] - 52 * s, ex[1]);
  ctx.lineTo(ex[0], ex[1] + 10 * s);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ex[0] - 18 * s, ex[1] - 6 * s);
  ctx.lineTo(ex[0] - 44 * s, ex[1]);
  ctx.lineTo(ex[0] - 18 * s, ex[1] + 6 * s);
  ctx.stroke();
  ctx.restore();

  if (sceneAlpha > 0.45) {
    ctx.save();
    ctx.globalAlpha = sceneAlpha * 0.4;
    ctx.font = `${11 * s}px "Share Tech Mono", monospace`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillText('ARK-01 · 方舟号', cx + 12 * s, cy + 52 * s);
    ctx.restore();
  }
}

/** 右上：白色线框星球（无星群） */
const PLANETS = [
  { x: 0.72, y: 0.1, r: 42, ring: true, tilt: -0.32, float: 0 },
  { x: 0.88, y: 0.18, r: 24, ring: false, tilt: 0.1, float: 1.1 },
  { x: 0.62, y: 0.2, r: 18, ring: false, tilt: 0.2, float: 2 },
  { x: 0.8, y: 0.32, r: 14, ring: false, tilt: -0.15, float: 0.7 },
  { x: 0.93, y: 0.08, r: 10, ring: false, tilt: 0, float: 1.8 },
  { x: 0.55, y: 0.12, r: 12, ring: true, tilt: 0.45, float: 2.4 }
];

function drawWirePlanet(px, py, r, ring, tilt, t) {
  const a = sceneAlpha;
  if (a < 0.02) return;

  ctx.save();
  ctx.globalAlpha = a;

  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.lineWidth = 1.1;
  ctx.stroke();

  for (let i = -2; i <= 2; i++) {
    const lat = i * 0.28;
    const ry = r * Math.cos(lat * Math.PI * 0.5) * 0.85;
    ctx.beginPath();
    ctx.ellipse(px, py + lat * r * 0.55, r * 0.98, Math.max(ry, 2), 0, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.22 + Math.abs(i) * 0.08})`;
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }

  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI + tilt;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + Math.cos(ang) * r, py + Math.sin(ang) * r * 0.92);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }

  if (ring) {
    ctx.beginPath();
    ctx.ellipse(px, py, r * 1.65, r * 0.38, tilt * 1.2, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 0.9;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(px, py, r * 1.45, r * 0.32, tilt * 1.2, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  const pulse = 0.6 + Math.sin(t * 3 + px) * 0.4;
  drawGlowDot(px, py - r * 0.35, 1.4, pulse * 0.7);
  drawGlowDot(px + r * 0.55, py + r * 0.2, 1, 0.55);
  drawGlowDot(px - r * 0.4, py, 0.9, 0.45);
  if (r > 20) {
    drawGlowDot(px, py + r * 0.5, 1.1, 0.4);
    drawGlowDot(px - r * 0.6, py - r * 0.3, 0.8, 0.35);
  }

  ctx.restore();
}

function drawCelestial(t) {
  for (const p of PLANETS) {
    const fx = Math.sin(t + p.float) * 5;
    const fy = Math.cos(t * 0.85 + p.float) * 4;
    drawWirePlanet(
      width * p.x + fx,
      height * p.y + fy,
      p.r,
      p.ring,
      p.tilt,
      t
    );
  }
}

function drawMeteors(dt) {
  if (sceneAlpha > 0.35) {
    meteorCooldown -= dt;
    if (meteorCooldown <= 0) {
      spawnMeteor();
      meteorCooldown = rand(2200, 4000);
    }
  }

  for (let i = meteors.length - 1; i >= 0; i--) {
    const m = meteors[i];
    m.life++;
    m.x += m.vx;
    m.y += m.vy;
    if (m.life > m.maxLife || m.x > width + 100 || m.y > height + 100) {
      meteors.splice(i, 1);
      continue;
    }

    const fade = 1 - m.life / m.maxLife;
    const spd = Math.hypot(m.vx, m.vy) || 1;
    const tailX = m.x - (m.vx / spd) * m.len;
    const tailY = m.y - (m.vy / spd) * m.len;
    const gAlpha = sceneAlpha * fade * 0.85;

    ctx.save();
    ctx.globalAlpha = gAlpha;
    const grad = ctx.createLinearGradient(tailX, tailY, m.x, m.y);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
    grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.35)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0.95)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = m.core;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(m.x, m.y);
    ctx.stroke();
    drawGlowDot(m.x, m.y, m.core * 0.85, fade);
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

  if (introRunning && startMusic) {
    applyIntroTime(startMusic.currentTime);
  }

  ctx.clearRect(0, 0, width, height);

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
      const a = p.alpha * flicker;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, 90%, 70%, ${a})`;
      ctx.fill();
    }
  }

  if (sceneAlpha > 0.01) {
    const shipX = width * 0.02;
    const shipY = height * 0.58;
    drawCelestial(floatT);
    drawSpaceship(shipX, shipY, floatT);
    drawMeteors(dt);
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
  const chars = document.querySelectorAll('#title-main .title-char');
  chars.forEach((el, i) => {
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

  sceneAlpha =
    t >= INTRO.sceneBegin
      ? Math.min(1, (t - INTRO.sceneBegin) / INTRO.sceneRamp)
      : 0;

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
  sceneAlpha = 1;
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
  canvasActive = true;
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
  sceneAlpha = 0;
  meteors = [];
  meteorCooldown = rand(800, 1600);

  introRunning = true;
  document.body.classList.add('start-intro-active');
  setStartCanvasActive(true);

  const curtain = document.getElementById('start-intro-curtain');
  if (curtain) {
    curtain.classList.remove('hidden');
    curtain.style.opacity = '1';
  }

  if (reducedMotion) {
    finishIntroInstant();
    try {
      startMusic.loop = true;
      startMusic.currentTime = 0;
      await startMusic.play();
    } catch {
      /* 需用户交互 */
    }
    return;
  }

  applyIntroTime(0);
  startMusic.loop = true;
  startMusic.currentTime = 0;
  startMusic.load();

  try {
    await startMusic.play();
  } catch {
    const unlock = () => {
      startMusic?.play().catch(() => {});
      document.removeEventListener('click', unlock);
      document.removeEventListener('keydown', unlock);
    };
    document.addEventListener('click', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
  }
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
