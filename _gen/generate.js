// Nano Banana / Gemini 2.5 Flash Image generator for BENSS mockups.
// Key comes from env var GEMINI_KEY — never written to disk.
const fs = require('fs');
const https = require('https');
const path = require('path');

const KEY = process.env.GEMINI_KEY;
if (!KEY) { console.error('GEMINI_KEY not set'); process.exit(1); }
const CANDIDATE_MODELS = (process.env.MODELS || 'gemini-2.5-flash-image,gemini-2.5-flash-image-preview,gemini-2.0-flash-preview-image-generation').split(',');

const prompts = {
  'hero-consultant-tyvek-ceiling-void': `Editorial documentary photograph, 16:9 landscape aspect ratio. A hazardous materials consultant is standing on a small aluminium step ladder in a modern Australian commercial office corridor, reaching up into an opened suspended-ceiling void. They wear a full-length white Tyvek disposable coverall with the hood up, a soft-blue P3 half-mask respirator covering the lower face, disposable nitrile gloves, and clear safety glasses. They hold a small clear zip-lock sample bag in one gloved hand. Three-quarter rear composition — face is fully obscured by respirator and turned toward the ceiling. Cool clinical overhead fluorescent lighting. Muted colour palette — desaturated cool greys, warm off-white ceiling tiles, subtle blues in the PPE. Fine documentary grain, medium depth of field, sharp focus on the sample bag and gloved hand. No text, no logos, no signage, no visible faces. Realistic professional documentary photography, not illustration, not stock, not cheerful.`,

  'case004-hospital-ward-corridor': `Editorial documentary photograph, 16:9 landscape aspect ratio. Interior of a regional Australian public hospital ward corridor at evening. Soft slightly-warm overhead fluorescent lighting. Vinyl flooring reflects a subtle gleam. Blurred hospital signage panels line the wall — not legible. A hazardous materials consultant stands mid-corridor, reaching up to an overhead ceiling panel with a small acrylic sample bag. They wear a full white Tyvek disposable coverall hood-up, a soft-blue P3 respirator covering the lower face, disposable nitrile gloves, clear safety glasses. Side-profile medium-shot composition, face fully obscured by respirator and hood. Corridor stretches into softly blurred background depth. Muted palette — cool pale greens, warm greys, cool whites. Fine documentary grain. No readable text, no legible signage, no logos, no identifying details, no visible faces. Realistic professional documentary photography.`,

  'case004-hepa-night-sampling': `Editorial documentary photograph, 16:9 landscape aspect ratio. Interior of a hospital plant room at night. A single portable H-class HEPA-filtered negative-pressure extraction unit sits beside a hazardous materials consultant, who works under a bright site-work LED lamp casting hard precise shadows. The consultant wears full white Tyvek coverall hood-up, an orange P3 respirator, disposable nitrile gloves, and safety glasses. They carefully place a small piece of ceiling material into a clear sample bag. Plant room has exposed structural steel, insulated pipes, dark concrete floor. Fine dust particulate suspended in the extraction airflow catches the LED light. Dramatic three-quarter view composition, face fully obscured. Cool palette — cyan-tinted whites, warm halogen accent, dark structural steel, deep black shadow. Fine documentary grain, sharp focus on the sample bag. No text, no logos, no identifying details, no visible faces. Realistic professional documentary photography.`,

  'case007-heritage-warehouse': `Editorial documentary photograph, 16:9 landscape aspect ratio. Interior of a 1930s Australian inner-city warehouse — exposed red brick walls, timber king-post trusses, high clerestory windows, dust motes suspended in shafts of natural daylight. A hazardous materials consultant stands in the middle of the empty industrial hall, tablet in hand, surveying the space. They wear white Tyvek coverall unzipped at the top with hood down, a P3 respirator hung around the neck, hi-vis vest over the coverall, safety glasses. Wide medium-shot composition — consultant small in frame to emphasise the scale and heritage character. Facing away from camera, face not visible. Muted warm palette — terracotta brick, weathered timber, cool daylight streaming through clerestory. Fine documentary grain. No signage, no legible text, no logos, no visible face. Realistic professional documentary photography, not illustration.`,

  'case011-utility-depot-stack': `Editorial documentary photograph, 16:9 landscape aspect ratio. An outdoor Australian utility depot at overcast morning — a modest industrial site with a concrete apron, a small steel emissions stack in the middle distance, service gantry to one side, chain-link boundary fencing. A hazardous materials consultant stands near the base of the stack, holding a small handheld gas sampling probe with an attached tube leading to a sampling pump on their belt. They wear yellow/navy hi-vis coveralls, hard hat with clear safety glasses, a P3 respirator, disposable nitrile gloves. Three-quarter view from behind the consultant, so the stack is centred in the composition and the consultant occupies the lower foreground. Face turned toward the stack, obscured by hard hat. Muted overcast palette — flat grey sky, dark asphalt, hi-vis fabric as the only saturated colour. Fine documentary grain. No text, no logos, no legible signage, no visible face. Realistic professional documentary photography.`
};

function post(model, prompt) {
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { imageConfig: { aspectRatio: '16:9' } }  // v4: proper landscape output
  });
  return new Promise((resolve, reject) => {
    const req = https.request({
      method: 'POST',
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/${model}:generateContent`,
      headers: { 'x-goog-api-key': KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.write(body); req.end();
  });
}

async function pickModel() {
  for (const m of CANDIDATE_MODELS) {
    const res = await post(m, 'ping test — do not generate, this is a probe');
    if (res.status === 200 || res.status === 400) { // 400 = model exists but bad payload; that's fine — model is valid
      console.log(`using model: ${m} (probe status ${res.status})`);
      return m;
    }
    console.log(`  ${m} -> ${res.status}`);
  }
  console.error('no working model found');
  process.exit(1);
}

(async () => {
  const OUT = 'D:/BENSS/src/assets/imagery/nano-banana';
  fs.mkdirSync(OUT, { recursive: true });
  const MODEL = await pickModel();

  const results = [];
  for (const [name, prompt] of Object.entries(prompts)) {
    process.stdout.write(`generating ${name}... `);
    try {
      const { status, data } = await post(MODEL, prompt);
      if (status !== 200) { console.log(`FAIL ${status}`); console.log('  ', data.slice(0, 400)); continue; }
      const parsed = JSON.parse(data);
      const part = parsed.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      if (!part) { console.log(`no inlineData`); console.log('  ', JSON.stringify(parsed).slice(0, 400)); continue; }
      const buf = Buffer.from(part.inlineData.data, 'base64');
      const png = path.join(OUT, `${name}.png`);
      fs.writeFileSync(png, buf);
      console.log(`OK (${buf.length} bytes)`);
      results.push(name);
      const yaml = `prompt: |\n  ${prompt.replace(/\n/g, '\n  ')}\nmodel: ${MODEL}\naspect_ratio: "16:9"\ngenerated: ${new Date().toISOString().slice(0, 10)}\nusage: hero\napproved_by: []\n`;
      fs.writeFileSync(path.join(OUT, `${name}.meta.yaml`), yaml);
    } catch (e) {
      console.log(`error: ${e.message}`);
    }
  }
  console.log(`\n${results.length}/${Object.keys(prompts).length} generated`);
})();
