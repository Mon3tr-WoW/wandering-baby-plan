/**
 * 开始界面：Canvas 星尘 + 宇宙场景（飞船 / 星球 / 流星）+ 入场时间轴
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
let width = 0;
let height = 0;
let sceneAlpha = 0;
let floatT = 0;
let meteorCooldown = 0;
let introRunning = false;
let reducedMotion = false;

const INTRO = {
  curtainEnd: 0.85,
  bgEnd: 2.0,
  circuitsEnd: 3.4,
  sceneBegin: 3.6,
  titleAt: 8.0,
  tagAt: 8.55,
  subtitleAt: 9.1,
  btnStartAt: 9.65,
  btnContinueAt: 10.15,
  btnLogAt: 10.55,
  btnSettingsAt: 10.95,
  footerAt: 11.35
};

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function spawnParticle() {
  const cyan = Math.random() > 0.35;
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    vx: rand(-0.15, 0.15),
    vy: rand(-0.35, -0.05),
    r: rand(0.4, cyan ? 1.8 : 1.2),
    phase: Math.random() * Math.PI * 2,
    twinkle: rand(0.008, 0.022),
    alpha: rand(0.15, 0.75),
    hue: cyan ? '180' : '270'
  };
}

function resize() {
  if (!canvas) return;
  width = window.innerWidth;
  height = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const count = Math.min(140, Math.floor((width * height) / 9000));
  particles = Array.from({ length: count }, spawnParticle);
}

function spawnMeteor() {
  const angle = rand(0.72, 0.88) * Math.PI;
  const speed = rand(6, 11);
  const len = rand(70, 140);
  const startX = rand(-width * 0.15, width * 0.55);
  const startY = rand(-80, height * 0.45);
  meteors.push({
    x: startX,
    y: startY,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    len,
    life: 0,
    maxLife: rand(90, 150),
    core: rand(1.2, 2.2)
  });
}

function drawGlowDot(x, y, r, alpha = 1) {
  ctx.beginPath();
  ctx.arc(x, y, r * 3.2, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.08})`;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
  ctx.fill();
}

function drawGlowLine(x1, y1, x2, y2, alpha = 1) {
  ctx.save();
  ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.85})`;
  ctx.lineWidth = 1;
  ctx.shadowColor = 'rgba(255, 255, 255, 0.9)';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

/** 左下科技感线框飞船 */
function drawSpaceship(ox, oy, scale, phase) {
  const bobX = Math.sin(phase) * 5 * scale;
  const bobY = Math.cos(phase * 0.73) * 7 * scale;
  const s = scale;
  const cx = ox + bobX;
  const cy = oy + bobY;

  const hull = [
    [0, 0], [42, -8], [118, -4], [148, 0], [118, 6], [42, 10], [0, 4], [-18, 0]
  ].map(([x, y]) => [cx + x * s, cy + y * s]);

  const wingL = [
    [28, 2], [52, 28], [78, 22], [48, 6]
  ].map(([x, y]) => [cx + x * s, cy + y * s]);

  const wingR = [
    [28, -2], [52, -28], [78, -22], [48, -6]
  ].map(([x, y]) => [cx + x * s, cy + y * s]);

  const bridge = [
    [62, -6], [62, 6], [88, 4], [88, -4]
  ].map(([x, y]) => [cx + x * s, cy + y * s]);

  const engine = [
    [-22, -10], [-22, 10], [-8, 6], [-8, -6]
  ].map(([x, y]) => [cx + x * s, cy + y * s]);

  const rings = [
    [95, 0, 18], [112, 0, 10]
  ];

  const lineSets = [hull, wingL, wingR, bridge, engine];
  for (const pts of lineSets) {
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      drawGlowLine(a[0], a[1], b[0], b[1], sceneAlpha);
    }
  }

  for (let i = 0; i < hull.length - 1; i++) {
    if (i % 3 === 0) {
      const p = hull[i];
      drawGlowDot(p[0], p[1], 1.1 * s, sceneAlpha * 0.9);
    }
  }

  for (const [x, y] of [
    [cx + 118 * s, cy],
    [cx + 42 * s, cy - 8 * s],
    [cx + 42 * s, cy + 10 * s],
    [cx - 14 * s, cy - 7 * s],
    [cx - 14 * s, cy + 7 * s],
    [cx + 70 * s, cy],
    [cx + 52 * s, cy + 22 * s],
    [cx + 52 * s, cy - 28 * s]
  ]) {
    drawGlowDot(x, y, rand(0.8, 1.3) * s, sceneAlpha * rand(0.55, 1));
  }

  for (const [rx, ry, rr] of rings) {
    ctx.save();
    ctx.strokeStyle = `rgba(255, 255, 255, ${sceneAlpha * 0.35})`;
    ctx.lineWidth = 0.8;
    ctx.shadowBlur = 6;
    ctx.shadowColor = 'rgba(200, 230, 255, 0.5)';
    ctx.beginPath();
    ctx.ellipse(cx + rx * s, cy + ry * s, rr * s, rr * s * 0.35, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  const thrust = 0.5 + Math.sin(phase * 2.2) * 0.5;
  ctx.save();
  ctx.globalAlpha = sceneAlpha * thrust * 0.7;
  const ex = cx - 28 * s;
  const grad = ctx.createLinearGradient(ex - 40 * s, cy, ex, cy);
  grad.addColorStop(0, 'rgba(0, 240, 255, 0)');
  grad.addColorStop(0.5, 'rgba(0, 240, 255, 0.35)');
  grad.addColorStop(1, 'rgba(157, 78, 221, 0.55)');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.moveTo(ex, cy - 4 * s);
  ctx.lineTo(ex - 36 * s, cy);
  ctx.lineTo(ex, cy + 4 * s);
  ctx.stroke();
  ctx.restore();

  if (sceneAlpha > 0.5) {
    ctx.save();
    ctx.globalAlpha = sceneAlpha * 0.45;
    ctx.font = `${10 * s}px "Share Tech Mono", monospace`;
    ctx.fillStyle = 'rgba(0, 240, 255, 0.55)';
    ctx.fillText('ARK-01 · 方舟号', cx + 8 * s, cy + 38 * s);
    ctx.restore();
  }
}

/** 右上星球与星群 */
function drawCelestial(t) {
  const planets = [
    { x: 0.78, y: 0.14, r: 38, hue: [280, 55, 62], ring: true, float: 0 },
    { x: 0.9, y: 0.22, r: 14, hue: [195, 80, 58], ring: false, float: 1.2 },
    { x: 0.68, y: 0.2, r: 22, hue: [32, 75, 55], ring: false, float: 2.1 },
    { x: 0.84, y: 0.34, r: 9, hue: [200, 40, 70], ring: false, float: 0.8 }
  ];

  for (const p of planets) {
    const fx = Math.sin(t + p.float) * 6;
    const fy = Math.cos(t * 0.85 + p.float) * 5;
    const px = width * p.x + fx;
    const py = height * p.y + fy;
    const [h, sat, lit] = p.hue;

    ctx.save();
    ctx.globalAlpha = sceneAlpha;

    const glow = ctx.createRadialGradient(px, py, p.r * 0.2, px, py, p.r * 2.2);
    glow.addColorStop(0, `hsla(${h}, ${sat}%, ${lit}%, 0.45)`);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(px, py, p.r * 2.2, 0, Math.PI * 2);
    ctx.fill();

    const body = ctx.createRadialGradient(px - p.r * 0.3, py - p.r * 0.3, 0, px, py, p.r);
    body.addColorStop(0, `hsla(${h}, ${sat}%, ${Math.min(lit + 22, 92)}%, 0.95)`);
    body.addColorStop(0.55, `hsla(${h}, ${sat}%, ${lit}%, 0.85)`);
    body.addColorStop(1, `hsla(${h}, ${sat * 0.7}%, ${lit * 0.45}%, 0.2)`);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(px, py, p.r, 0, Math.PI * 2);
    ctx.fill();

    if (p.ring) {
      ctx.strokeStyle = `hsla(${h}, 50%, 78%, 0.55)`;
      ctx.lineWidth = 1.2;
      ctx.shadowBlur = 10;
      ctx.shadowColor = `hsla(${h}, 80%, 70%, 0.4)`;
      ctx.beginPath();
      ctx.ellipse(px, py, p.r * 1.55, p.r * 0.42, -0.35, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  const clusters = [
    { cx: 0.72, cy: 0.08, n: 28, spread: 55 },
    { cx: 0.93, cy: 0.12, n: 18, spread: 38 },
    { cx: 0.62, cy: 0.1, n: 14, spread: 42 }
  ];

  for (const c of clusters) {
    const baseX = width * c.cx + Math.sin(t * 0.6) * 4;
    const baseY = height * c.cy + Math.cos(t * 0.5) * 3;
    for (let i = 0; i < c.n; i++) {
      const seed = i * 17.3 + c.cx * 100;
      const sx = baseX + Math.sin(seed) * c.spread * 0.5;
      const sy = baseY + Math.cos(seed * 1.3) * c.spread * 0.35;
      const tw = 0.4 + Math.sin(t * 2 + seed) * 0.35;
      const tint = i % 3 === 0 ? 'rgba(0, 240, 255,' : i % 3 === 1 ? 'rgba(255, 255, 255,' : 'rgba(157, 78, 221,';
      ctx.beginPath();
      ctx.arc(sx, sy, rand(0.5, 1.4), 0, Math.PI * 2);
      ctx.fillStyle = `${tint} ${sceneAlpha * tw * 0.75})`;
      ctx.fill();
    }
  }
}

function drawMeteors(dt) {
  if (sceneAlpha > 0.4) {
    meteorCooldown -= dt;
    if (meteorCooldown <= 0) {
      spawnMeteor();
      meteorCooldown = rand(2800, 5200);
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
    const tailX = m.x - (m.vx / Math.hypot(m.vx, m.vy)) * m.len;
    const tailY = m.y - (m.vy / Math.hypot(m.vx, m.vy)) * m.len;

    ctx.save();
    ctx.globalAlpha = sceneAlpha * fade * 0.9;
    const grad = ctx.createLinearGradient(tailX, tailY, m.x, m.y);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
    grad.addColorStop(0.35, 'rgba(200, 230, 255, 0.25)');
    grad.addColorStop(0.75, 'rgba(0, 240, 255, 0.65)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0.95)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = m.core;
    ctx.lineCap = 'round';
    ctx.shadowBlur = 14;
    ctx.shadowColor = 'rgba(0, 240, 255, 0.8)';
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(m.x, m.y);
    ctx.stroke();
    drawGlowDot(m.x, m.y, m.core * 0.9, fade);
    ctx.restore();
  }
}

let lastFrame = 0;

function tick(now) {
  if (!ctx) {
    rafId = requestAnimationFrame(tick);
    return;
  }

  const dt = lastFrame ? now - lastFrame : 16;
  lastFrame = now;
  floatT += 0.012;

  ctx.clearRect(0, 0, width, height);

  if (enabled) {
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.phase += p.twinkle;
      const flicker = 0.45 + Math.sin(p.phase) * 0.55;

      if (p.y < -8 || p.x < -8 || p.x > width + 8) {
        p.x = Math.random() * width;
        p.y = height + rand(0, 40);
      }

      const a = p.alpha * flicker;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, 100%, ${p.hue === '180' ? '72%' : '68%'}, ${a})`;
      ctx.fill();

      if (p.r > 1.1 && flicker > 0.75) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 100%, 70%, ${a * 0.12})`;
        ctx.fill();
      }
    }
  }

  if (sceneAlpha > 0.01) {
    const shipScale = Math.min(width, height) / 900;
    const shipX = width * 0.06;
    const shipY = height * 0.72;
    drawCelestial(floatT);
    drawSpaceship(shipX, shipY, shipScale, floatT);
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

function applyIntroTime(t) {
  const curtain = document.getElementById('start-intro-curtain');
  if (curtain) {
    if (t < INTRO.curtainEnd) {
      curtain.style.opacity = '1';
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

  if (t >= INTRO.sceneBegin) {
    const ramp = Math.min(1, (t - INTRO.sceneBegin) / 1.4);
    sceneAlpha = ramp;
  } else {
    sceneAlpha = 0;
  }

  revealElement('#screen-start .title-glow', t >= INTRO.titleAt);
  revealElement('#screen-start .start-tag', t >= INTRO.tagAt);
  revealElement('#screen-start .subtitle', t >= INTRO.subtitleAt);
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
  document.querySelectorAll('#screen-start .start-reveal-item').forEach((el) => {
    if (!el.classList.contains('hidden')) el.classList.add('start-revealed');
  });
}

function syncIntroLoop() {
  if (!introRunning) return;
  const t = startMusic?.currentTime ?? 0;
  applyIntroTime(t);
  requestAnimationFrame(syncIntroLoop);
}

export function initStartFx(targetCanvas, audioEl) {
  canvas = targetCanvas;
  startMusic = audioEl ?? null;
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!canvas) return;
  ctx = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
  if (!rafId) rafId = requestAnimationFrame(tick);
}

export async function playStartIntro() {
  if (!startMusic) return;

  document.querySelectorAll('#screen-start .start-reveal-item').forEach((el) => {
    el.classList.remove('start-revealed');
  });
  sceneAlpha = 0;
  meteors = [];
  meteorCooldown = rand(1200, 2400);

  introRunning = true;
  document.body.classList.add('start-intro-active');

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
  syncIntroLoop();

  startMusic.loop = true;
  startMusic.currentTime = 0;

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
  if (startMusic) {
    startMusic.pause();
  }
}

export function resumeStartMusic() {
  if (!startMusic || reducedMotion) return;
  introRunning = true;
  syncIntroLoop();
  startMusic.play().catch(() => {});
}

export function setStartMusicVolume(v) {
  if (startMusic) startMusic.volume = Math.max(0, Math.min(1, v));
}

export function setParticlesEnabled(on) {
  enabled = !!on;
  if (canvas) {
    canvas.classList.toggle('disabled', !enabled);
  }
}
