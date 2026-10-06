import test from "node:test";
import assert from "node:assert/strict";
import { buildGeminiRequest, extractAudio, validateTtsRequest } from "../lib/tts.js";

test("ينظف الطلب ويستخدم القيم الافتراضية الآمنة", () => {
  const result = validateTtsRequest({
    model: "unknown",
    voice: "unknown",
    segments: [{ text: "  مرحبًا  ", style: "  بهدوء  " }],
  });
  assert.equal(result.model, "gemini-3.8-flash-tts");
  assert.equal(result.voice, "Kore");
  assert.deepEqual(result.segments, [{ text: "مرحبًا", style: "بهدوء" }]);
});

test("يبني جزءًا مستقلًا ونبرة مستقلة لكل فقرة", () => {
  const payload = buildGeminiRequest({
    voice: "Kore",
    segments: [
      { text: "الفقرة الأولى", style: "calm" },
      { text: "الفقرة الثانية", style: "excited" },
    ],
  });
  assert.equal(payload.contents[0].parts.length, 2);
  assert.equal(payload.contents[0].parts[1].speech_metadata.style, "excited");
  assert.equal(payload.generationConfig.speechConfig.voiceConfig.voice, "Kore");
});

test("يرفض الفقرات الفارغة", () => {
  assert.throws(
    () => validateTtsRequest({ segments: [{ text: "  " }] }),
    /فارغة/,
  );
});

test("يفك الملف الصوتي من استجابة Google", () => {
  const encoded = Buffer.from("RIFF-audio").toString("base64");
  const result = extractAudio({
    candidates: [{ content: { parts: [{ inlineData: { data: encoded, mimeType: "audio/wav" } }] } }],
  });
  assert.equal(result.buffer.toString(), "RIFF-audio");
  assert.equal(result.mimeType, "audio/wav");
});
