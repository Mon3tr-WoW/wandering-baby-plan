/**
 * 新人类量子通讯 — 聊天界面
 */
import { initLlm, resetLlmChat, sendToNewHuman, isLlmConfigured } from './llm.js';

const els = {
  overlay: null,
  messages: null,
  input: null,
  send: null,
  close: null,
  status: null
};

let busy = false;
let inited = false;

const OPEN_GREETING =
  '量子链路已稳定。我在听——旧人类，你想问什么？';

function $(sel) {
  return document.querySelector(sel);
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function scrollToBottom() {
  if (els.messages) {
    els.messages.scrollTop = els.messages.scrollHeight;
  }
}

function appendBubble(role, text, extraClass = '') {
  if (!els.messages) return;
  const row = document.createElement('div');
  row.className = `llm-msg-row llm-msg-${role} ${extraClass}`.trim();

  if (role === 'assistant') {
    row.innerHTML = `
      <div class="llm-avatar" aria-hidden="true">◈</div>
      <div class="llm-bubble">
        <span class="llm-sender">新人类</span>
        <p class="llm-text">${escapeHtml(text)}</p>
      </div>`;
  } else if (role === 'user') {
    row.innerHTML = `
      <div class="llm-bubble">
        <span class="llm-sender">方舟号 · 你</span>
        <p class="llm-text">${escapeHtml(text)}</p>
      </div>`;
  } else {
    row.innerHTML = `<div class="llm-bubble llm-bubble-system"><p class="llm-text">${escapeHtml(text)}</p></div>`;
  }

  els.messages.appendChild(row);
  scrollToBottom();
}

function appendTyping() {
  if (!els.messages) return null;
  const row = document.createElement('div');
  row.className = 'llm-msg-row llm-msg-assistant llm-typing-row';
  row.innerHTML = `
    <div class="llm-avatar" aria-hidden="true">◈</div>
    <div class="llm-bubble">
      <span class="llm-sender">新人类</span>
      <p class="llm-text llm-typing"><span></span><span></span><span></span></p>
    </div>`;
  els.messages.appendChild(row);
  scrollToBottom();
  return row;
}

function setBusy(on) {
  busy = on;
  if (els.send) els.send.disabled = on;
  if (els.input) els.input.disabled = on;
  if (els.status) {
    els.status.textContent = on ? '信号传输中…' : isLlmConfigured() ? '链路就绪' : '未配置 API';
  }
}

async function handleSend() {
  const text = els.input?.value.trim();
  if (!text || busy) return;

  appendBubble('user', text);
  if (els.input) els.input.value = '';

  const typing = appendTyping();
  setBusy(true);

  try {
    const reply = await sendToNewHuman(text);
    typing?.remove();
    appendBubble('assistant', reply);
  } catch (err) {
    typing?.remove();
    appendBubble('system', err.message || '通讯中断，请稍后重试。');
  } finally {
    setBusy(false);
    els.input?.focus();
  }
}

export function openLlmChat() {
  if (!els.overlay) return;

  if (!inited) {
    appendBubble('system', isLlmConfigured()
      ? '量子通讯频道已开启。'
      : '⚠ 尚未配置 API Key（本地请编辑 js/llm-config.js）');
    appendBubble('assistant', OPEN_GREETING);
    inited = true;
  }

  els.overlay.classList.remove('hidden');
  els.overlay.setAttribute('aria-hidden', 'false');
  setBusy(false);
  els.input?.focus();
}

export function closeLlmChat() {
  els.overlay?.classList.add('hidden');
  els.overlay?.setAttribute('aria-hidden', 'true');
}

export async function setupLlmChat() {
  els.overlay = $('#llm-chat-overlay');
  els.messages = $('#llm-messages');
  els.input = $('#llm-input');
  els.send = $('#llm-send');
  els.close = $('#llm-close');
  els.status = $('#llm-status');

  await initLlm();
  resetLlmChat();

  els.send?.addEventListener('click', () => handleSend());
  els.close?.addEventListener('click', () => closeLlmChat());
  els.overlay?.addEventListener('click', (e) => {
    if (e.target === els.overlay) closeLlmChat();
  });
  els.input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  document.querySelectorAll('[data-open-llm]').forEach((btn) => {
    btn.addEventListener('click', () => openLlmChat());
  });

  if (els.status) {
    els.status.textContent = isLlmConfigured() ? '链路就绪' : '未配置 API';
  }
}

export function showPerfectLlmButton(show) {
  const btn = $('#btn-perfect-llm');
  const endingBtn = $('#btn-ending-llm');
  if (btn) btn.classList.toggle('hidden', !show);
  if (endingBtn) endingBtn.classList.toggle('hidden', !show);
}
