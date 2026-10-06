import { synthesize, wav } from '/home/user/video-creator/.claude/skills/arabic-explainer-video/lib/gemini-tts.mjs';
import fs from 'node:fs';
const key = process.env.GEMINI_API_KEY;
const lines = ['وزارة العمل.', 'حقوق وواجبات واضحة.', 'وبيئة عمل آمنة.', 'وفرص عمل للجميع.'];
fs.mkdirSync('vo', { recursive: true });
for (const [i, text] of lines.entries()) {
  const pcm = await synthesize({ key, model: 'gemini-3.8-flash-tts', voice: 'Charon', cues: [{ text, style: 'بصوت واثق ودافئ، بإيقاع هادئ' }] });
  fs.writeFileSync(`vo/${i}.wav`, wav(pcm));
  console.log(i, (pcm.length / 2 / 24000).toFixed(2) + 's');
}
