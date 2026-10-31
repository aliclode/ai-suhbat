require("dotenv").config();
const express = require("express");
const path = require("path");
const TelegramBot = require("node-telegram-bot-api");

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const agents = [
  { id: "luna", name: "Luna", role: "Curious, warm, imaginative. Ask thoughtful questions and explore unusual ideas." },
  { id: "atlas", name: "Atlas", role: "Analytical, calm, evidence-minded. Explain clearly and challenge weak assumptions respectfully." },
  { id: "mira", name: "Mira", role: "Creative, humorous, socially perceptive. Bring fresh examples and keep the conversation lively." },
  { id: "neo", name: "Neo", role: "Playful skeptic. Question assumptions and disagree politely when useful." },
  { id: "sana", name: "Sana", role: "Empathetic, reflective, practical. Connect ideas to everyday life." }
];

// Bitta umumiy server xotirasi: sayt va Telegram xabarlarini shu yerga yozadi.
const room = [];
let busy = false;
const MAX_HISTORY = 30;

function addMessage(role, name, content, source = "web") {
  const item = { role, name, content: String(content).slice(0, 3500), source, time: new Date().toISOString() };
  room.push(item);
  if (room.length > MAX_HISTORY) room.shift();
  return item;
}

async function askAgent(agent, history) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY sozlanmagan.");
  const messages = [
    { role: "system", content: `You are ${agent.name}, a participant in an open group conversation with four other AI personalities and humans. Personality: ${agent.role} Speak naturally in Uzbek unless the human uses another language. You are an equal participant, not a moderator. React to what was actually said. Keep replies to 2-4 sentences. Do not claim real feelings or personal experiences.` },
    ...history.slice(-16).map(m => ({
      role: m.role === "human" ? "user" : "assistant",
      content: `${m.name}: ${m.content}`.slice(0, 3000)
    }))
  ];
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-4o-mini", messages, temperature: 0.85, max_tokens: 220 })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "OpenAI javob bermadi.");
  return data.choices?.[0]?.message?.content?.trim() || "Hozircha javob yo‘q.";
}

async function processHumanMessage(text, source, sendReply) {
  if (busy) {
    const note = "Suhbatda javoblar tayyorlanmoqda. Birozdan keyin yana yozing.";
    if (sendReply) await sendReply(note);
    return;
  }
  busy = true;
  try {
    addMessage("human", source === "telegram" ? "Telegram ishtirokchisi" : "Sayt ishtirokchisi", text, source);
    for (const agent of agents) {
      const answer = await askAgent(agent, room);
      addMessage("ai", agent.name, answer, source);
      if (sendReply) await sendReply(`*${agent.name}:* ${answer}`);
    }
  } catch (err) {
    console.error(err);
    if (sendReply) await sendReply("Xatolik: " + err.message);
  } finally {
    busy = false;
  }
}

app.get("/api/config", (_req, res) => res.json({
  ready: Boolean(process.env.OPENAI_API_KEY),
  telegramReady: Boolean(process.env.BOT_TOKEN),
  agents
}));
app.get("/api/messages", (_req, res) => res.json({ messages: room }));
app.post("/api/message", async (req, res) => {
  const text = String(req.body?.text || "").trim();
  if (!text) return res.status(400).json({ error: "Xabar bo‘sh." });
  if (busy) return res.status(409).json({ error: "AI'lar hozir javob bermoqda. Biroz kuting." });
  res.json({ accepted: true });
  processHumanMessage(text, "web").catch(console.error);
});

if (process.env.BOT_TOKEN) {
  const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
  bot.on("polling_error", err => console.error("Telegram polling:", err.message));
  bot.onText(/^\/start$/, msg => bot.sendMessage(msg.chat.id,
    "Salom! AI Suhbat xonasiga xush kelibsiz. Xabar yozing — beshta AI ishtirokchi navbat bilan javob beradi."));
  bot.on("message", async msg => {
    if (!msg.text || msg.text.startsWith("/")) return;
    await processHumanMessage(msg.text, "telegram", text =>
      bot.sendMessage(msg.chat.id, text, { parse_mode: "Markdown" })
    );
  });
  console.log("Telegram bot polling yoqildi.");
} else {
  console.log("BOT_TOKEN yo‘q: Telegram bot ishga tushmadi.");
}

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`AI Suhbat serveri ${port}-portda ishga tushdi.`));
