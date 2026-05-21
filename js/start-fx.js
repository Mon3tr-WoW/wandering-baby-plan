/**
 * 开始界面 / 全局背景：Canvas 星尘粒子
 */

let canvas = null;
let ctx = null;
let particles = [];
let rafId = 0;
let enabled = true;
let width = 0;
let height = 0;

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

function tick() {
  if (!enabled || !ctx) {
    rafId = requestAnimationFrame(tick);
    return;
  }

  ctx.clearRect(0, 0, width, height);

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

  rafId = requestAnimationFrame(tick);
}

export function initStartFx(targetCanvas) {
  canvas = targetCanvas;
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
  if (!rafId) rafId = requestAnimationFrame(tick);
}

export function setParticlesEnabled(on) {
  enabled = !!on;
  if (canvas) {
    canvas.classList.toggle('disabled', !enabled);
  }
}
