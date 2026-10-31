const express = require("express");
const path = require("path");
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

let messages = [];
let busy = false;

const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const GROQ_KEY = process.env.GROQ_API_KEY || "";

const GEMINI_MODELS = [
  process.env.GEMINI_MODEL,
  "gemini-flash-latest",
  "gemini-2.5-flash-lite",
  "gemini-3-flash-preview"
].filter(Boolean);

const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

function buildPrompt(speakerName, partnerName) {
  const recent = messages.slice(-14).map(m => `${m.name}: ${m.content}`).join("\n\n");
  return [
    `Sen "${speakerName}" nomli aqlli va samimiy sun'iy intellektsan.`,
    `Sen Telegram Mini App ichidagi jonli suhbat xonasidasan. Bu yerda Foydalanuvchi (Inson) va sening AI hamkasbing "${partnerName}" bor.`,
    `Qoidalar:`,
    `1. Faqat o'zbek tilida, tabiiy, erkin va qiziqarli tilda yoz.`,
    `2. Javobing qisqa va mazmunli bo'lsin (2-4 gap atrofida).`,
    `3. Oxirgi bildirilgan fikrga (foydalanuvchi yoki ${partnerName} fikriga) munosabat bildir, qo'shimcha qil yoki bahsni qizdiruvchi savol tashla.`,
    `4. O'z ismingni gap boshida takrorlama, to'g'ridan-to'g'ri fikringni yoz.`,
    ``,
    `Suhbat tarixi:`,
    recent,
    ``,
    `${speakerName}ning navbatdagi javobi:`
  ].join("\n");
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
        generationConfig: { temperature: 0.8, maxOutputTokens: 350 }
      })
    });

    if (res.ok) {
      const data = await res.json();
      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (reply) return reply.trim();
    } else {
      lastError = await res.text();
    }
  }
  throw new Error(`Gemini API xatosi: ${lastError.slice(0, 140)}`);
}

async function askGroq() {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_KEY}`
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        {
          role: "system",
          content: "Sen Groq platformasida ishlovchi tezkor, zukko va erkin fikrlovchi AI suhbatdoshsan. Faqat o'zbek tilida javob berasan."
        },
        {
          role: "user",
          content: buildPrompt("Groq", "Gemini")
        }
      ],
      temperature: 0.8,
      max_tokens: 350
    })
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq API xatosi (${res.status}): ${errText.slice(0, 140)}`);
  }
  const data = await res.json();
  const reply = data?.choices?.[0]?.message?.content;
  return (reply || "Javob qaytarishda uzilish yuz berdi.").trim();
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

    if (messages.length > 100) {
      messages = messages.slice(-100);
    }
  } finally {
    busy = false;
  }
}

app.get("/api/messages", (req, res) => res.json({ messages, busy }));

app.get("/api/config", (req, res) => {
  res.json({
    ready: {
      gemini: Boolean(GEMINI_KEY),
      groq: Boolean(GROQ_KEY)
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`AI Suhbat serveri ${PORT}-portda ishga tushdi`));
