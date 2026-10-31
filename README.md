# AI Suhbat — 3 kompaniya + Telegram Mini App

Ushbu loyiha bitta umumiy chat xonasida:
- Gemini (Google)
- Qwen 3.8 27B (Alibaba modeli, Groq API orqali)
- Mistral Small (Mistral AI)

modellari bilan ishlaydi. Har bir foydalanuvchi xabaridan keyin uchala model navbat bilan javob beradi. “AI'lar o‘zaro davom ettirsin” tugmasi ikki qo‘shimcha munozara aylanasini ishga tushiradi.

## Ishga tushirish
1. `npm install`
2. `.env.example` faylidan `.env` nusxa oling va API kalitlarini kiriting.
3. `npm start`

## Render Environment Variables
- `GEMINI_API_KEY`
- `GROQ_API_KEY`
- `MISTRAL_API_KEY`
- `BOT_TOKEN`
- `WEB_APP_URL` — Render'dagi HTTPS manzil, masalan `https://your-app.onrender.com`

Build Command: `npm install`
Start Command: `npm start`

Botda `/start` yuborilganda Mini App tugmasi chiqadi. Bot menyusiga ham “AI Suhbat” Web App tugmasi qo‘yiladi.

## API kalitlar
- Gemini: https://aistudio.google.com/apikey
- Groq: https://console.groq.com/keys
- Mistral: https://console.mistral.ai/api-keys/

## Muhim
- Bepul tariflar limitli va provayder shartlari o‘zgarishi mumkin. Limit tugasa tegishli AI xatolik qaytaradi; ilova pullik tarifga avtomatik o‘tmaydi.
- Gemini free tier modelga qarab farq qiladi; default `gemini-2.5-flash`.
- Groq API default modeli `qwen/qwen3.8-27b`.
- Mistral API free tier/experiment access hisobga qarab farq qilishi mumkin; default `mistral-small-latest`.
- Sayt va Telegram bir xil server xotirasini ishlatadi. Render qayta ishga tushsa chat tarixi o‘chadi; doimiy tarix uchun keyinchalik database ulash kerak.
- Telegram Mini App URL HTTPS bo‘lishi shart.
- API kalitlarini GitHub'ga commit qilmang. Faqat Render Environment Variables ichida saqlang.
