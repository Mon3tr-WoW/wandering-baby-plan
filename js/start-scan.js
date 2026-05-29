/**
 * 开始界面 · 右键光谱扫描（透视彩色层，露出黑白底与按钮）
 */

const SCAN_HALF_W = 236;
const SCAN_HALF_H = 144;
const SCAN_HALF_W_MOBILE = 184;
const SCAN_HALF_H_MOBILE = 116;
const MASK_FEATHER = 42;

let scanActive = false;
let pointerX = 0;
let pointerY = 0;
let bound = false;
let maskSvg = null;

const els = {
  colorLayer: null,
  clickGate: null,
  hint: null,
  maskBg: null,
  maskHole: null,
  maskRoot: null
};

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function getScanHalfSize() {
  const mobile = window.innerWidth < 720;
  return {
    hw: mobile ? SCAN_HALF_W_MOBILE : SCAN_HALF_W,
    hh: mobile ? SCAN_HALF_H_MOBILE : SCAN_HALF_H
  };
}

function bindDom() {
  if (els.colorLayer) return;
  els.colorLayer = document.getElementById('start-color-layer');
  els.clickGate = document.getElementById('start-click-gate');
  els.hint = document.getElementById('start-scan-hint');
}

function ensureFeatherMask() {
  if (maskSvg) return;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.position = 'absolute';
  svg.style.overflow = 'hidden';
  svg.innerHTML = `
    <defs>
      <filter id="start-scan-feather" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="${MASK_FEATHER}"/>
      </filter>
      <mask id="start-scan-mask" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse">
        <rect id="start-scan-mask-bg" fill="white"/>
        <rect id="start-scan-mask-hole" fill="black" filter="url(#start-scan-feather)"/>
      </mask>
    </defs>
  `;
  document.body.appendChild(svg);

  maskSvg = svg;
  els.maskRoot = svg.querySelector('#start-scan-mask');
  els.maskBg = svg.querySelector('#start-scan-mask-bg');
  els.maskHole = svg.querySelector('#start-scan-mask-hole');
}

function syncMaskViewport() {
  if (!els.maskRoot || !els.maskBg) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  els.maskRoot.setAttribute('x', '0');
  els.maskRoot.setAttribute('y', '0');
  els.maskRoot.setAttribute('width', String(w));
  els.maskRoot.setAttribute('height', String(h));
  els.maskBg.setAttribute('x', '0');
  els.maskBg.setAttribute('y', '0');
  els.maskBg.setAttribute('width', String(w));
  els.maskBg.setAttribute('height', String(h));
}

function isStartScreen() {
  return document.body.classList.contains('start-screen-active');
}

function getScanRect(x, y) {
  const { hw, hh } = getScanHalfSize();
  const left = clamp(x - hw, 0, window.innerWidth - hw * 2);
  const top = clamp(y - hh, 0, window.innerHeight - hh * 2);
  return {
    left,
    top,
    right: left + hw * 2,
    bottom: top + hh * 2,
    width: hw * 2,
    height: hh * 2,
    cx: left + hw,
    cy: top + hh
  };
}

/** 视觉羽化：SVG mask 仅负责渐变，不参与点击判定 */
function applyVisualMask(rect) {
  if (!els.colorLayer) return;
  ensureFeatherMask();
  syncMaskViewport();

  const pad = MASK_FEATHER * 0.55;
  els.maskHole.setAttribute('x', String(rect.left - pad));
  els.maskHole.setAttribute('y', String(rect.top - pad));
  els.maskHole.setAttribute('width', String(rect.width + pad * 2));
  els.maskHole.setAttribute('height', String(rect.height + pad * 2));
  els.maskHole.setAttribute('rx', '18');

  els.colorLayer.style.mask = 'url(#start-scan-mask)';
  els.colorLayer.style.webkitMask = 'url(#start-scan-mask)';
}

/** 点击门控：硬边 clip-path 挖洞，透视区内可点到下层按钮 */
function applyClickGate(rect) {
  if (!els.clickGate) return;
  const { left, top, right, bottom } = rect;
  els.clickGate.style.clipPath = `polygon(
    evenodd,
    0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
    ${left}px ${top}px,
    ${right}px ${top}px,
    ${right}px ${bottom}px,
    ${left}px ${bottom}px,
    ${left}px ${top}px
  )`;
  els.clickGate.classList.remove('hidden');
  els.clickGate.setAttribute('aria-hidden', 'false');
}

function clearVisualMask() {
  if (!els.colorLayer) return;
  els.colorLayer.style.mask = 'none';
  els.colorLayer.style.webkitMask = 'none';
}

function clearClickGate() {
  if (!els.clickGate) return;
  els.clickGate.style.clipPath = 'none';
  els.clickGate.classList.add('hidden');
  els.clickGate.setAttribute('aria-hidden', 'true');
}

function applyScanWindow(rect) {
  applyVisualMask(rect);
  applyClickGate(rect);
}

function clearScanWindow() {
  clearVisualMask();
  clearClickGate();
}

function setScanActive(on) {
  scanActive = !!on;
  document.body.classList.toggle('start-scan-active', scanActive);
  els.hint?.classList.toggle('scan-mode-on', scanActive);

  if (scanActive) {
    applyScanWindow(getScanRect(pointerX, pointerY));
  } else {
    clearScanWindow();
  }
}

export function toggleStartScanMode() {
  if (!isStartScreen()) return;
  setScanActive(!scanActive);
}

export function setStartScanPointer(x, y) {
  pointerX = x;
  pointerY = y;
  if (!scanActive) return;
  applyScanWindow(getScanRect(x, y));
}

function onContextMenu(e) {
  if (!isStartScreen()) return;
  e.preventDefault();
  toggleStartScanMode();
}

function onPointerMove(e) {
  if (!isStartScreen()) return;
  setStartScanPointer(e.clientX, e.clientY);
}

function onPointerDown(e) {
  if (!isStartScreen() || !scanActive) return;
  setStartScanPointer(e.clientX, e.clientY);
}

function onKeyDown(e) {
  if (!isStartScreen() || e.key !== 'Escape') return;
  if (scanActive) setScanActive(false);
}

function onResize() {
  syncMaskViewport();
  if (scanActive) applyScanWindow(getScanRect(pointerX, pointerY));
}

function onScreenChange() {
  if (!isStartScreen() && scanActive) setScanActive(false);
}

export function setupStartScan() {
  bindDom();
  if (bound) return;
  bound = true;

  pointerX = window.innerWidth * 0.5;
  pointerY = window.innerHeight * 0.5;

  document.addEventListener('contextmenu', onContextMenu);
  document.addEventListener('pointermove', onPointerMove, { passive: true });
  document.addEventListener('pointerdown', onPointerDown, { passive: true });
  document.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', onResize);

  const observer = new MutationObserver(onScreenChange);
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
}

export function resetStartScan() {
  setScanActive(false);
}
