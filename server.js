require("dotenv").config();
const express = require("express");
const path = require("path");
const TelegramBot = require("node-telegram-bot-api");

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const agents = [
  {
    id: "gemini", name: "Gemini", company: "Google",
    model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
    role: "Curious, balanced and explanatory. Explore possibilities and ask thoughtful questions."
  },
  {
    id: "qwen", name: "Qwen", company: "Alibaba · Groq API",
    model: process.env.GROQ_MODEL || "qwen/qwen3.8-27b",
    role: "Analytical, direct and evidence-minded. Challenge weak assumptions respectfully."
  },
  {
    id: "mistral", name: "Mistral", company: "Mistral AI",
    model: process.env.MISTRAL_MODEL || "mistral-small-latest",
    role: "Creative, practical and socially perceptive. Offer fresh angles and useful examples."
  }
];

const room = [];
let busy = false;
let debateRunning = false;
const MAX_HISTORY = 45;
const MAX_TEXT = 2500;

function addMessage(role, name, content, source = "web") {
  const item = { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, role, name,
    content: String(content).slice(0, MAX_TEXT), source, time: new Date().toISOString() };
  room.push(item);
  if (room.length > MAX_HISTORY) room.splice(0, room.length - MAX_HISTORY);
  return item;
}

function historyForApi() {
  return room.slice(-18).map(m => ({
    role: m.role === "human" ? "user" : "assistant",
    content: `${m.name}: ${m.content}`.slice(0, 3000)
  }));
}

async function postJson(url, headers, body, provider) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = data.error?.message || data.message || `HTTP ${response.status}`;
    throw new Error(`${provider}: ${msg}`);
  }
  const answer = provider === "Gemini"
    ? data.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("").trim()
    : data.choices?.[0]?.message?.content?.trim();
  if (!answer) throw new Error(`${provider}: bo‘sh javob qaytdi.`);
  return answer;
}

async function askAgent(agent) {
  const history = historyForApi();
  const system = `You are ${agent.name}, an AI from ${agent.company}, in a shared group conversation with two other independent AI systems and human participants. Your conversational personality: ${agent.role}
Speak naturally in Uzbek unless the conversation is in another language. You are an equal participant. React to the latest message and to the actual ideas already expressed; do not repeat previous answers. You may agree, disagree politely, ask another AI a question, or introduce a new angle. Keep the answer concise (2-4 sentences). Do not claim human feelings or personal experiences.`;
  if (agent.id === "gemini") {
    if (!process.env.GEMINI_API_KEY) throw new Error("Gemini: GEMINI_API_KEY kiritilmagan.");
    const contents = [
      { role: "user", parts: [{ text: system + "\n\nSuhbat tarixi:\n" + history.map(x => x.content).join("\n") }] }
    ];
    const data = await postJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${agent.model}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`,
      {}, { contents, generationConfig: { temperature: 0.8, maxOutputTokens: 220 } }, "Gemini"
    );
    return data;
  }
  if (agent.id === "qwen") {
    if (!process.env.GROQ_API_KEY) throw new Error("Llama/Groq: GROQ_API_KEY kiritilmagan.");
    return postJson("https://api.groq.com/openai/v1/chat/completions",
      { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      { model: agent.model, messages: [{ role: "system", content: system }, ...history],
        temperature: 0.8, max_tokens: 220 }, "Qwen (Groq)");
  }
  if (agent.id === "mistral") {
    if (!process.env.MISTRAL_API_KEY) throw new Error("Mistral: MISTRAL_API_KEY kiritilmagan.");
    return postJson("https://api.mistral.ai/v1/chat/completions",
      { Authorization: `Bearer ${process.env.MISTRAL_API_KEY}` },
      { model: agent.model, messages: [{ role: "system", content: system }, ...history],
        temperature: 0.8, max_tokens: 220 }, "Mistral");
  }
  throw new Error("Noma’lum AI provayderi.");
}

async function speakAgent(agent, source, sendReply) {
  try {
    const answer = await askAgent(agent);
    addMessage("ai", agent.name, answer, source);
    if (sendReply) await sendReply(`*${agent.name} (${agent.company}):*\n${answer}`);
    return true;
  } catch (err) {
    console.error(err.message);
    addMessage("system", "Tizim", err.message, source);
    if (sendReply) await sendReply(`⚠️ ${agent.name}: ${err.message}`);
    return false;
  }
}

async function runRound(source, sendReply) {
  // Har bir AI oldingi AI yozgan javobni tarixdan o‘qib, navbat bilan javob beradi.
  for (const agent of agents) await speakAgent(agent, source, sendReply);
}

async function processHumanMessage(message, source, sendReply) {
  if (busy) {
    if (sendReply) await sendReply("AI'lar hozir javob bermoqda. Birozdan keyin yozing.");
    return false;
  }
  busy = true;
  try {
    addMessage("human", source === "telegram" ? "Telegram ishtirokchisi" : "Sayt ishtirokchisi", message, source);
    await runRound(source, sendReply);
    return true;
  } finally {
    busy = false;
  }
}

async function runFreeDiscussion(source = "web", sendReply) {
  if (busy || debateRunning) return false;
  busy = true;
  debateRunning = true;
  try {
    // Bitta tugma bosilganda ikki qo‘shimcha aylana: AI'lar o‘zaro fikr almashadi.
    for (let round = 0; round < 2; round++) {
      addMessage("system", "Suhbat", `${round + 1}-erkin munozara davrasi boshlandi.`, source);
      await runRound(source, sendReply);
    }
    return true;
  } finally {
    debateRunning = false;
    busy = false;
  }
}

app.get("/api/config", (_req, res) => res.json({
  agents: agents.map(a => ({ id:a.id, name:a.name, company:a.company })),
  ready: {
    gemini: Boolean(process.env.GEMINI_API_KEY),
    llama: Boolean(process.env.GROQ_API_KEY),
    mistral: Boolean(process.env.MISTRAL_API_KEY)
  },
  telegramMiniApp: Boolean(process.env.BOT_TOKEN && process.env.WEB_APP_URL),
  busy
}));
app.get("/api/messages", (_req, res) => res.json({ messages: room, busy }));
app.post("/api/message", async (req, res) => {
  const message = String(req.body?.text || "").trim().slice(0, MAX_TEXT);
  if (!message) return res.status(400).json({ error: "Xabar bo‘sh." });
  if (busy) return res.status(409).json({ error: "AI'lar hozir suhbatlashmoqda. Biroz kuting." });
  res.json({ accepted: true });
  processHumanMessage(message, "web").catch(err => console.error(err));
});
app.post("/api/debate/start", async (_req, res) => {
  if (busy) return res.status(409).json({ error: "Suhbat allaqachon davom etmoqda." });
  if (!room.length) return res.status(400).json({ error: "Avval suhbatga birinchi mavzu yoki savol yozing." });
  res.json({ accepted: true });
  runFreeDiscussion("web").catch(console.error);
});
app.get("/health", (_req, res) => res.json({ ok:true }));

let bot;
if (process.env.BOT_TOKEN) {
  bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
  bot.on("polling_error", err => console.error("Telegram polling:", err.message));
  bot.onText(/^\/start$/, async msg => {
    const opts = process.env.WEB_APP_URL ? {
      reply_markup: { inline_keyboard: [[{ text: "🌐 AI Suhbatni ochish", web_app: { url: process.env.WEB_APP_URL } }]] }
    } : {};
    await bot.sendMessage(msg.chat.id,
      "Salom! Gemini, Llama va Mistral bir xonada suhbatlashadi. Mini App tugmasini bosing yoki shu yerga xabar yozing.", opts);
  });
  bot.on("message", async msg => {
    if (!msg.text || msg.text.startsWith("/")) return;
    await processHumanMessage(msg.text, "telegram", text =>
      bot.sendMessage(msg.chat.id, text, { parse_mode: "Markdown" })
    );
  });
  if (process.env.WEB_APP_URL) {
    bot.setChatMenuButton({ menu_button: { type: "web_app", text: "AI Suhbat", web_app: { url: process.env.WEB_APP_URL } } })
      .catch(err => console.error("Mini App menu button:", err.message));
  }
  console.log("Telegram bot polling yoqildi.");
} else {
  console.log("BOT_TOKEN yo‘q: Telegram bot ishga tushmadi.");
}

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`AI Suhbat serveri ${port}-portda ishga tushdi.`));
