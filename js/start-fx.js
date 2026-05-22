/**
 * 开始界面：深空远景 / 参考图线框飞船·星球 / 入场时间轴
 */
import { SHIP_W, SHIP_LINES, SHIP_DOTS, SHIP_RINGS } from './start-scene-data.js';

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

const SHIP_ANGLE = -0.32;
const SHIP_COS = Math.cos(SHIP_ANGLE);
const SHIP_SIN = Math.sin(SHIP_ANGLE);

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
  for (let i = 0; i < 320; i++) {
    deepStars.push({
      x: seeded(i * 1.7) * width,
      y: seeded(i * 2.3) * height,
      r: rand(0.25, 1.1),
      a: rand(0.08, 0.55),
      ph: seeded(i * 4.1) * Math.PI * 2
    });
  }

  brightStars = [];
  for (let i = 0; i < 14; i++) {
    brightStars.push({
      x: seeded(i * 9.2) * width,
      y: seeded(i * 6.5) * height,
      r: rand(1.2, 2.4),
      a: rand(0.5, 0.95),
      ph: seeded(i * 3.3) * Math.PI * 2,
      spikes: seeded(i * 1.1) > 0.35
    });
  }

  galaxyArmDots = [];
  const gx = width * 0.42;
  const gy = height * 0.38;
  for (let i = 0; i < 180; i++) {
    const arm = i % 2;
    const t = seeded(i * 2.7) * Math.PI * 4;
    const dist = seeded(i * 5.1) * Math.min(width, height) * 0.22;
    const spread = seeded(i * 8.3) * 28 - 14;
    const ang = t + arm * Math.PI + 0.4;
    galaxyArmDots.push({
      x: gx + Math.cos(ang) * dist + spread * 0.3,
      y: gy + Math.sin(ang) * dist * 0.55 + spread * 0.2,
      r: rand(0.4, 1.8),
      a: rand(0.12, 0.5)
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
    const elapsed = getIntroTime();
    startMusic.currentTime = elapsed;
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
  ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 255, 255, ${a * 0.1})`;
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
  ctx.strokeStyle = `rgba(255, 255, 255, ${a * 0.2})`;
  ctx.lineWidth = lw * 2.2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = `rgba(255, 255, 255, ${a * 0.9})`;
  ctx.lineWidth = lw;
  ctx.stroke();
}

function shipPoint(x, y, ox, oy, s, phase) {
  const bobX = Math.sin(phase) * 3 * s;
  const bobY = Math.cos(phase * 0.72) * 4 * s;
  const rx = x * SHIP_COS - y * SHIP_SIN;
  const ry = x * SHIP_SIN + y * SHIP_COS;
  return [ox + bobX + rx * s, oy + bobY + ry * s];
}

/** 参考 spaceship.png — 左下，宽约页面 1/2 */
function drawSpaceship(ox, oy, phase) {
  const s = (width * 0.5) / SHIP_W;

  for (const [x1, y1, x2, y2] of SHIP_LINES) {
    const a = shipPoint(x1, y1, ox, oy, s, phase);
    const b = shipPoint(x2, y2, ox, oy, s, phase);
    const major = x1 < 50 || x1 > 250;
    drawGlowLine(a[0], a[1], b[0], b[1], major ? 1 : 0.75, major ? 1 : 0.75);
  }

  for (const [cx, cy, rx, ry] of SHIP_RINGS) {
    const seg = 32;
    let prev = null;
    for (let i = 0; i <= seg; i++) {
      const ang = (i / seg) * Math.PI * 2;
      const px = cx + Math.cos(ang) * rx;
      const py = cy + Math.sin(ang) * ry;
      const p = shipPoint(px, py, ox, oy, s, phase);
      if (prev) drawGlowLine(prev[0], prev[1], p[0], p[1], 0.7, 0.75);
      prev = p;
    }
  }

  for (const [dx, dy] of SHIP_DOTS) {
    const p = shipPoint(dx, dy, ox, oy, s, phase);
    drawGlowDot(p[0], p[1], 1.1 * s, 0.88);
  }

  const tail = shipPoint(318, 0, ox, oy, s, phase);
  const thrust = 0.4 + Math.sin(phase * 2.1) * 0.4;
  ctx.save();
  ctx.globalAlpha = sceneAlpha * thrust * 0.55;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 1.2 * s;
  const t2 = shipPoint(328, 0, ox, oy, s, phase);
  ctx.beginPath();
  ctx.moveTo(tail[0], tail[1] - 5 * s);
  ctx.lineTo(t2[0], t2[1]);
  ctx.lineTo(tail[0], tail[1] + 5 * s);
  ctx.stroke();
  ctx.restore();
}

function drawStarSpikes(x, y, r, alpha) {
  const len = r * 5;
  ctx.save();
  ctx.globalAlpha = alpha * sceneAlpha * 0.35;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 0.6;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(a) * len, y - Math.sin(a) * len);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  ctx.restore();
}

/** 参考 starsky.png — 浩瀚星空远景 */
function drawDeepSky(t) {
  const layerA = sceneAlpha * 0.82;
  if (layerA < 0.02) return;

  ctx.save();

  for (const st of deepStars) {
    const tw = 0.55 + Math.sin(t * 1.5 + st.ph) * 0.45;
    ctx.globalAlpha = st.a * tw * layerA * 0.7;
    ctx.beginPath();
    ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }

  const gx = width * 0.4;
  const gy = height * 0.36;
  for (const d of galaxyArmDots) {
    ctx.globalAlpha = d.a * layerA * 0.65;
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fill();
  }

  ctx.globalAlpha = layerA * 0.12;
  const coreGrad = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.min(width, height) * 0.28);
  coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
  coreGrad.addColorStop(0.4, 'rgba(200, 220, 255, 0.08)');
  coreGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = coreGrad;
  ctx.fillRect(0, 0, width, height);

  for (let arm = 0; arm < 2; arm++) {
    ctx.globalAlpha = layerA * 0.18;
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const ang = arm * Math.PI + 0.5 + (i / 24) * 2.2;
      const dist = (i / 24) * Math.min(width, height) * 0.26;
      const px = gx + Math.cos(ang) * dist;
      const py = gy + Math.sin(ang) * dist * 0.5;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  for (const st of brightStars) {
    const tw = 0.6 + Math.sin(t * 2 + st.ph) * 0.4;
    const a = st.a * tw * layerA;
    drawGlowDot(st.x, st.y, st.r, a / sceneAlpha);
    if (st.spikes) drawStarSpikes(st.x, st.y, st.r, a);
  }

  const smudges = [
    [0.78, 0.15, 0.04], [0.85, 0.22, 0.03], [0.28, 0.18, 0.035]
  ];
  for (const [nx, ny, nr] of smudges) {
    const sx = width * nx;
    const sy = height * ny;
    const rr = Math.min(width, height) * nr;
    ctx.globalAlpha = layerA * 0.08;
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, rr);
    g.addColorStop(0, 'rgba(255,255,255,0.25)');
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(sx, sy, rr, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawRingedPlanet(px, py, r, tilt, t, rings = 3) {
  for (let ri = rings; ri >= 1; ri--) {
    ctx.beginPath();
    ctx.ellipse(px, py, r * (1 + ri * 0.22), r * (0.28 + ri * 0.06), tilt, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.15 + ri * 0.12})`;
    ctx.lineWidth = 0.5 + ri * 0.15;
    ctx.stroke();
  }
  for (let lat = -2; lat <= 2; lat++) {
    const ry = r * Math.cos(lat * 0.32) * 0.82;
    ctx.beginPath();
    ctx.ellipse(px, py + lat * r * 0.38, r * 0.96, Math.max(ry, 2), 0, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.2 + Math.abs(lat) * 0.06})`;
    ctx.lineWidth = 0.65;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.lineWidth = 1;
  ctx.stroke();
  const pulse = 0.55 + Math.sin(t * 2.5 + px) * 0.35;
  drawGlowDot(px, py - r * 0.3, 1.3, pulse * 0.65);
  drawGlowDot(px + r * 0.4, py, 1, 0.5);
}

function drawCraterPlanet(px, py, r, t) {
  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.lineWidth = 1;
  ctx.stroke();
  for (let i = 0; i < 7; i++) {
    const ang = seeded(i * 4.2 + px) * Math.PI * 2;
    const cr = r * (0.12 + seeded(i * 2.1) * 0.2);
    const cx = px + Math.cos(ang) * r * seeded(i * 3.3) * 0.55;
    const cy = py + Math.sin(ang) * r * seeded(i * 5.1) * 0.55;
    ctx.beginPath();
    ctx.arc(cx, cy, cr, ang, ang + Math.PI * 0.85);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }
  drawGlowDot(px - r * 0.2, py - r * 0.25, 0.9, 0.45);
}

function drawNetworkPlanet(px, py, r, t) {
  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 0.9;
  ctx.stroke();
  const nodes = [];
  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * Math.PI * 2 + t * 0.15;
    const lr = r * (0.35 + seeded(i * 7 + px) * 0.55);
    const nx = px + Math.cos(ang) * lr;
    const ny = py + Math.sin(ang) * lr * 0.88;
    nodes.push([nx, ny]);
    drawGlowDot(nx, ny, 0.85, 0.55);
  }
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (seeded(i * 11 + j * 13 + px) > 0.55) continue;
      drawGlowLine(nodes[i][0], nodes[i][1], nodes[j][0], nodes[j][1], 0.4, 0.5);
    }
  }
  drawGlowLine(px, py, nodes[0][0], nodes[0][1], 0.5, 0.5);
  drawGlowDot(px, py, 1.2, 0.7);
}

function drawGlassPlanet(px, py, r, t) {
  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(px, py, r * 0.55, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 0.6;
  ctx.stroke();
  const arcA = t * 0.4;
  ctx.beginPath();
  ctx.arc(px - r * 0.15, py - r * 0.1, r * 0.92, arcA, arcA + Math.PI * 0.65);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 0.7;
  ctx.stroke();
  drawGlowDot(px, py, r * 0.2, 0.85);
  drawGlowDot(px + r * 0.25, py - r * 0.2, 0.7, 0.4);
  for (let i = 0; i < 5; i++) {
    const ang = seeded(i * 3.7) * Math.PI * 2 + t * 0.2;
    drawGlowDot(
      px + Math.cos(ang) * r * 0.35,
      py + Math.sin(ang) * r * 0.3,
      0.5,
      0.35
    );
  }
}

const PLANETS = [
  { type: 'ring', x: 0.7, y: 0.11, r: 48, tilt: -0.38, float: 0, rings: 4 },
  { type: 'glass', x: 0.88, y: 0.2, r: 28, float: 1.2 },
  { type: 'network', x: 0.58, y: 0.14, r: 22, float: 2.1 },
  { type: 'crater', x: 0.82, y: 0.34, r: 16, float: 0.8 },
  { type: 'ring', x: 0.92, y: 0.08, r: 14, tilt: 0.2, float: 1.9, rings: 2 },
  { type: 'glass', x: 0.65, y: 0.28, r: 12, float: 2.6 },
  { type: 'crater', x: 0.95, y: 0.3, r: 9, float: 0.5 },
  { type: 'network', x: 0.75, y: 0.38, r: 11, float: 1.5 }
];

function drawCelestial(t) {
  for (const p of PLANETS) {
    const fx = Math.sin(t + p.float) * 4;
    const fy = Math.cos(t * 0.85 + p.float) * 3;
    const px = width * p.x + fx;
    const py = height * p.y + fy;
    ctx.save();
    ctx.globalAlpha = sceneAlpha;
    switch (p.type) {
      case 'ring':
        drawRingedPlanet(px, py, p.r, p.tilt ?? -0.3, t, p.rings ?? 3);
        break;
      case 'crater':
        drawCraterPlanet(px, py, p.r, t);
        break;
      case 'network':
        drawNetworkPlanet(px, py, p.r, t);
        break;
      case 'glass':
        drawGlassPlanet(px, py, p.r, t);
        break;
      default:
        break;
    }
    ctx.restore();
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
    ctx.save();
    ctx.globalAlpha = sceneAlpha * fade * 0.85;
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

  if (introRunning) {
    applyIntroTime(getIntroTime());
  }

  ctx.clearRect(0, 0, width, height);

  if (sceneAlpha > 0.01) {
    drawDeepSky(floatT);
  }

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
      const a = p.alpha * flicker * (sceneAlpha > 0.2 ? 1 : 0.35);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, 90%, 72%, ${a})`;
      ctx.fill();
      if (p.r > 1 && flicker > 0.7) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 90%, 70%, ${a * 0.1})`;
        ctx.fill();
      }
    }
  }

  if (sceneAlpha > 0.01) {
    drawCelestial(floatT);
    drawSpaceship(width * 0.01, height * 0.68, floatT);
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

  sceneAlpha =
    t >= INTRO.sceneBegin ? Math.min(1, (t - INTRO.sceneBegin) / INTRO.sceneRamp) : 0;

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
