/**
 * 保守型播放缓冲：预缓冲门槛 + 缓冲余量检测（不改动 URL 解析逻辑）
 */

/** 开播前至少缓冲秒数 */
const MIN_BUFFER_BEFORE_PLAY = 3;
/** 最多等待预缓冲的时间，超时仍尝试播放 */
const MAX_BUFFER_WAIT_MS = 12000;
/** 播放中缓冲余量低于此值才显示「缓冲中」 */
const MIN_AHEAD_TO_PLAY_SMOOTH = 2.5;

export function getBufferedAhead(video) {
  if (!video?.buffered?.length) return 0;
  const t = video.currentTime;
  for (let i = 0; i < video.buffered.length; i++) {
    const start = video.buffered.start(i);
    const end = video.buffered.end(i);
    if (t >= start - 0.05 && t <= end + 0.05) {
      return Math.max(0, end - t);
    }
  }
  return 0;
}

/**
 * 元数据就绪后、play 前：尽量多缓冲几秒，超时则不再等待
 */
export async function waitForPlaybackBuffer(video, isAborted) {
  if (!video || isAborted()) return;
  if (getBufferedAhead(video) >= MIN_BUFFER_BEFORE_PLAY) return;

  await new Promise((resolve) => {
    const done = () => {
      cleanup();
      resolve();
    };

    const check = () => {
      if (isAborted()) return done();
      if (getBufferedAhead(video) >= MIN_BUFFER_BEFORE_PLAY) return done();
    };

    const cleanup = () => {
      clearTimeout(timer);
      clearInterval(tick);
      video.removeEventListener('progress', check);
      video.removeEventListener('canplay', check);
      video.removeEventListener('loadeddata', check);
    };

    const timer = setTimeout(done, MAX_BUFFER_WAIT_MS);
    const tick = setInterval(check, 400);
    video.addEventListener('progress', check);
    video.addEventListener('canplay', check);
    video.addEventListener('loadeddata', check);
    check();
  });
}

export function shouldShowPlaybackBuffering(video) {
  if (!video || video.paused || video.ended) return false;
  return getBufferedAhead(video) < MIN_AHEAD_TO_PLAY_SMOOTH;
}

export { MIN_BUFFER_BEFORE_PLAY, MIN_AHEAD_TO_PLAY_SMOOTH };
