const samples = [
  {
    title: "إعلان دافئ",
    description: "انتقال من الهدوء إلى الحماس في رسالة قصيرة.",
    voice: "Sulafat",
    segments: [
      ["كل صباح يحمل فرصة جديدة لنبدأ بشيء نحبّه.", "warm, intimate, calm, speaking slowly"],
      ["واليوم، صارت تلك الفرصة أقرب مما تتخيل!", "joyful, energetic, optimistic"],
    ],
  },
  {
    title: "موجز إخباري",
    description: "قراءة واضحة ومتزنة للمحتوى الرسمي.",
    voice: "Charon",
    segments: [
      ["أهلًا بكم في موجز اليوم. إليكم أبرز الأخبار في دقائق.", "professional news anchor, clear, composed"],
      ["تشير التوقعات إلى أجواء مستقرة، مع فرص لتكوّن السحب مساءً.", "informative, steady pace, articulate"],
    ],
  },
  {
    title: "حكاية قصيرة",
    description: "سرد حميم مع وقفة درامية لطيفة.",
    voice: "Gacrux",
    segments: [
      ["في آخر القرية، كان هناك بابٌ أزرق لم يجرؤ أحد على فتحه.", "gentle, mysterious storytelling, low voice"],
      ["وفي ليلةٍ مقمرة، سمع سالم من خلفه صوتًا ينادي اسمه. <short pause>", "suspenseful, hushed, dramatic"],
    ],
  },
];

const segmentsElement = document.querySelector("#segments");
const template = document.querySelector("#segment-template");
const generateButton = document.querySelector("#generate");
const messageElement = document.querySelector("#message");
const resultElement = document.querySelector("#result");
const audioElement = document.querySelector("#audio");
const downloadElement = document.querySelector("#download");
let audioUrl = null;

function toArabicNumber(value) {
  return String(value).replace(/\d/g, (digit) => "٠١٢٣٤٥٦٧٨٩"[digit]);
}

function updateUI() {
  const cards = [...segmentsElement.querySelectorAll(".segment")];
  cards.forEach((card, index) => {
    card.querySelector(".segment-index").textContent = `المقطع ${toArabicNumber(index + 1)}`;
    card.querySelector(".remove").hidden = cards.length === 1;
  });
  const count = cards.reduce((sum, card) => sum + card.querySelector("textarea").value.length, 0);
  document.querySelector("#char-count").textContent = toArabicNumber(count);
}

function addSegment(text = "", style = "natural, clear, confident Modern Standard Arabic") {
  const card = template.content.firstElementChild.cloneNode(true);
  const textarea = card.querySelector(".segment-text");
  const tone = card.querySelector(".tone");
  const customTone = card.querySelector(".custom-tone");
  textarea.value = text;

  const knownOption = [...tone.options].find((option) => option.value === style);
  if (knownOption) {
    tone.value = style;
  } else {
    tone.value = "custom";
    customTone.hidden = false;
    customTone.value = style;
  }

  textarea.addEventListener("input", updateUI);
  tone.addEventListener("change", () => {
    customTone.hidden = tone.value !== "custom";
    if (!customTone.hidden) customTone.focus();
  });
  card.querySelector(".remove").addEventListener("click", () => {
    card.remove();
    updateUI();
  });
  segmentsElement.append(card);
  updateUI();
}

function loadSample(sample, scroll = true) {
  segmentsElement.replaceChildren();
  sample.segments.forEach(([text, style]) => addSegment(text, style));
  document.querySelector("#voice").value = sample.voice;
  if (scroll) {
    document.querySelector(".workspace").scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

samples.forEach((sample, index) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "sample";
  button.innerHTML = `
    <span class="sample-number">عينة ${toArabicNumber(index + 1)}</span>
    <strong>${sample.title}</strong>
    <p>${sample.description}</p>
    <span class="sample-action">استخدم العينة ←</span>`;
  button.addEventListener("click", () => loadSample(sample));
  document.querySelector("#sample-grid").append(button);
});

document.querySelector("#add-segment").addEventListener("click", () => addSegment());

function showMessage(text) {
  messageElement.textContent = text;
  messageElement.classList.toggle("show", Boolean(text));
}

async function generate() {
  const segments = [...segmentsElement.querySelectorAll(".segment")].map((card) => {
    const tone = card.querySelector(".tone");
    return {
      text: card.querySelector(".segment-text").value,
      style: tone.value === "custom" ? card.querySelector(".custom-tone").value : tone.value,
    };
  });

  if (segments.some((segment) => !segment.text.trim())) {
    showMessage("اكتب نصًا في كل مقطع أو احذف المقطع الفارغ.");
    return;
  }

  generateButton.disabled = true;
  generateButton.querySelector(".button-label").textContent = "جاري هندسة الصوت…";
  showMessage("");
  resultElement.hidden = true;

  try {
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: document.querySelector("#model").value,
        voice: document.querySelector("#voice").value,
        segments,
      }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || "تعذّر إنشاء الملف الصوتي.");
    }
    const blob = await response.blob();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = URL.createObjectURL(blob);
    audioElement.src = audioUrl;
    downloadElement.href = audioUrl;
    resultElement.hidden = false;
    audioElement.play().catch(() => {});
  } catch (error) {
    showMessage(error.message);
  } finally {
    generateButton.disabled = false;
    generateButton.querySelector(".button-label").textContent = "أنشئ الملف الصوتي";
  }
}

generateButton.addEventListener("click", generate);

async function checkStatus() {
  const status = document.querySelector("#api-status");
  try {
    const response = await fetch("/api/status");
    const data = await response.json();
    status.className = `status ${data.configured ? "ready" : "missing"}`;
    status.querySelector("span").textContent = data.configured ? "Google AI متصل" : "المفتاح مطلوب";
  } catch {
    status.className = "status missing";
    status.querySelector("span").textContent = "الخادم غير متصل";
  }
}

loadSample(samples[0], false);
checkStatus();
