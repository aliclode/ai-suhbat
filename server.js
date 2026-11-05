const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const app = express();

// Render ortidagi haqiqiy mijoz IP manzilini olish.
app.set("trust proxy", 1);

// API spamini va tasodifiy ortiqcha so'rovlarni cheklash.
function createRateLimiter({ windowMs, max, message }) {
  const clients = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || "unknown";
    let entry = clients.get(key);
    if (!entry || now - entry.startedAt >= windowMs) {
      entry = { startedAt: now, count: 0 };
      clients.set(key, entry);
    }
    entry.count += 1;
    if (clients.size > 5000) {
      for (const [ip, value] of clients) {
        if (now - value.startedAt >= windowMs) clients.delete(ip);
      }
    }
    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, max - entry.count)));
    if (entry.count > max) {
      const retryAfter = Math.max(1, Math.ceil((entry.startedAt + windowMs - now) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({ error: message, retryAfter });
    }
    next();
  };
}

const apiRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: 120,
  message: "Juda ko'p so'rov yuborildi. Bir daqiqadan keyin urinib ko'ring."
});
const voiceRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: 12,
  message: "Ovozli so'rovlar limiti tugadi. Biroz kutib qayta urinib ko'ring."
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }
});

app.use(express.json({ limit: "32kb" }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  next();
});
app.use("/api", apiRateLimit);
app.use("/api/voice/talk", voiceRateLimit);
app.use(express.static(path.join(__dirname, "public")));

let messages = [];
let voiceHistories = {
  groq: [],
  gemini: []
};
let busy = false;
let memoryNotes = [];
const MEMORY_FILE = process.env.NOVA_MEMORY_FILE || path.join(__dirname, "data", "nova-memory.json");
let saveQueue = Promise.resolve();
async function persistState() {
  const snapshot = JSON.stringify({ messages, voiceHistories, memoryNotes });
  saveQueue = saveQueue.then(async () => {
    await fs.promises.mkdir(path.dirname(MEMORY_FILE), { recursive: true });
    await fs.promises.writeFile(MEMORY_FILE + ".tmp", snapshot, "utf8");
    await fs.promises.rename(MEMORY_FILE + ".tmp", MEMORY_FILE);
  }).catch(err => console.error("NOVA xotira saqlash xatosi:", err.message));
  return saveQueue;
}
async function loadState() {
  try {
    const data = JSON.parse(await fs.promises.readFile(MEMORY_FILE, "utf8"));
    if (Array.isArray(data.messages)) messages = data.messages.slice(-100);
    if (Array.isArray(data.memoryNotes)) memoryNotes = data.memoryNotes.slice(-100);
    if (data.voiceHistories) {
      voiceHistories.groq = Array.isArray(data.voiceHistories.groq) ? data.voiceHistories.groq.slice(-60) : [];
      voiceHistories.gemini = Array.isArray(data.voiceHistories.gemini) ? data.voiceHistories.gemini.slice(-60) : [];
    }
    console.log("NOVA xotirasi yuklandi.");
  } catch (err) { if (err.code !== "ENOENT") console.error("Xotira yuklanmadi:", err.message); }
}

const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const GROQ_KEY = process.env.GROQ_API_KEY || "";
const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY || "";

const GEMINI_MODELS = [
  process.env.GEMINI_MODEL,
  "gemini-flash-latest",
  "gemini-2.5-flash-lite",
  "gemini-3-flash-preview"
].filter(Boolean);

let cachedGroqModel = "";

async function getAvailableGroqModels() {
  const preferred = [
    process.env.GROQ_MODEL,
    cachedGroqModel,
    "llama-3.1-8b-instant",
    "llama-4-scout-17b-16e-instruct",
    "meta-llama/llama-4-scout-17b-16e-instruct",
    "meta-llama/llama-4-maverick-17b-128e-instruct",
    "qwen-qwq-32b",
    "gemma2-9b-it",
    "llama3-8b-8192",
    "llama3-70b-8192"
  ].filter(Boolean);

  try {
    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { "Authorization": `Bearer ${GROQ_KEY}` }
    });
    if (res.ok) {
      const data = await res.json();
      const available = (data.data || [])
        .map(m => m.id)
        .filter(id => !/whisper|tts|guard|embed|vision|orpheus|playai|allam/i.test(id));

      const matched = preferred.filter(p => available.includes(p));
      const others = available.filter(a => !matched.includes(a));
      const combined = [...new Set([...matched, ...others])];
      if (combined.length > 0) return combined;
    }
  } catch (e) {}
  return [...new Set(preferred)];
}

function buildPrompt(speakerName, partnerName) {
  const recent = messages.slice(-14).map(m => `${m.name}: ${m.content}`).join("\n\n");
  return [
    `Sen "${speakerName}" nomli aqlli va samimiy sun'iy intellektsan.`,
    `Sen Telegram Mini App ichidagi jonli suhbat xonasidasan. Bu yerda Foydalanuvchi (Inson) va sening AI hamkasbing "${partnerName}" bor.`,
    `Qoidalar:`,
    `1. Faqat o'zbek tilida, tabiiy, erkin va qiziqarli tilda yoz.`,
    `2. Javobing to'liq, tugallangan va mazmunli bo'lsin (2-4 gap atrofida). Gapni yarim yo'lda qoldirma.`,
    `3. Oxirgi bildirilgan fikrga (foydalanuvchi yoki ${partnerName} fikriga) munosabat bildir, qo'shimcha qil yoki bahsni qizdiruvchi savol tashla.`,
    `4. O'z ismingni gap boshida takrorlama, to'g'ridan-to'g'ri fikringni yoz.`,
    ``,
    `Suhbat tarixi:`,
    recent,
    ``,
    `${speakerName}ning navbatdagi to'liq javobi:`
  ].join("\n");
}

function cleanReply(text) {
  return String(text || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim();
}

async function askGemini() {
  let lastError = "";
  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt("Gemini", "Groq") }] }],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 1024
        }
      })
    });

    if (res.ok) {
      const data = await res.json();
      const parts = data?.candidates?.[0]?.content?.parts || [];
      const reply = parts.map(p => p.text || "").join("").trim();
      if (reply) return cleanReply(reply);
    } else {
      lastError = await res.text();
    }
  }
  throw new Error(`Gemini API xatosi: ${lastError.slice(0, 140)}`);
}

async function askQwen() {
  if (!GROQ_KEY) throw new Error("Qwen uchun Groq API kaliti kerak.");
  const available = await getAvailableGroqModels();
  const model = available.find(id => /qwen/i.test(id));
  if (!model) throw new Error("Groq hisobida hozircha Qwen modeli mavjud emas.");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_KEY}`
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: "Sen Qwen nomli mustaqil AI suhbatdoshsan. Faqat o'zbek tilida fikr bildir. Gemini va Groq fikrlarini tanqidiy tahlil qil, kerak bo'lsa ularga qo'shilma. Javobing 2-4 gap, aniq va tugallangan bo'lsin."
        },
        { role: "user", content: buildPrompt("Qwen", "Gemini va Groq") }
      ],
      temperature: 0.75,
      max_tokens: 800
    })
  });
  if (!res.ok) throw new Error(`Qwen API xatosi: ${(await res.text()).slice(0, 140)}`);
  const data = await res.json();
  const reply = cleanReply(data?.choices?.[0]?.message?.content);
  if (!reply) throw new Error("Qwen bo'sh javob qaytardi.");
  return reply;
}

async function askGroq() {
  let lastError = "";
  const modelsToTry = await getAvailableGroqModels();

  for (const model of modelsToTry) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_KEY}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "system",
            content: "Sen Groq platformasida ishlovchi tezkor, zukko va erkin fikrlovchi AI suhbatdoshsan. Faqat o'zbek tilida to'liq va tugallangan gaplar bilan javob berasan."
          },
          {
            role: "user",
            content: buildPrompt("Groq", "Gemini")
          }
        ],
        temperature: 0.8,
        max_tokens: 800
      })
    });

    if (res.ok) {
      const data = await res.json();
      const reply = cleanReply(data?.choices?.[0]?.message?.content);
      if (reply) {
        cachedGroqModel = model;
        return reply;
      }
    } else {
      lastError = await res.text();
    }
  }

  throw new Error(`Groq API xatosi: ${lastError.slice(0, 140)}`);
}

async function runConversationRound() {
  if (busy) return;
  busy = true;
  try {
    if (!GEMINI_KEY && !GROQ_KEY) {
      messages.push({
        role: "system",
        name: "Tizim",
        content: "Serverda GEMINI_API_KEY va GROQ_API_KEY sozlanmagan.",
        time: Date.now()
      });
      return;
    }

    if (GEMINI_KEY) {
      try {
        const geminiReply = await askGemini();
        messages.push({ role: "ai", name: "Gemini", content: geminiReply, time: Date.now() });
      } catch (err) {
        messages.push({ role: "system", name: "Tizim", content: err.message, time: Date.now() });
      }
    }

    if (GROQ_KEY) {
      try {
        const groqReply = await askGroq();
        messages.push({ role: "ai", name: "Groq", content: groqReply, time: Date.now() });
      } catch (err) {
        messages.push({ role: "system", name: "Tizim", content: err.message, time: Date.now() });
      }
    }

    if (GROQ_KEY) {
      try {
        const qwenReply = await askQwen();
        messages.push({ role: "ai", name: "Qwen", content: qwenReply, time: Date.now() });
      } catch (err) {
        messages.push({ role: "system", name: "Qwen", content: err.message, time: Date.now() });
      }
    }

    if (messages.length > 100) {
      messages = messages.slice(-100);
    }
  } finally {
    busy = false;
  }
}

// ==========================================================
// MUKAMMAL O'ZBEKCHA OVOZNI MATNGA O'GIRISH (STT)
// ==========================================================

async function transcribeUzbekVoice(buffer, mimetype, originalname) {
  const cleanMime = (mimetype || "audio/webm").split(";")[0].trim();

  if (GEMINI_KEY) {
    const base64Audio = buffer.toString("base64");
    for (const model of GEMINI_MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [
                {
                  inlineData: {
                    mimeType: cleanMime,
                    data: base64Audio
                  }
                },
                {
                  text: "Ushbu audiodagi inson nutqini tinglab, uning o'zbek tilida aytgan gaplarini aynan o'zini lotin alifbosida xatosiz matnga o'girib yoz. Hech qanday qo'shimcha izoh yozma, tarjima qilma, faqat eshitilgan gapning o'zini yoz. Agar ovoz yoki ma'no bo'lmasa, BO'SH deb yoz."
                }
              ]
            }],
            generationConfig: {
              temperature: 0.0,
              maxOutputTokens: 400
            }
          })
        });

        if (res.ok) {
          const data = await res.json();
          const parts = data?.candidates?.[0]?.content?.parts || [];
          const text = parts.map(p => p.text || "").join("").trim();
          if (text && !/^bo['‘`]?sh$/i.test(text)) {
            return text.replace(/^["']|["']$/g, "").trim();
          }
        }
      } catch (e) {}
    }
  }

  if (GROQ_KEY) {
    const form = new FormData();
    const ext = (originalname && originalname.includes(".")) ? originalname.split(".").pop() : (cleanMime.includes("mp4") ? "m4a" : "webm");
    const blob = new Blob([buffer], { type: cleanMime });
    form.append("file", blob, `voice.${ext}`);
    form.append("model", "whisper-large-v3");
    form.append("language", "uz");
    form.append("temperature", "0");
    form.append("prompt", "Assalomu alaykum! Bu o'zbek tilidagi jonli suhbat. Salom, qalaysiz, yaxshimisiz, nima gaplar, sun'iy intellekt, yordam bering.");

    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${GROQ_KEY}` },
      body: form
    });

    if (res.ok) {
      const data = await res.json();
      return (data.text || "").trim();
    }
  }

  throw new Error("Ovozni aniqlash imkoni bo'lmadi.");
}

async function askGroqVoiceOnly(userText) {
  const history = voiceHistories.groq.slice(-10).map(m => ({
    role: m.role === "user" ? "user" : "assistant",
    content: m.content
  }));

  const modelsToTry = await getAvailableGroqModels();
  let lastError = "";

  for (const model of modelsToTry) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_KEY}`
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "Sen Groq ovozli sun'iy intellektisan. Foydalanuvchi bilan yuzma-yuz ovozli gaplashyapsan. Faqat sof va ravon o'zbek tilida (lotin alifbosida), juda tabiiy, samimiy va qisqa (1-3 gap) javob qaytar. Hech qanday maxsus belgilar (*, #) ishlatma."
          },
          ...history,
          { role: "user", content: userText }
        ],
        temperature: 0.7,
        max_tokens: 450
      })
    });

    if (res.ok) {
      const data = await res.json();
      const reply = cleanReply(data?.choices?.[0]?.message?.content)
        .replace(/[*#_`~]/g, "")
        .trim();
      if (reply) {
        cachedGroqModel = model;
        return reply;
      }
    } else {
      lastError = await res.text();
    }
  }
  throw new Error(`Groq javob xatosi: ${lastError.slice(0, 120)}`);
}

async function askGeminiVoiceOnly(userText) {
  const recent = voiceHistories.gemini.slice(-10).map(m => `${m.name}: ${m.content}`).join("\n");
  const prompt = [
    `Sen Google tomonidan yaratilgan "Gemini" nomli aqlli va samimiy ovozli sun'iy intellektsan.`,
    `Foydalanuvchi bilan yakkama-yakka jonli ovozda suhbatlashyapsan (bu yerda boshqa AI yo'q).`,
    `Qoidalar:`,
    `1. Faqat sof va ravon o'zbek tilida (lotin alifbosida), tabiiy va samimiy javob qaytar.`,
    `2. Javobing qisqa, aniq va tugallangan bo'lsin (1-3 gap).`,
    `3. Hech qanday maxsus formatlash belgilari (*, #, -) ishlatma.`,
    ``,
    recent ? `Avvalgi suhbat:\n${recent}\n` : "",
    `Foydalanuvchi: ${userText}`,
    `Gemini javobi:`
  ].filter(Boolean).join("\n");

  let lastError = "";
  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.75,
          maxOutputTokens: 800
        }
      })
    });

    if (res.ok) {
      const data = await res.json();
      const parts = data?.candidates?.[0]?.content?.parts || [];
      const reply = cleanReply(parts.map(p => p.text || "").join(""))
        .replace(/[*#_`~]/g, "")
        .trim();
      if (reply) return reply;
    } else {
      lastError = await res.text();
    }
  }
  throw new Error(`Gemini javob xatosi: ${lastError.slice(0, 120)}`);
}

async function synthesizeSpeechServer(text, voiceGender = "male") {
  if (ELEVENLABS_KEY) {
    try {
      const voiceId = "21m00Tcm4TlvDq8ikWAM";
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
          "Accept": "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": ELEVENLABS_KEY
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2"
        })
      });
      if (res.ok) {
        const arr = await res.arrayBuffer();
        const buf = Buffer.from(arr);
        if (buf.length > 100) return buf;
      }
    } catch (e) {}
  }

  try {
    const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts");
    const tts = new MsEdgeTTS();
    const voiceName = voiceGender === "female" ? "uz-UZ-MadinaNeural" : "uz-UZ-SardorNeural";
    await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(text);
    const chunks = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.from(chunk));
    }
    const finalBuf = Buffer.concat(chunks);
    if (finalBuf.length > 0) return finalBuf;
  } catch (err) {}

  throw new Error("Ovoz sintez qilishda xatolik yuz berdi.");
}

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "AI Suhbat",
    uptimeSeconds: Math.floor(process.uptime()),
    ready: { gemini: Boolean(GEMINI_KEY), groq: Boolean(GROQ_KEY), qwen: Boolean(GROQ_KEY) }
  });
});


// ==========================================================
// NOVA AI AGENT CORE — rejalashtirish va xavfsiz javob
// ==========================================================
async function askNovaAgent(userText) {
  const recent = messages.slice(-12).map(m => `${m.name}: ${m.content}`).join("\n");
  const systemPrompt = [
    "Sen NOVA AI nomli ko'p vazifali shaxsiy AI agentsan.",
    "Foydalanuvchi bilan o'zbek tilida, sodda va aniq gaplash.",
    "Har bir topshiriqda avval maqsadni tushun, kerak bo'lsa 2-5 bosqichli qisqa reja tuz, keyin hozir bajara oladigan qismini bajar.",
    "Agar muhim ma'lumot yetishmasa, faqat eng zarur bitta savolni so'ra.",
    "Hozircha tashqi internet, GitHub yozish, fayl o'zgartirish, xarid yoki xabar yuborish vositalari ulanmagan. Bunday ishlarni bajardim deb da'vo qilma.",
    "Tashqi yoki qaytarib bo'lmaydigan amallar uchun doimo foydalanuvchi tasdig'i kerakligini ayt.",
    "Javobni kerak bo'lsa 'Reja' va 'Natija' sarlavhalari bilan tartibla. Keraksiz uzun yozma."
  ].join("\n");
  const savedMemory = memoryNotes.map(note => note.text).join(" | ");
  const prompt = `${systemPrompt}\n\nSaqlangan xotira: ${savedMemory || "Hozircha mavjud emas."}\n\nSo'nggi suhbat:\n${recent || "Hozircha yo'q"}\n\nFoydalanuvchining yangi topshirig'i: ${userText}\n\nNOVA AI javobi:`;

  if (GEMINI_KEY) {
    let lastError = "";
    for (const model of GEMINI_MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.45, maxOutputTokens: 1200 }
          })
        });
        if (res.ok) {
          const data = await res.json();
          const answer = cleanReply((data?.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join(""));
          if (answer) return answer;
        } else lastError = await res.text();
      } catch (err) { lastError = err.message; }
    }
    if (!GROQ_KEY) throw new Error(`NOVA AI Gemini xatosi: ${lastError.slice(0, 120)}`);
  }

  if (GROQ_KEY) {
    const models = await getAvailableGroqModels();
    let lastError = "";
    for (const model of models.slice(0, 3)) {
      try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_KEY}` },
          body: JSON.stringify({
            model,
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }],
            temperature: 0.45,
            max_tokens: 1200
          })
        });
        if (res.ok) {
          const data = await res.json();
          const answer = cleanReply(data?.choices?.[0]?.message?.content);
          if (answer) return answer;
        } else lastError = await res.text();
      } catch (err) { lastError = err.message; }
    }
    throw new Error(`NOVA AI Groq xatosi: ${lastError.slice(0, 120)}`);
  }

  throw new Error("NOVA AI ishlashi uchun Render'da GEMINI_API_KEY yoki GROQ_API_KEY sozlangan bo'lishi kerak.");
}

app.post("/api/agent/message", async (req, res) => {
  const text = String(req.body?.text || "").trim().slice(0, 2500);
  if (!text) return res.status(400).json({ error: "Topshiriq matni bo'sh." });
  if (busy) return res.status(429).json({ error: "AI hozir band. Biroz kuting." });

  busy = true;
  const userMessage = { role: "human", name: "Siz", content: text, time: Date.now() };
  messages.push(userMessage);
  try {
    const answer = await askNovaAgent(text);
    messages.push({ role: "ai", name: "NOVA AI", content: answer, time: Date.now() });
    if (messages.length > 100) messages = messages.slice(-100);
    res.json({ ok: true });
  } catch (err) {
    messages.push({ role: "system", name: "NOVA AI", content: err.message || "Agent xatosi.", time: Date.now() });
    res.status(502).json({ error: err.message || "NOVA AI javob bera olmadi." });
  } finally {
    busy = false;
  }
});

app.get("/api/messages", (req, res) => res.json({ messages, busy }));
app.get("/api/memory", (req, res) => res.json({ notes: memoryNotes }));
app.post("/api/memory", async (req, res) => {
  const noteText = String(req.body?.text || "").trim().slice(0, 500);
  if (!noteText) return res.status(400).json({ error: "Xotira matni bo'sh." });
  if (memoryNotes.length >= 100) return res.status(400).json({ error: "Xotira limiti 100 ta." });
  memoryNotes.push({ id: Date.now() + "-" + Math.random().toString(36).slice(2, 8), text: noteText, createdAt: Date.now() });
  await persistState();
  res.json({ ok: true });
});
app.delete("/api/memory", async (req, res) => {
  memoryNotes = [];
  await persistState();
  res.json({ ok: true });
});

app.get("/api/config", (req, res) => {
  res.json({
    ready: {
      gemini: Boolean(GEMINI_KEY),
      groq: Boolean(GROQ_KEY),
      qwen: Boolean(GROQ_KEY)
    }
  });
});

app.post("/api/message", (req, res) => {
  const text = String(req.body?.text || "").trim();
  if (!text) return res.status(400).json({ error: "Xabar matni bo'sh bo'lishi mumkin emas." });
  if (busy) return res.status(429).json({ error: "AI'lar hozir javob yozmoqda, biroz kuting." });

  messages.push({
    role: "human",
    name: "Siz",
    content: text.slice(0, 2500),
    time: Date.now()
  });

  runConversationRound();
  res.json({ ok: true });
});

app.post("/api/debate/start", (req, res) => {
  if (busy) return res.status(429).json({ error: "AI'lar hozir band." });
  if (!messages.length) return res.status(400).json({ error: "Avval suhbat uchun biror mavzu yozing." });

  runConversationRound();
  res.json({ ok: true });
});

app.post("/api/clear", (req, res) => {
  if (busy) return res.status(429).json({ error: "AI'lar javob yozib bo'lishini kuting." });
  messages = [];
  res.json({ ok: true });
});

app.get("/api/voice/messages", (req, res) => {
  const target = req.query.target === "gemini" ? "gemini" : "groq";
  res.json({ messages: voiceHistories[target] || [] });
});

app.post("/api/voice/clear", (req, res) => {
  const target = req.body?.target === "gemini" ? "gemini" : "groq";
  voiceHistories[target] = [];
  res.json({ ok: true });
});

app.post("/api/voice/talk", upload.single("audio"), async (req, res) => {
  const target = req.body?.target === "gemini" ? "gemini" : "groq";

  if (target === "gemini" && !GEMINI_KEY) {
    return res.status(400).json({ error: "Serverda GEMINI_API_KEY sozlanmagan." });
  }
  if (target === "groq" && !GROQ_KEY) {
    return res.status(400).json({ error: "Serverda GROQ_API_KEY sozlanmagan." });
  }
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ error: "Ovozli fayl yetib kelmadi." });
  }

  try {
    const voiceGender = req.body?.voice || (target === "gemini" ? "female" : "male");
    const userText = await transcribeUzbekVoice(req.file.buffer, req.file.mimetype, req.file.originalname);

    if (!userText) {
      return res.status(400).json({ error: "Ovozingiz eshitilmadi, iltimos aniqroq gapiring." });
    }

    const userMsg = { role: "user", name: "Siz", content: userText, time: Date.now() };
    voiceHistories[target].push(userMsg);

    const replyText = target === "gemini"
      ? await askGeminiVoiceOnly(userText)
      : await askGroqVoiceOnly(userText);

    const aiName = target === "gemini" ? "Gemini" : "Groq";
    const aiMsg = { role: "ai", name: aiName, content: replyText, time: Date.now() };
    voiceHistories[target].push(aiMsg);

    if (voiceHistories[target].length > 60) {
      voiceHistories[target] = voiceHistories[target].slice(-60);
    }

    const audioBuffer = await synthesizeSpeechServer(replyText, voiceGender);

    res.json({
      userMessage: userMsg,
      aiMessage: aiMsg,
      audioBase64: audioBuffer.toString("base64")
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Ovozli muloqotda xatolik" });
  }
});

const PORT = process.env.PORT || 3000;
loadState().finally(() => app.listen(PORT, () => console.log(`NOVA AI serveri ${PORT}-portda ishga tushdi`)));
