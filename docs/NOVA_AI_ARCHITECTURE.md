# NOVA AI — loyiha yo'l xaritasi

Ushbu hujjat `ai-suhbat` loyihasini iPhone uchun ishlaydigan, o'zbek tilini qo'llab-quvvatlaydigan ko'p funksiyali AI agent platformasiga bosqichma-bosqich aylantirish rejasidir.

## Asosiy maqsad

NOVA AI — bitta mobil web ilova ichida suhbat, ovoz, xotira, internetdan izlash, kod bilan ishlash va bir nechta agent hamkorligini birlashtiruvchi yordamchi.

## Hozirgi holat

- Express.js server va statik mobil web interfeys mavjud.
- Gemini va Groq API integratsiyasi mavjud.
- Ovozli xabarni matnga aylantirish va javobni ovozga aylantirish oqimi mavjud.
- Hozirgi suhbatlar server xotirasida saqlanadi; qayta ishga tushganda yo'qolishi mumkin.
- Telegram Web App skripti mavjud, lekin oddiy Safari/PWA rejimi ham alohida tekshirilishi kerak.

## Arxitektura

1. **NOVA Core** — foydalanuvchi so'rovini qabul qiladi, maqsadni aniqlaydi va vazifani rejalashtiradi.
2. **Agent Router** — vazifani Chat, Research, Voice yoki Code agentiga yo'naltiradi.
3. **Provider layer** — Gemini va Groq kabi model provayderlarini yagona interfeys orqali chaqiradi. API kalitlari faqat server muhitida saqlanadi.
4. **Memory layer** — foydalanuvchi roziligi bilan suhbat konteksti va saqlanadigan eslatmalarni boshqaradi.
5. **Tool layer** — faqat aniq ruxsat berilgan vositalar: web qidiruv, GitHub o'qish va kod tahlili. Tashqi tomonga xabar yuborish, faylni o'zgartirish yoki boshqa muhim amallar alohida tasdiq talab qiladi.
6. **iOS PWA UI** — Safari, bosh ekranga qo'shish, safe-area, ovoz yozish va mobil navigatsiya.

## Ishlab chiqish bosqichlari

### 1-bosqich — poydevor
- NOVA AI nomi va mobil interfeys.
- Bitta asosiy chat va agent rejimlari uchun navigatsiya.
- Provider sozlamalari va serverdagi kalitlarni tekshirish.
- Xatolarni tushunarli ko'rsatish.

### 2-bosqich — agent yadrosi
- So'rovni tahlil qilish va bajariladigan reja tuzish.
- Har bir reja bosqichining holatini ko'rsatish.
- Tool chaqiruvlarini allowlist orqali cheklash.
- Muhim tashqi amallardan oldin foydalanuvchi tasdig'ini olish.

### 3-bosqich — xotira
- Suhbat tarixini doimiy saqlash.
- Foydalanuvchi boshqaradigan eslatmalar.
- Xotirani ko'rish, tahrirlash va o'chirish.

### 4-bosqich — ovoz
- iOS Safari mikrofon oqimini sinash.
- O'zbekcha STT/TTS.
- Matnli va ovozli rejimlar o'rtasida uzluksiz o'tish.

### 5-bosqich — tadqiqot va kod agentlari
- Web qidiruv natijalarini manbalari bilan jamlash.
- GitHub repository va fayllarini o'qish/tahlil qilish.
- Kod o'zgarishlarini avval diff sifatida ko'rsatish; yozish faqat tasdiqdan keyin.

### 6-bosqich — multi-agent
- Planner, Researcher, Coder va Reviewer rollari.
- Agentlar o'rtasida vazifa topshirish.
- Yakuniy javobni bitta tushunarli natijaga jamlash.

## Xavfsizlik va ishonchlilik

- API kalitlari brauzerga yuborilmaydi.
- Agent o'zicha xarid, xabar yuborish, repositoryga commit qilish yoki boshqa qaytarib bo'lmaydigan amalni bajarmaydi.
- Tashqi amallar uchun foydalanuvchidan aniq tasdiq olinadi.
- So'rovlar hajmi, tezligi va xarajatlari cheklanadi.
- Birinchi versiya mavjud Gemini/Groq integratsiyasidan foydalanadi; to'liq API-siz ishlash deb va'da qilinmaydi.

## iOS bo'yicha eslatma

Birinchi nishon — Safari orqali ochiladigan va Home Screen'ga qo'shiladigan PWA. Mikrofon, audio ijrosi va fon rejimi iOS versiyasi hamda brauzer cheklovlariga bog'liq; haqiqiy iPhone'da sinov shart.
