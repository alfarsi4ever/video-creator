// The script of the video. Every string in `say` is one narration line (one TTS clip) and one
// reveal on screen: index.html shows the element marked data-u="<index>" when that line starts.
// Write for the ear: numbers and Latin terms spelled out as they should be pronounced, every line
// ending with a full stop or a question mark. See references/narration.md in the skill.

export const CONFIG = {
  width: 1920, height: 1080,   // TV / desktop. Phone: width: 1080, height: 1920
  voice: "Charon",             // Kore, Puck, Charon, Fenrir, Leda, Aoede, Callirrhoe, Gacrux, Achird, Sulafat
  tempo: 1.08,                 // 1 = as spoken; 1.2 = brisk
  // style: "…",               // default delivery for every line; a line can carry its own: { text, style }
};

export const SCENES = [
  { id: "intro", say: [
    "هذا قالب لفيديو شرح عربي، يُبنى كله بالكود.",
    "اكتب النص، والباقي يتولاه خط الإنتاج.",
  ] },
  { id: "steps", say: [
    "يمر الفيديو بأربع مراحل.",
    "أولاً، النص: كل جملة تُنطق، تقابلها لقطة على الشاشة.",
    "ثانياً، الصوت: طلب واحد يولّد التعليق كله، ثم يُقطَّع جملة جملة.",
    "ثالثاً، التوقيت: مدة كل مقطع صوتي هي التي تحدد متى يظهر كل عنصر.",
    "ورابعاً، التصيير: متصفح يلتقط الإطارات، ثم تُجمع في ملف واحد.",
  ] },
  // A quiz scene needs no markup: question, countdown (CONFIG.countdown, 5 s) and answer are drawn by engine.js.
  // sayQ / sayA are what is spoken, when it should differ from what is shown.
  { id: "quiz1", quiz: {
    q: "ما الذي يحدد توقيت ظهور العناصر على الشاشة؟",
    a: "مدة المقاطع الصوتية",
    ref: "المرحلة الثالثة · التوقيت",
    sayA: "مدة المقاطع الصوتية.",
  } },
  { id: "outro", say: [
    "والآن، استبدل هذا النص بنصك، وابدأ.",
  ] },
];
