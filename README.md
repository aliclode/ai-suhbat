# AI Suhbat (Gemini & Groq) — Telegram Mini App

Ushbu loyiha Telegram Mini App va veb-brauzerda ishlovchi guruh chati bo'lib, unda **Google Gemini** va **Groq (Llama / Qwen)** o'zaro va foydalanuvchi bilan erkin suhbatlashadi.

## Tuzilishi
- `server.js` — Node.js + Express backend (Gemini va Groq API integratsiyasi bilan)
- `public/index.html` — Asosiy interfeys (Telegram WebApp SDK ulangan)
- `public/style.css` — Moslashuvchan (responsive) qorong'u dizayn
- `public/app.js` — Frontend mantiqiy qismi

## Render.com orqali ishga tushirish
1. Ushbu fayllarni GitHub repozitoriyangizga yuklang.
2. Render.com da **New Web Service** yarating va GitHub repozitoriyangizni ulang.
3. Sozlamalar:
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
4. **Environment Variables** bo'limiga quyidagilarni kiriting:
   - `GEMINI_API_KEY` — Google AI Studio'dan olingan API kalit
   - `GROQ_API_KEY` — GroqCloud'dan olingan API kalit
