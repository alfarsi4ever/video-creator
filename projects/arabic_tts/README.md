# مِداد صوت — Arabic TTS Studio

واجهة عربية لتحويل النص إلى صوت عبر Google Gemini TTS، مع نبرة مستقلة لكل فقرة أو جملة وتنزيل النتيجة بصيغة WAV.

## التشغيل

1. انسخ `.env.example` إلى `.env`.
2. ضع مفتاح Google AI Studio في `GEMINI_API_KEY`.
3. شغّل:

```powershell
npm start
```

ثم افتح `http://127.0.0.1:43127`. اخترنا هذا المنفذ لأن المنفذ `3000` مستخدم حاليًا على الجهاز.

## الحصول على المفتاح

افتح [صفحة مفاتيح Google AI Studio](https://aistudio.google.com/app/apikey)، وسجّل الدخول، ثم اختر **Create API key** وانسخ المفتاح إلى ملف `.env`.

لا تضع المفتاح في ملفات الواجهة أو ترفعه إلى Git. هذا المشروع يرسله إلى Google من الخادم فقط.

## الاختبارات

```powershell
npm test
```

النماذج المستخدمة: `gemini-3.8-flash-tts` و`gemini-3.8-flash-lite-tts`.
