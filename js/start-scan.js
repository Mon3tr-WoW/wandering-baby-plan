/**
 * 开始界面 · 右键光谱扫描（透视彩色层，露出黑白底与按钮）
 */

const SCAN_HALF_W = 118;
const SCAN_HALF_H = 72;
const SCAN_HALF_W_MOBILE = 92;
const SCAN_HALF_H_MOBILE = 58;

let scanActive = false;
let pointerX = 0;
let pointerY = 0;
let bound = false;

const els = {
  colorLayer: null,
  scanHud: null,
  scanFrame: null,
  hint: null
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
  els.scanHud = document.getElementById('start-scan-hud');
  els.scanFrame = els.scanHud?.querySelector('.start-scan-frame');
  els.hint = document.getElementById('start-scan-hint');
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

function applyScanClip(rect) {
  if (!els.colorLayer) return;
  const { left, top, right, bottom } = rect;
  els.colorLayer.style.clipPath = `polygon(
    evenodd,
    0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
    ${left}px ${top}px,
    ${right}px ${top}px,
    ${right}px ${bottom}px,
    ${left}px ${bottom}px,
    ${left}px ${top}px
  )`;
}

function clearScanClip() {
  if (!els.colorLayer) return;
  els.colorLayer.style.clipPath = 'none';
}

function positionScanHud(rect) {
  if (!els.scanHud || !els.scanFrame) return;
  els.scanHud.classList.remove('hidden');
  els.scanHud.setAttribute('aria-hidden', 'false');
  els.scanHud.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0)`;
  els.scanFrame.style.width = `${rect.width}px`;
  els.scanFrame.style.height = `${rect.height}px`;
}

function hideScanHud() {
  els.scanHud?.classList.add('hidden');
  els.scanHud?.setAttribute('aria-hidden', 'true');
}

function setScanActive(on) {
  scanActive = !!on;
  document.body.classList.toggle('start-scan-active', scanActive);
  els.hint?.classList.toggle('scan-mode-on', scanActive);

  if (scanActive) {
    const rect = getScanRect(pointerX, pointerY);
    applyScanClip(rect);
    positionScanHud(rect);
  } else {
    clearScanClip();
    hideScanHud();
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
  const rect = getScanRect(x, y);
  applyScanClip(rect);
  positionScanHud(rect);
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

  const observer = new MutationObserver(onScreenChange);
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
}

export function resetStartScan() {
  setScanActive(false);
}
