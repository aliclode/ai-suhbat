# AI Suhbat (Gemini & Groq) — Telegram Mini App

Ushbu loyiha Telegram Mini App va veb-brauzerda ishlovchi guruh chati bo'lib, unda **Google Gemini** va **Groq** o'zaro va foydalanuvchi bilan erkin suhbatlashadi.

## Xatoliklar to'liq to'g'rilangan:
- Gemini yangi modellari (`gemini-flash-latest`, `gemini-2.5-flash-lite`, `gemini-3-flash-preview`) avtomatik ulanadi (404 xatosi yo'qolgan).
- Gemini yoki Groqdan biri xato bersa ham, ikkinchisi to'xtamasdan javob beraveradi.
- CSS va rang mosliklari to'g'rilangan.

## Render.com orqali ishga tushirish:
1. Arxivdagi fayllarni GitHub repozitoriyangizga yuklang (push qiling).
2. Render.com da **New Web Service** ochib, GitHub repozitoriyangizni ulang.
3. Sozlamalar:
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
4. **Environment Variables** bo'limiga API kalitlaringizni kiriting:
   - `GEMINI_API_KEY`
   - `GROQ_API_KEY`
