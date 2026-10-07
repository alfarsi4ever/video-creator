import { synthesize, wav } from '/home/user/video-creator/.claude/skills/arabic-explainer-video/lib/gemini-tts.mjs';
import fs from 'node:fs';
const key = process.env.GEMINI_API_KEY;
const { verses } = JSON.parse(fs.readFileSync('poem.json', 'utf8'));
const style = 'بإلقاء شعري بطيء جدًا ومهيب وحزين هادئ، كمن يتأمل، مع وقفة طويلة بين الشطرين، وتمهّل عند القافية';
fs.mkdirSync('vo', { recursive: true });
for (const [i, v] of verses.entries()) {
  if (fs.existsSync(`vo/v${i}.wav`)) continue;
  const pcm = await synthesize({ key, model: 'gemini-3.8-flash-tts', voice: 'Charon', cues: v.map(text => ({ text, style })) });
  fs.writeFileSync(`vo/v${i}.wav`, wav(pcm));
  console.log(i, (pcm.length / 2 / 24000).toFixed(2) + 's');
}
