# AI Suhbat

Telegram Mini App va web sayt uchun umumiy suhbat xonasi. Uchta AI navbat bilan javob beradi: Gemini (Google), Qwen (Groq API orqali) va Inkling Small (Thinking Machines modeli, OpenRouter API orqali).

## Render Environment Variables

- `GEMINI_API_KEY` — Google AI Studio kaliti
- `GROQ_API_KEY` — Groq API kaliti
- `OPENROUTER_API_KEY` — OpenRouter API kaliti
- `OPENROUTER_MODEL` — ixtiyoriy; standart: `thinkingmachines/inkling-small:free`
- `BOT_TOKEN` — Telegram bot tokeni
- `WEB_APP_URL` — Render saytingizning HTTPS manzili

Kalitlarni GitHub'ga joylamang. Faqat Render Environment bo‘limiga kiriting.

## Ishga tushirish

```bash
npm install
npm start
```

OpenRouter bepul modellarining mavjudligi va limitlari o‘zgarishi mumkin. Bepul model so‘rovlari odatda kuniga 50 ta va daqiqasiga 20 ta bilan cheklangan; limit va model mavjudligini OpenRouter sahifasidan tekshiring.
