export const MODELS = new Set([
  "gemini-3.8-flash-tts",
  "gemini-3.8-flash-lite-tts",
]);

export const VOICES = new Set([
  "Kore",
  "Puck",
  "Charon",
  "Fenrir",
  "Leda",
  "Aoede",
  "Callirrhoe",
  "Gacrux",
  "Achird",
  "Sulafat",
]);

const MAX_SEGMENTS = 40;
const MAX_TEXT_LENGTH = 12_000;

export function validateTtsRequest(body) {
  if (!body || typeof body !== "object") {
    throw new Error("بيانات الطلب غير صالحة.");
  }

  const model = MODELS.has(body.model) ? body.model : "gemini-3.8-flash-tts";
  const voice = VOICES.has(body.voice) ? body.voice : "Kore";
  const segments = Array.isArray(body.segments) ? body.segments : [];

  if (!segments.length) throw new Error("أضف نصًا واحدًا على الأقل.");
  if (segments.length > MAX_SEGMENTS) {
    throw new Error(`الحد الأقصى ${MAX_SEGMENTS} فقرة أو جملة في الطلب الواحد.`);
  }

  const cleanSegments = segments.map((segment) => ({
    text: typeof segment?.text === "string" ? segment.text.trim() : "",
    style: typeof segment?.style === "string" ? segment.style.trim().slice(0, 300) : "",
  }));

  if (cleanSegments.some((segment) => !segment.text)) {
    throw new Error("لا يمكن إرسال فقرة فارغة.");
  }

  const totalLength = cleanSegments.reduce((sum, segment) => sum + segment.text.length, 0);
  if (totalLength > MAX_TEXT_LENGTH) {
    throw new Error(`النص طويل جدًا. الحد الأقصى ${MAX_TEXT_LENGTH.toLocaleString("ar")} حرفًا.`);
  }

  return { model, voice, segments: cleanSegments };
}

export function buildGeminiRequest({ voice, segments }) {
  return {
    contents: [
      {
        role: "user",
        parts: segments.map(({ text, style }) => ({
          text,
          speech_metadata: { style: style || "natural, clear Modern Standard Arabic" },
        })),
      },
    ],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: { voice },
      },
    },
  };
}

export function extractAudio(payload) {
  const part = payload?.candidates?.[0]?.content?.parts?.find(
    (item) => item?.inlineData?.data,
  );
  if (!part?.inlineData?.data) {
    const reason = payload?.promptFeedback?.blockReason;
    throw new Error(reason ? `تعذّر إنشاء الصوت: ${reason}` : "لم تُرجع Google ملفًا صوتيًا.");
  }
  return {
    buffer: Buffer.from(part.inlineData.data, "base64"),
    mimeType: part.inlineData.mimeType || "audio/wav",
  };
}
