const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

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
  if (m.role === "human") return "human";
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

loadConfig();
refresh();
setInterval(refresh, 1800);
