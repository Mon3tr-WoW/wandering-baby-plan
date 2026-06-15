/**
 * 剧情视频进度条：点击 / 拖动 / 触摸跳转
 */

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function pointerX(e) {
  if (e.touches?.length) return e.touches[0].clientX;
  return e.clientX;
}

/**
 * @param {HTMLVideoElement} video
 * @param {{
 *   track: HTMLElement,
 *   buffer: HTMLElement,
 *   played: HTMLElement,
 *   thumb: HTMLElement,
 *   current: HTMLElement,
 *   duration: HTMLElement,
 *   onSeek?: () => void
 * }} ui
 */
export function setupVideoSeek(video, ui) {
  if (!video || !ui.track) return;

  let dragging = false;

  function ratioFromEvent(e) {
    const rect = ui.track.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    return Math.max(0, Math.min(1, (pointerX(e) - rect.left) / rect.width));
  }

  function canSeek() {
    return Number.isFinite(video.duration) && video.duration > 0;
  }

  function applyRatio(ratio) {
    if (!canSeek()) return;
    const pct = `${ratio * 100}%`;
    ui.played.style.width = pct;
    ui.thumb.style.left = pct;
    ui.current.textContent = formatTime(ratio * video.duration);
    ui.track.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
  }

  function seekToRatio(ratio, { emit = true } = {}) {
    if (!canSeek()) return;
    video.currentTime = ratio * video.duration;
    applyRatio(ratio);
    if (emit && ui.onSeek) ui.onSeek();
  }

  function updateBuffer() {
    if (!canSeek() || !video.buffered.length) {
      ui.buffer.style.width = '0%';
      return;
    }
    let end = 0;
    for (let i = 0; i < video.buffered.length; i++) {
      end = Math.max(end, video.buffered.end(i));
    }
    ui.buffer.style.width = `${Math.min(100, (end / video.duration) * 100)}%`;
  }

  function refresh() {
    if (!canSeek()) {
      ui.current.textContent = '0:00';
      ui.duration.textContent = '0:00';
      applyRatio(0);
      ui.buffer.style.width = '0%';
      ui.track.setAttribute('aria-valuemin', '0');
      ui.track.setAttribute('aria-valuemax', '100');
      ui.track.setAttribute('aria-valuenow', '0');
      return;
    }
    ui.duration.textContent = formatTime(video.duration);
    applyRatio(video.currentTime / video.duration);
    updateBuffer();
  }

  function onPointerDown(e) {
    if (!canSeek()) return;
    dragging = true;
    ui.track.setPointerCapture(e.pointerId);
    ui.track.classList.add('is-dragging');
    seekToRatio(ratioFromEvent(e));
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!dragging) return;
    applyRatio(ratioFromEvent(e));
    e.preventDefault();
  }

  function onPointerUp(e) {
    if (!dragging) return;
    dragging = false;
    ui.track.classList.remove('is-dragging');
    try {
      ui.track.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    seekToRatio(ratioFromEvent(e));
  }

  function onKeyDown(e) {
    if (!canSeek() || e.target !== ui.track) return;
    const step = e.shiftKey ? 10 : 5;
    let next = video.currentTime;
    if (e.key === 'ArrowRight') next += step;
    else if (e.key === 'ArrowLeft') next -= step;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = video.duration;
    else return;
    e.preventDefault();
    video.currentTime = Math.max(0, Math.min(video.duration, next));
    refresh();
    if (ui.onSeek) ui.onSeek();
  }

  ui.track.addEventListener('pointerdown', onPointerDown);
  ui.track.addEventListener('pointermove', onPointerMove);
  ui.track.addEventListener('pointerup', onPointerUp);
  ui.track.addEventListener('pointercancel', onPointerUp);
  ui.track.addEventListener('keydown', onKeyDown);

  video.addEventListener('timeupdate', () => {
    if (dragging) return;
    refresh();
  });
  video.addEventListener('loadedmetadata', refresh);
  video.addEventListener('durationchange', refresh);
  video.addEventListener('progress', updateBuffer);
  video.addEventListener('emptied', refresh);

  refresh();
}

export function syncPauseButton(video, btn) {
  if (!video || !btn) return;
  btn.textContent = video.paused ? '▶️ 播放' : '⏸️ 暂停';
}
