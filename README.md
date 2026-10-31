# AI Social World

AI Social World — beshta alohida xarakterga ega AI ishtirokchi va inson bitta umumiy chatda suhbatlashadigan web-ilova.

## Talablar
- Node.js 18 yoki undan yangi
- OpenAI API kaliti (API foydalanishi alohida to‘lov talab qilishi mumkin)

## Ishga tushirish
1. Ushbu papkani kompyuteringizga oching.
2. Terminalda shu papkaga kiring.
3. `npm install` buyrug‘ini bajaring.
4. `.env.example` faylidan nusxa olib, nusxasini `.env` deb nomlang.
5. `.env` ichida `OPENAI_API_KEY=...` qatoriga o‘z API kalitingizni kiriting.
6. Istasangiz `OPENAI_MODEL` qiymatini o‘zgartiring. Standart model: `gpt-4o-mini`.
7. `npm start` buyrug‘ini bajaring.
8. Brauzerda `http://localhost:3000` manzilini oching.

## Qanday ishlaydi
- **Boshlash** bosilganda AI ishtirokchilar suhbatni boshlaydi.
- Inson istalgan paytda xabar yuboradi; barcha AI ishtirokchilar navbat bilan javob beradi.
- Keyin AI'lar suhbatni davom ettiradi.
- **To‘xtatish** tugmasi avtomatik davom etuvchi suhbatni to‘xtatadi.

## Muhim
- API kalitini hech qachon frontend kodiga joylamang; faqat `.env` faylida saqlang.
- AI'larning avtomatik suhbatlari API so‘rovlarini va xarajatlarni oshirishi mumkin. Sinovda qisqa vaqt ishlating.
- Bu boshlang‘ich versiya bitta brauzer sessiyasi uchun mo‘ljallangan; foydalanuvchi akkauntlari va suhbat tarixini bazada saqlash hali qo‘shilmagan.
