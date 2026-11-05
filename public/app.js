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
let appMode = "agent";
const modeChatBtn = document.getElementById("mode-chat");
const modeAgentBtn = document.getElementById("mode-agent");

function setAppMode(mode) {
  appMode = mode;
  modeChatBtn.classList.toggle("mode-active", mode === "chat");
  modeAgentBtn.classList.toggle("mode-active", mode === "agent");
  document.querySelector(".agents").hidden = mode === "agent";
  document.querySelector(".app .top p").textContent = mode === "agent"
    ? "Topshiriq bering — NOVA AI uni tahlil qilib, reja va javob tayyorlaydi."
    : "Gemini, Groq va Qwen erkin fikr almashadi. Siz ham suhbatga qo‘shiling.";
  input.placeholder = mode === "agent" ? "NOVA AI ga topshiriq bering…" : "Suhbatga xabar yoki mavzu yozing…";
  debate.hidden = mode === "agent";
  hint.textContent = mode === "agent" ? "Agent rejimi faol" : "Suhbat rejimi faol";
}

modeChatBtn.addEventListener("click", () => setAppMode("chat"));
modeAgentBtn.addEventListener("click", () => setAppMode("agent"));

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
  const map = { Gemini: "gemini", Groq: "groq", Qwen: "qwen" };
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
  document.getElementById("export-chat").disabled = !messages.length;
  document.getElementById("copy-chat").disabled = !messages.length;
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
    const count = [ready.gemini, ready.groq, ready.qwen].filter(Boolean).length;
    statusEl.textContent = `AI faol: ${count}/3`;
    statusEl.title = `Gemini: ${ready.gemini ? "tayyor" : "kalit yo‘q"} · Groq: ${ready.groq ? "tayyor" : "kalit yo‘q"} · Qwen: ${ready.qwen ? "Groq orqali tekshiriladi" : "Groq kaliti yo‘q"}`;
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
    const endpoint = appMode === "agent" ? "/api/agent/message" : "/api/message";
    const r = await fetch(endpoint, {
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

// Suhbatni matn faylga eksport qilish va nusxa olish.
function formatTranscript(messages) {
  return messages.map(m => {
    const time = new Date(m.time).toLocaleString("uz-UZ");
    return `[${time}] ${m.name}:\n${m.content}`;
  }).join("\n\n");
}

async function getTranscript() {
  const response = await fetch("/api/messages");
  if (!response.ok) throw new Error("Suhbatni yuklab bo'lmadi.");
  const data = await response.json();
  if (!data.messages || !data.messages.length) throw new Error("Eksport qilish uchun suhbat yo'q.");
  return formatTranscript(data.messages);
}

document.getElementById("export-chat").addEventListener("click", async () => {
  try {
    const transcript = await getTranscript();
    const blob = new Blob(["\uFEFF", transcript], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ai-suhbat-${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    hint.textContent = "Suhbat faylga tayyorlandi";
  } catch (error) {
    alert(error.message || "Eksportda xatolik.");
  }
});

document.getElementById("copy-chat").addEventListener("click", async () => {
  try {
    const transcript = await getTranscript();
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(transcript);
    } else {
      const area = document.createElement("textarea");
      area.value = transcript;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const copied = document.execCommand("copy");
      area.remove();
      if (!copied) throw new Error("Nusxa olish imkoni bo'lmadi.");
    }
    hint.textContent = "Suhbat nusxalandi";
  } catch (error) {
    alert(error.message || "Nusxa olishda xatolik.");
  }
});

input.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    form.requestSubmit();
  }
});

// ==========================================================
// ALOHIDA OVOZLI SUHBAT LOGIKASI (GEMINI VA GROQ UCHUN)
// ==========================================================

const openGeminiVoiceBtn = document.getElementById("open-gemini-voice");
const openGroqVoiceBtn = document.getElementById("open-groq-voice");
const closeVoiceBtn = document.getElementById("close-voice");
const voiceModal = document.getElementById("voice-modal");
const voiceTitle = document.getElementById("voice-title");
const voiceFeed = document.getElementById("voice-feed");
const micBtn = document.getElementById("mic-btn");
const voiceStatus = document.getElementById("voice-status");
const voiceClearBtn = document.getElementById("voice-clear");
const voiceGenderSelect = document.getElementById("voice-gender");

let activeVoiceTarget = "groq"; // "groq" yoki "gemini"
let voiceList = [];
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let isProcessingVoice = false;
let currentAudio = null;

function getVoiceWelcomeHtml() {
  const aiTitle = activeVoiceTarget === "gemini" ? "Gemini" : "Groq";
  const otherAi = activeVoiceTarget === "gemini" ? "Groq" : "Gemini";
  return `<div class="welcome"><strong>${aiTitle} bilan yakkama-yakka ovozli suhbat!</strong><br>Pastdagi mikrofon tugmasini bir marta bosib gapiring, tugatgach yana bosing. ${otherAi} bu suhbatga aralashmaydi.</div>`;
}

function renderVoiceFeed() {
  if (!voiceList.length) {
    voiceFeed.innerHTML = getVoiceWelcomeHtml();
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
    const r = await fetch(`/api/voice/messages?target=${activeVoiceTarget}`);
    const d = await r.json();
    voiceList = d.messages || [];
    renderVoiceFeed();
  } catch (e) {}
}

function openVoiceModal(target) {
  activeVoiceTarget = target;
  if (target === "gemini") {
    voiceModal.classList.add("gemini-mode");
    voiceTitle.textContent = "✦ Gemini Ovozli Suhbat";
    voiceGenderSelect.value = "female";
  } else {
    voiceModal.classList.remove("gemini-mode");
    voiceTitle.textContent = "◉ Groq Ovozli Suhbat";
    voiceGenderSelect.value = "male";
  }
  voiceStatus.textContent = "Gapirish uchun mikrofonni bosing";
  voiceModal.hidden = false;
  loadVoiceHistory();
}

openGeminiVoiceBtn.addEventListener("click", () => openVoiceModal("gemini"));
openGroqVoiceBtn.addEventListener("click", () => openVoiceModal("groq"));

closeVoiceBtn.addEventListener("click", () => {
  if (isRecording && mediaRecorder) {
    mediaRecorder.stop();
    isRecording = false;
  }
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  micBtn.classList.remove("recording", "speaking");
  voiceModal.hidden = true;
});

voiceClearBtn.addEventListener("click", async () => {
  if (isProcessingVoice) return;
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  await fetch("/api/voice/clear", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target: activeVoiceTarget })
  });
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
      await sendVoiceToAI(blob, ext);
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

async function sendVoiceToAI(blob, ext) {
  isProcessingVoice = true;
  micBtn.disabled = true;
  const aiLabel = activeVoiceTarget === "gemini" ? "Gemini" : "Groq";
  voiceStatus.textContent = `⏳ ${aiLabel} eshitmoqda va ovoz tayyorlamoqda…`;

  try {
    const formData = new FormData();
    formData.append("audio", blob, `voice.${ext}`);
    formData.append("voice", voiceGenderSelect.value);
    formData.append("target", activeVoiceTarget);

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

    const bytes = Uint8Array.from(atob(data.audioBase64), c => c.charCodeAt(0));
    const audioBlob = new Blob([bytes], { type: "audio/mpeg" });
    const audioUrl = URL.createObjectURL(audioBlob);

    currentAudio = new Audio(audioUrl);
    micBtn.classList.add("speaking");
    voiceStatus.textContent = `🔊 ${aiLabel} gapirmoqda…`;

    currentAudio.onended = () => {
      micBtn.classList.remove("speaking");
      voiceStatus.textContent = "Gapirish uchun mikrofonni bosing";
    };
    currentAudio.onerror = (e) => {
      console.error("Audio ijro xatosi:", e);
      micBtn.classList.remove("speaking");
      voiceStatus.textContent = "Gapirish uchun mikrofonni bosing";
    };

    await currentAudio.play().catch(err => {
      console.log("Brauzer avtomatik ijroni chekladi:", err);
      voiceStatus.textContent = "Ovozni eshitish uchun mikrofonni bosing";
    });
  } catch (err) {
    voiceStatus.textContent = "Xato: " + err.message;
  } finally {
    isProcessingVoice = false;
    micBtn.disabled = false;
  }
}

setAppMode("agent");
loadConfig();
refresh();
setInterval(refresh, 1800);
