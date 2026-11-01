const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

// iOS va mobil brauzerlarda pinch-to-zoom hamda double-tap zoomni bloklash
document.addEventListener("gesturestart", e => e.preventDefault(), { passive: false });
document.addEventListener("gesturechange", e => e.preventDefault(), { passive: false });
document.addEventListener("gestureend", e => e.preventDefault(), { passive: false });
document.addEventListener("touchmove", e => {
  if (e.touches && e.touches.length > 1) {
    e.preventDefault();
  }
}, { passive: false });

const feed = document.getElementById("feed");
const form = document.getElementById("form");
const input = document.getElementById("message");
const send = document.getElementById("send");
const debate = document.getElementById("debate");
const clearBtn = document.getElementById("clear");
const statusEl = document.getElementById("status");
const hint = document.getElementById("hint");

let lastSignature = "";
let hasMessages = false;
let busy = false;

const WELCOME_HTML = `<div class="welcome"><strong>Xush kelibsiz!</strong><br>O‘rtaga biror mavzu yoki savol tashlang. Gemini va Groq navbat bilan javob beradi va o‘zaro bahslashadi.</div>`;

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

function cssName(m) {
  if (m.role === "human" || m.role === "user") return "human";
  if (m.role === "system") return "system";
  const map = { Gemini: "gemini", Groq: "groq" };
  return map[m.name] || "system";
}

function render(messages) {
  hasMessages = messages.length > 0;
  const sig = messages.map(m => `${m.time}-${m.content.length}`).join("|");
  if (sig === lastSignature) {
    updateButtons(messages);
    return;
  }

  const isNearBottom = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 90;

  if (!messages.length) {
    feed.innerHTML = WELCOME_HTML;
  } else {
    feed.innerHTML = messages.map(m => `
      <article class="msg ${cssName(m)}">
        <div class="name">${esc(m.name)}</div>
        <div class="content">${esc(m.content)}</div>
        <div class="time">${new Date(m.time).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })}</div>
      </article>
    `).join("");
  }

  lastSignature = sig;
  if (isNearBottom || messages.length <= 2) {
    feed.scrollTop = feed.scrollHeight;
  }
  updateButtons(messages);
}

function updateButtons(messages) {
  const hasHuman = messages.some(m => m.role === "human");
  debate.disabled = busy || !hasHuman;
  clearBtn.disabled = busy || !messages.length;
}

function setBusy(v) {
  busy = v;
  send.disabled = v;
  debate.disabled = v || !hasMessages;
  clearBtn.disabled = v || !hasMessages;
  hint.textContent = v ? "AI'lar javob yozmoqda…" : (hasMessages ? "Suhbatga qo‘shiling yoki davom ettiring" : "Avval mavzu yozing");
}

async function loadConfig() {
  try {
    const c = await fetch("/api/config");
    const cfg = await c.json();
    const ready = cfg.ready || {};
    const count = Object.values(ready).filter(Boolean).length;
    statusEl.textContent = `AI faol: ${count}/2`;
    statusEl.title = `Gemini: ${ready.gemini ? "tayyor" : "kalit yo‘q"} · Groq: ${ready.groq ? "tayyor" : "kalit yo‘q"}`;
  } catch (e) {
    statusEl.textContent = "Aloqa yo‘q";
  }
}

async function refresh() {
  try {
    const r = await fetch("/api/messages");
    const d = await r.json();
    setBusy(Boolean(d.busy));
    render(d.messages || []);
  } catch (e) {
    statusEl.textContent = "Ulanishda xato";
  }
}

form.addEventListener("submit", async e => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text || busy) return;
  input.value = "";
  setBusy(true);
  try {
    const r = await fetch("/api/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    if (!r.ok) {
      const d = await r.json();
      alert(d.error || "Xabar yuborilmadi");
    }
  } catch (err) {
    alert("Server bilan aloqa yo‘q.");
  }
  await refresh();
});

debate.addEventListener("click", async () => {
  if (busy) return;
  setBusy(true);
  try {
    const r = await fetch("/api/debate/start", { method: "POST" });
    if (!r.ok) {
      const d = await r.json();
      alert(d.error || "Munozara boshlanmadi");
    }
  } catch (err) {
    alert("Server bilan aloqa yo‘q.");
  }
  await refresh();
});

clearBtn.addEventListener("click", async () => {
  if (busy) return;
  try {
    await fetch("/api/clear", { method: "POST" });
    await refresh();
  } catch (err) {
    alert("Tozalashda xatolik.");
  }
});

input.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    form.requestSubmit();
  }
});

// ==========================================================
// ALOHIDA GROQ OVOZLI SUHBAT LOGIKASI
// ==========================================================

const openVoiceBtn = document.getElementById("open-voice");
const closeVoiceBtn = document.getElementById("close-voice");
const voiceModal = document.getElementById("voice-modal");
const voiceFeed = document.getElementById("voice-feed");
const micBtn = document.getElementById("mic-btn");
const voiceStatus = document.getElementById("voice-status");
const voiceClearBtn = document.getElementById("voice-clear");
const voiceGenderSelect = document.getElementById("voice-gender");

let voiceList = [];
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let isProcessingVoice = false;
let currentAudio = null;

const VOICE_WELCOME = `<div class="welcome"><strong>Groq bilan yakkama-yakka ovozli suhbat!</strong><br>Pastdagi mikrofon tugmasini bir marta bosib gapiring, tugatgach yana bosing. Gemini bu suhbatga aralashmaydi.</div>`;

function renderVoiceFeed() {
  if (!voiceList.length) {
    voiceFeed.innerHTML = VOICE_WELCOME;
    return;
  }
  voiceFeed.innerHTML = voiceList.map(m => `
    <article class="msg ${cssName(m)}">
      <div class="name">${esc(m.name)}</div>
      <div class="content">${esc(m.content)}</div>
      <div class="time">${new Date(m.time).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })}</div>
    </article>
  `).join("");
  voiceFeed.scrollTop = voiceFeed.scrollHeight;
}

async function loadVoiceHistory() {
  try {
    const r = await fetch("/api/voice/messages");
    const d = await r.json();
    voiceList = d.messages || [];
    renderVoiceFeed();
  } catch (e) {}
}

openVoiceBtn.addEventListener("click", () => {
  voiceModal.hidden = false;
  loadVoiceHistory();
});

closeVoiceBtn.addEventListener("click", () => {
  if (isRecording && mediaRecorder) {
    mediaRecorder.stop();
    isRecording = false;
  }
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  voiceModal.hidden = true;
});

voiceClearBtn.addEventListener("click", async () => {
  if (isProcessingVoice) return;
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  await fetch("/api/voice/clear", { method: "POST" });
  voiceList = [];
  renderVoiceFeed();
  voiceStatus.textContent = "Suhbat tozalandi. Mikrofonni bosing";
});

function getSupportedMimeType() {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  for (const t of types) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

async function startMicRecording() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
    micBtn.classList.remove("speaking");
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = getSupportedMimeType();
    mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = e => {
      if (e.data && e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      const finalMime = mediaRecorder.mimeType || "audio/webm";
      const ext = finalMime.includes("mp4") ? "m4a" : "webm";
      const blob = new Blob(audioChunks, { type: finalMime });
      if (blob.size < 400) {
        voiceStatus.textContent = "Ovoz juda qisqa bo‘ldi, qaytadan gapiring";
        return;
      }
      await sendVoiceToGroq(blob, ext);
    };

    mediaRecorder.start();
    isRecording = true;
    micBtn.classList.add("recording");
    voiceStatus.textContent = "🔴 Eshitilmoqda... Gapirib bo‘lgach tugmani bosing";
  } catch (err) {
    alert("Mikrofonga ruxsat berilmadi. Telegram ichida mikrofonga ruxsat bering.");
  }
}

function stopMicRecording() {
  if (mediaRecorder && isRecording) {
    isRecording = false;
    micBtn.classList.remove("recording");
    mediaRecorder.stop();
  }
}

micBtn.addEventListener("click", () => {
  if (isProcessingVoice) return;
  if (!isRecording) {
    startMicRecording();
  } else {
    stopMicRecording();
  }
});

async function sendVoiceToGroq(blob, ext) {
  isProcessingVoice = true;
  micBtn.disabled = true;
  voiceStatus.textContent = "⏳ Groq eshitmoqda va ovoz tayyorlamoqda…";

  try {
    const formData = new FormData();
    formData.append("audio", blob, `voice.${ext}`);
    formData.append("voice", voiceGenderSelect.value);

    const res = await fetch("/api/voice/talk", {
      method: "POST",
      body: formData
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Xatolik yuz berdi");
    }

    voiceList.push(data.userMessage);
    voiceList.push(data.aiMessage);
    renderVoiceFeed();

    // Serverdan kelgan tabiiy Neural MP3 ovozni o'qitish
    const bytes = Uint8Array.from(atob(data.audioBase64), c => c.charCodeAt(0));
    const audioBlob = new Blob([bytes], { type: "audio/mpeg" });
    const audioUrl = URL.createObjectURL(audioBlob);

    currentAudio = new Audio(audioUrl);
    micBtn.classList.add("speaking");
    voiceStatus.textContent = "🔊 Groq gapirmoqda…";

    currentAudio.onended = () => {
      micBtn.classList.remove("speaking");
      voiceStatus.textContent = "Gapirish uchun mikrofonni bosing";
    };
    currentAudio.onerror = () => {
      micBtn.classList.remove("speaking");
      voiceStatus.textContent = "Gapirish uchun mikrofonni bosing";
    };

    await currentAudio.play();
  } catch (err) {
    voiceStatus.textContent = "Xato: " + err.message;
  } finally {
    isProcessingVoice = false;
    micBtn.disabled = false;
  }
}

loadConfig();
refresh();
setInterval(refresh, 1800);
