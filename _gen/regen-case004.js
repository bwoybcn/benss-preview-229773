// Targeted regeneration: case004 hospital corridor — wider architectural framing.
const fs = require('fs');
const https = require('https');
const path = require('path');

const KEY = process.env.GEMINI_KEY;
if (!KEY) { console.error('GEMINI_KEY not set'); process.exit(1); }
const MODEL = 'gemini-2.5-flash-image';

const prompt = `Wide architectural documentary photograph, 16:9 landscape. Interior of a regional Australian public hospital ward corridor at evening. Deep one-point perspective — the corridor recedes clearly into the background with vinyl flooring, ceiling tiles, and soft warm fluorescent overhead lighting. A single hazardous materials consultant is standing in the middle distance of the corridor, approximately one-third of the frame from the left, reaching up toward an overhead ceiling panel with a small clear sample bag. They appear small-to-medium in the composition — occupying roughly 15-20% of the frame width, NOT close to camera. They wear full white Tyvek disposable coverall with hood up, blue P3 respirator over the lower face, disposable nitrile gloves, safety glasses. Side-three-quarter view, face fully obscured by respirator and hood. The rest of the corridor is empty and stretches 8-10 metres beyond the consultant into softly blurred perspective, with subtle blurred hospital signage panels along the walls (non-legible). Muted clinical palette — cool pale greens on the walls, warm greys, cool whites, soft warm overhead light. Fine documentary grain, medium-wide depth of field. Sharp focus on the consultant but corridor context reads clearly on both sides. No text, no readable signage, no logos, no identifying details, no visible faces. Realistic professional editorial documentary photography, wide establishing shot, not close-up, not portrait.`;

const body = JSON.stringify({
  contents: [{ parts: [{ text: prompt }] }],
  generationConfig: { imageConfig: { aspectRatio: '16:9' } }
});

const req = https.request({
  method: 'POST',
  hostname: 'generativelanguage.googleapis.com',
  path: `/v1beta/models/${MODEL}:generateContent`,
  headers: { 'x-goog-api-key': KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
}, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    if (res.statusCode !== 200) { console.log(`FAIL ${res.statusCode}: ${data.slice(0, 400)}`); process.exit(1); }
    const parsed = JSON.parse(data);
    const part = parsed.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (!part) { console.log('no inlineData'); process.exit(1); }
    const buf = Buffer.from(part.inlineData.data, 'base64');
    const OUT = 'D:/BENSS/src/assets/imagery/nano-banana/case004-hospital-ward-corridor.png';
    fs.writeFileSync(OUT, buf);
    const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
    console.log(`OK: ${buf.length} bytes, ${w}x${h}`);
    const yaml = `prompt: |\n  ${prompt.replace(/\n/g, '\n  ')}\nmodel: ${MODEL}\naspect_ratio: "16:9"\ngenerated: ${new Date().toISOString().slice(0, 10)}\nusage: card+hero\ncomposition_note: wide establishing shot, consultant occupies 15-20% of frame\napproved_by: []\n`;
    fs.writeFileSync(OUT.replace('.png', '.meta.yaml'), yaml);
  });
});
req.on('error', e => { console.error(e); process.exit(1); });
req.write(body); req.end();
