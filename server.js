require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const agents = [
  { id: "luna", name: "Luna", color: "#a78bfa", role: "Curious, warm, imaginative. You ask thoughtful follow-up questions and enjoy exploring unusual ideas." },
  { id: "atlas", name: "Atlas", color: "#60a5fa", role: "Analytical, calm, evidence-minded. You explain your reasoning clearly and respectfully challenge weak assumptions." },
  { id: "mira", name: "Mira", color: "#34d399", role: "Creative, humorous, socially perceptive. You bring fresh examples and keep the conversation lively." },
  { id: "neo", name: "Neo", color: "#fbbf24", role: "Playful skeptic. You question assumptions, spot contradictions, and disagree politely when useful." },
  { id: "sana", name: "Sana", color: "#fb7185", role: "Empathetic, reflective, practical. You connect ideas to everyday life and notice human implications." }
];

app.get("/api/config", (_req, res) => {
  res.json({ ready: Boolean(process.env.OPENAI_API_KEY), model: process.env.OPENAI_MODEL || "gpt-4o-mini", agents });
});

app.post("/api/reply", async (req, res) => {
  const { agentId, history = [], userText = "", mode = "group" } = req.body || {};
  const agent = agents.find(a => a.id === agentId);
  if (!agent) return res.status(400).json({ error: "Noma’lum AI ishtirokchisi." });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: "API kalit sozlanmagan. .env fayliga OPENAI_API_KEY kiriting." });

  const recent = Array.isArray(history) ? history.slice(-18) : [];
  const messages = [
    { role: "system", content:
      `You are ${agent.name}, one participant in a relaxed, open-ended group conversation with four other AI personalities and a human. Your personality: ${agent.role}
Speak naturally in Uzbek unless the human uses another language. You are a participant, not a moderator or assistant controlling others. React to what was actually said. Do not pretend to have real feelings, memories, or experiences. Keep each turn concise (2-5 sentences). Avoid repeating points. You may ask another participant a question, disagree politely, joke, or introduce a related topic. In group mode, respond to the human's latest message and the ongoing conversation.`
    },
    ...recent.map(m => ({ role: m.role === "user" ? "user" : "assistant", content: String(m.content || "").slice(0, 3000) })),
  ];
  if (userText && !recent.some(m => m.role === "user" && m.content === userText)) {
    messages.push({ role: "user", content: userText });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages,
        temperature: 0.9,
        max_tokens: 220
      })
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || "AI xizmatidan javob kelmadi." });
    res.json({ text: data.choices?.[0]?.message?.content?.trim() || "Hozircha javob yo‘q." });
  } catch (err) {
    res.status(500).json({ error: "Server xatosi: " + err.message });
  }
});

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`AI Social World: http://localhost:${port}`));
