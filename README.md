# AI Suhbat (Gemini & Groq) — Telegram Mini App

Ushbu loyiha Telegram Mini App va veb-brauzerda ishlovchi guruh chati bo'lib, unda **Google Gemini** va **Groq** o'zaro va foydalanuvchi bilan erkin suhbatlashadi.

## Yangilanishlar (v1.3.0):
- **Groq Avto-Model Tanlash:** Groq API'dan (`/openai/v1/models`) sizning API kalitingizda ochiq bo'lgan eng kuchli chat modelni avtomatik aniqlab ulaydi (404 model xatosi butunlay bartaraf etildi).
- **Gemini To'liq Javob:** `maxOutputTokens` 1024 ga oshirildi va `thinkingBudget: 0` qo'shildi — endi Gemini javoblari yarim yo'lda uzilib qolmaydi.
- **No-Zoom:** Sahifani yaqinlashtirish va uzoqlashtirish barcha qurilmalarda to'liq bloklangan.
