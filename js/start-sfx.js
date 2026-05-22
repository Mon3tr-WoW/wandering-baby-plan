/**
 * 开始界面按钮音效
 */
const SFX_BASE = 0.92;

/** @type {HTMLAudioElement | null} */
let sfxChoose = null;
/** @type {HTMLAudioElement | null} */
let sfxConfirm = null;

let masterVol = 1;

function playOne(audio) {
  if (!audio) return;
  audio.volume = Math.min(1, SFX_BASE * masterVol);
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

export function initStartSfx() {
  sfxChoose = new Audio('soundEffect/ButtonChose.wav');
  sfxConfirm = new Audio('soundEffect/ButtonConfirm.mp3');
  sfxChoose.preload = 'auto';
  sfxConfirm.preload = 'auto';
}

export function setSfxMasterVolume(v) {
  masterVol = Math.max(0, Math.min(1, v));
}

export function playButtonChoose() {
  playOne(sfxChoose);
}

export function playButtonConfirm() {
  playOne(sfxConfirm);
}
