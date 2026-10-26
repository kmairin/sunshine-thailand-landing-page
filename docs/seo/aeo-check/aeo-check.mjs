#!/usr/bin/env node
// Monthly AEO check: asks answer engines our target questions and records whether
// Sunshine Wash & Dry (Bang Chalong, Bang Phli) is named or cited, and who is cited instead.
// No dependencies. Needs Node 20+ (global fetch). See README.md.
//
//   node docs/seo/aeo-check/aeo-check.mjs                 run every engine that has a key
//   node docs/seo/aeo-check/aeo-check.mjs --engines anthropic
//   node docs/seo/aeo-check/aeo-check.mjs --import file.json   analyse answers captured by hand
//   node docs/seo/aeo-check/aeo-check.mjs --summarize 2026-10-15   rebuild a summary only
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RESULTS = path.join(HERE, 'results');

// ---------------------------------------------------------------- what we look for

// `text` runs on the answer text. `url` runs on each source URL.
// A name alone is weaker evidence than a link (other shops are called "Sunshine"),
// so names and links are reported separately.
export const TARGETS = [
  // Strict: the full shop name. Loose: "Sunshine" next to laundry words, which can also be
  // another shop (e.g. "Sunshine Wash" in Phitsanulok), so it is only a "maybe".
  { id: 'sunshine_name', label: 'Sunshine Wash & Dry', kind: 'name',
    text: /Sunshine\s*(?:Wash\s*(?:&|and|&amp;)\s*Dry|ซัก\s*\+\s*อบ)/i,
    loose: /Sunshine[^.\n]{0,40}(?:ซัก|laund|wash)/i },
  { id: 'site', label: 'sunshine-wash-and-dry.cclaundrysystem.com', kind: 'site',
    text: /(?<![\w-])sunshine-wash-and-dry\.cclaundrysystem\.com(?![\w-]|\.[a-z])/i,
    url: /^https?:\/\/sunshine-wash-and-dry\.cclaundrysystem\.com(?![\w-]|\.[a-z])/i },
  { id: 'line', label: 'LINE lin.ee/V77IMtH', kind: 'site',
    text: /lin\.ee\/V77IMtH/i,
    url: /^https?:\/\/lin\.ee\/V77IMtH/i },
];

export function hostOf(url) {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; }
}

export function normaliseSources(list) {
  const byUrl = new Map();
  for (const s of list || []) {
    if (!s || !hostOf(s.url)) continue;
    const prev = byUrl.get(s.url);
    if (prev) {
      prev.cited = prev.cited || !!s.cited;
      prev.title = prev.title || s.title || '';
    } else {
      byUrl.set(s.url, { url: s.url, title: s.title || '', cited: !!s.cited, ...(s.host ? { host: s.host } : {}) });
    }
  }
  return [...byUrl.values()];
}

export function analyse(answer, sources) {
  const text = answer || '';
  const srcs = sources || [];
  const targets = {};
  for (const t of TARGETS) {
    const in_answer = t.text.test(text);
    const maybe_in_answer = !in_answer && !!t.loose && t.loose.test(text);
    const hits = t.url ? srcs.filter((s) => t.url.test(s.url)) : [];
    targets[t.id] = { label: t.label, in_answer, maybe_in_answer, in_sources: hits.length > 0, source_urls: hits.map((s) => s.url) };
  }
  const sites = TARGETS.filter((t) => t.kind === 'site');
  const names = TARGETS.filter((t) => t.kind === 'name');
  let verdict = 'none';
  if (sites.some((t) => targets[t.id].in_sources)) verdict = 'site_cited';
  else if (sites.some((t) => targets[t.id].in_answer)) verdict = 'site_in_text';
  else if (names.some((t) => targets[t.id].in_answer)) verdict = 'name_only';
  else if (names.some((t) => targets[t.id].maybe_in_answer)) verdict = 'maybe';
  return { targets, verdict };
}

/** Domains by number of questions they appear in. `perQuestionSources` is an array of source arrays. */
export function topDomains(perQuestionSources, limit = 10) {
  const counts = new Map();
  for (const srcs of perQuestionSources) {
    const seen = new Set(srcs.map((s) => s.host || hostOf(s.url)).filter(Boolean));
    for (const h of seen) counts.set(h, (counts.get(h) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([host, questions]) => ({ host, questions }))
    .sort((a, b) => b.questions - a.questions) // stable: ties keep the order the engine returned them
    .slice(0, limit);
}

// ---------------------------------------------------------------- engines

async function httpJson(url, { headers, body, tries = 3 }) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(240_000) });
      const raw = await res.text();
      if (res.ok) return JSON.parse(raw);
      last = new Error(`HTTP ${res.status}: ${raw.slice(0, 300)}`);
      if (res.status !== 429 && res.status < 500) throw last;
    } catch (e) {
      last = e;
      if (/HTTP 4\d\d/.test(String(e.message)) && !/HTTP 429/.test(String(e.message))) throw e;
    }
    await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
  }
  throw last;
}

// Claude with the server-side web search tool. This is the one engine the check requires.
async function askAnthropic(question) {
  const model = process.env.AEO_ANTHROPIC_MODEL || 'claude-opus-5-5';
  const headers = { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' };
  const blocks = [];
  for (let turn = 0; turn < 4; turn++) {
    const messages = [{ role: 'user', content: question }];
    if (blocks.length) messages.push({ role: 'assistant', content: blocks });
    const res = await httpJson('https://api.anthropic.com/v1/messages', {
      headers,
      body: { model, max_tokens: 8000, output_config: { effort: 'low' }, tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5 }], messages },
    });
    blocks.push(...res.content);
    if (res.stop_reason !== 'pause_turn') break;
  }
  const answer = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('');
  const sources = [];
  const walk = (o) => {
    if (Array.isArray(o)) return o.forEach(walk);
    if (!o || typeof o !== 'object') return;
    if (o.type === 'web_search_result' && o.url) sources.push({ url: o.url, title: o.title, cited: false });
    Object.values(o).forEach(walk);
  };
  for (const b of blocks) {
    if (b.type === 'text') {
      for (const c of b.citations || []) if (c.url) sources.push({ url: c.url, title: c.title, cited: true });
    } else {
      walk(b);
    }
  }
  return { model, answer, sources };
}

async function askPerplexity(question) {
  const model = process.env.AEO_PERPLEXITY_MODEL || 'sonar';
  const res = await httpJson('https://api.perplexity.ai/chat/completions', {
    headers: { authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}` },
    body: { model, messages: [{ role: 'user', content: question }] },
  });
  const sources = (res.search_results || []).map((s) => ({ url: s.url, title: s.title, cited: true }));
  for (const u of res.citations || []) sources.push({ url: u, cited: true });
  return { model, answer: res.choices?.[0]?.message?.content || '', sources };
}

async function askOpenAI(question) {
  const model = process.env.AEO_OPENAI_MODEL || 'gpt-5';
  const res = await httpJson('https://api.openai.com/v1/responses', {
    headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: { model, input: question, tools: [{ type: 'web_search' }] },
  });
  let answer = '';
  const sources = [];
  for (const item of res.output || []) {
    if (item.type !== 'message') continue;
    for (const c of item.content || []) {
      if (c.type !== 'output_text') continue;
      answer += c.text;
      for (const a of c.annotations || []) if (a.type === 'url_citation' && a.url) sources.push({ url: a.url, title: a.title, cited: true });
    }
  }
  return { model, answer, sources };
}

// Gemini hands back redirect links; follow one hop to learn the real address.
async function resolveRedirect(uri) {
  try {
    const r = await fetch(uri, { redirect: 'manual', signal: AbortSignal.timeout(10_000) });
    return r.headers.get('location') || uri;
  } catch { return uri; }
}
async function askGemini(question) {
  const model = process.env.AEO_GEMINI_MODEL || 'gemini-2.5-flash';
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const res = await httpJson(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    headers: { 'x-goog-api-key': key },
    body: { contents: [{ parts: [{ text: question }] }], tools: [{ google_search: {} }] },
  });
  const cand = res.candidates?.[0];
  const answer = (cand?.content?.parts || []).map((p) => p.text || '').join('');
  const sources = [];
  for (const ch of cand?.groundingMetadata?.groundingChunks || []) {
    if (!ch.web?.uri) continue;
    const url = await resolveRedirect(ch.web.uri);
    sources.push({ url, title: ch.web.title, cited: true, ...(url === ch.web.uri && ch.web.title ? { host: ch.web.title.toLowerCase() } : {}) });
  }
  return { model, answer, sources };
}

export const ENGINES = {
  anthropic: { label: 'Claude with web search (Anthropic API)', keys: ['ANTHROPIC_API_KEY'], ask: askAnthropic },
  perplexity: { label: 'Perplexity (Sonar)', keys: ['PERPLEXITY_API_KEY'], ask: askPerplexity },
  openai: { label: 'ChatGPT with web search (OpenAI API)', keys: ['OPENAI_API_KEY'], ask: askOpenAI },
  gemini: { label: 'Gemini with Google Search grounding', keys: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'], ask: askGemini },
};
const hasKey = (e) => e.keys.some((k) => process.env[k]);
const missingKeyText = (e) => `no ${e.keys.join(' or ')} on this machine`;

// ---------------------------------------------------------------- running and saving

function loadQuestions(file) {
  return JSON.parse(fs.readFileSync(file || path.join(HERE, 'questions.json'), 'utf8'));
}

function record(q, out, error) {
  const sources = normaliseSources(out?.sources);
  return { id: q.id, lang: q.lang, question: q.text, answer: out?.answer || '', sources, analysis: analyse(out?.answer, sources), ...(error ? { error: String(error.message || error) } : {}) };
}

async function pool(items, size, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  }));
  return out;
}

async function runEngine(id, questions) {
  const engine = ENGINES[id];
  const started_at = new Date().toISOString();
  let model = '';
  const results = await pool(questions, 3, async (q) => {
    try {
      const out = await engine.ask(q.text);
      model = out.model || model;
      console.error(`  ${id} ${q.id} ok (${out.sources.length} sources)`);
      return record(q, out);
    } catch (e) {
      console.error(`  ${id} ${q.id} FAILED: ${String(e.message).slice(0, 200)}`);
      return record(q, null, e);
    }
  });
  return { schema: 1, engine: id, label: engine.label, model, method: 'api', started_at, finished_at: new Date().toISOString(), results };
}

function importFile(file, questions) {
  const src = JSON.parse(fs.readFileSync(file, 'utf8'));
  const byText = new Map(questions.map((q) => [q.text, q]));
  const results = src.items.map((it) => {
    const q = byText.get(it.question);
    if (!q) throw new Error(`Imported question not in questions.json: ${it.question}`);
    return record(q, { answer: it.answer, sources: it.sources });
  });
  const missing = questions.filter((q) => !results.some((r) => r.id === q.id));
  if (missing.length) throw new Error(`Import is missing: ${missing.map((q) => q.text).join(', ')}`);
  results.sort((a, b) => a.id.localeCompare(b.id));
  return { schema: 1, engine: src.engine, label: src.label || src.engine, model: src.model || '', method: src.method || 'import', started_at: src.captured_at, finished_at: src.captured_at, note: src.note, results };
}

function writeResult(date, data) {
  fs.mkdirSync(RESULTS, { recursive: true });
  const file = path.join(RESULTS, `${date}-${data.engine}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  return file;
}

// ---------------------------------------------------------------- the plain-English summary

const VERDICT_WORDS = {
  site_cited: 'Yes, our site is listed as a source',
  site_in_text: 'Yes, our site is named in the answer',
  name_only: 'Name only, no link (check it is us)',
  maybe: 'Maybe, see answer text',
  none: 'No',
};
const isNamed = (v) => v === 'site_cited' || v === 'site_in_text';

function previousRun(engine, date) {
  const files = fs.existsSync(RESULTS) ? fs.readdirSync(RESULTS).filter((f) => f.endsWith(`-${engine}.json`) && f.slice(0, 10) < date).sort() : [];
  const f = files.pop();
  return f ? { date: f.slice(0, 10), data: JSON.parse(fs.readFileSync(path.join(RESULTS, f), 'utf8')) } : null;
}

export function buildSummary(date, runs) {
  const L = [];
  L.push(`# Are we named in AI answers? Check of ${date}`, '');
  L.push('We asked each question below to the engines listed. "Named" means our own website or profile page appears, either in the answer text or in the list of sources the engine used.', '');
  L.push('## What was checked', '');
  for (const e of Object.keys(ENGINES)) {
    const run = runs.find((r) => r.engine === e);
    if (run) L.push(`- **${run.label}**: checked${run.method === 'import' ? ` (answers were collected by hand, see note below)` : ''}${run.model ? `, model ${run.model}` : ''}.`);
    else L.push(`- **${ENGINES[e].label}**: skipped, ${hasKey(ENGINES[e]) ? 'not run this time' : missingKeyText(ENGINES[e])}.`);
  }
  for (const run of runs.filter((r) => !ENGINES[r.engine])) L.push(`- **${run.label}**: checked, ${run.method === 'import' ? 'answers collected by hand' : run.method}${run.model ? `, model ${run.model}` : ''}.`);
  L.push('');
  for (const run of runs) {
    const rs = run.results;
    const n = rs.length;
    const named = rs.filter((r) => isNamed(r.analysis.verdict)).length;
    const nameOnly = rs.filter((r) => r.analysis.verdict === 'name_only' || r.analysis.verdict === 'maybe').length;
    const failed = rs.filter((r) => r.error).length;
    L.push(`## ${run.label}`, '');
    L.push(`**Our website was named in ${named} of ${n} questions.**${nameOnly ? ` In ${nameOnly} more, only a name (no link) showed up; check those by hand.` : ''}${failed ? ` ${failed} question(s) failed to run.` : ''}`, '');
    if (run.note) L.push(`Note: ${run.note}`, '');
    const prev = previousRun(run.engine, date);
    if (prev) {
      const pNamed = prev.data.results.filter((r) => isNamed(r.analysis.verdict)).length;
      L.push(`Last time (${prev.date}): ${pNamed} of ${prev.data.results.length}. ${named > pNamed ? 'Better.' : named < pNamed ? 'Worse.' : 'No change.'}`, '');
    } else {
      L.push('This is the first run, so it is the baseline. Nothing to compare with yet.', '');
    }
    L.push('| # | Question | Named? | Sites that showed up instead (top 3) |', '|---|---|---|---|');
    for (const r of rs) {
      const top = topDomains([r.sources], 3).map((d) => d.host).join(', ') || (r.error ? `error: ${r.error.slice(0, 60)}` : 'no sources returned');
      L.push(`| ${r.id.replace('q', '')} | ${r.question} | ${VERDICT_WORDS[r.analysis.verdict]} | ${top} |`);
    }
    L.push('');
    const win = topDomains(rs.map((r) => r.sources), 10);
    L.push('Sites that appear for the most questions (who is winning instead of us):', '');
    win.forEach((d) => L.push(`- ${d.host}: ${d.questions} of ${n} questions`));
    L.push('');
  }
  L.push('## How to read this', '');
  L.push('- "Our site is listed as a source" is the strongest result: the engine used our page.');
  L.push('- "Name only" means the answer says Sunshine Wash & Dry or Sunshine ซัก+อบ without linking to our site. "Maybe" means only the word Sunshine near laundry words: other shops use that name, so read the answer in the JSON file before counting it.');
  L.push('- The full answer text and every source link are in the matching `.json` file in this folder.');
  L.push('');
  return L.join('\n');
}

function writeSummary(date) {
  const files = fs.readdirSync(RESULTS).filter((f) => f.startsWith(date + '-') && f.endsWith('.json')).sort();
  const runs = files.map((f) => JSON.parse(fs.readFileSync(path.join(RESULTS, f), 'utf8')));
  const out = path.join(RESULTS, `${date}-summary.md`);
  const notes = path.join(RESULTS, `${date}-notes.md`);
  let md = buildSummary(date, runs);
  if (fs.existsSync(notes)) md += '\n' + fs.readFileSync(notes, 'utf8').trim() + '\n';
  fs.writeFileSync(out, md);
  return out;
}

// ---------------------------------------------------------------- command line

function parseArgs(argv) {
  const a = { engines: null, import: null, date: null, summarize: null, questions: null, only: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--engines') a.engines = argv[++i].split(',');
    else if (k === '--import') a.import = argv[++i];
    else if (k === '--date') a.date = argv[++i];
    else if (k === '--summarize') a.summarize = argv[++i];
    else if (k === '--questions') a.questions = argv[++i];
    else if (k === '--only') a.only = argv[++i].split(',');
    else if (k === '--help' || k === '-h') { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 9).join('\n').replace(/^\/\/ ?/gm, '')); process.exit(0); }
    else throw new Error(`Unknown option ${k}`);
  }
  return a;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.summarize) { console.log(writeSummary(args.summarize)); return; }
  const date = args.date || new Date().toLocaleDateString('en-CA');
  let questions = loadQuestions(args.questions);
  if (args.only) questions = questions.filter((q) => args.only.includes(q.id));

  if (args.import) {
    const file = writeResult(date, importFile(args.import, questions));
    console.log(file);
    console.log(writeSummary(date));
    return;
  }

  const wanted = args.engines || Object.keys(ENGINES);
  const unknown = wanted.filter((e) => !ENGINES[e]);
  if (unknown.length) throw new Error(`Unknown engine: ${unknown.join(', ')}. Known: ${Object.keys(ENGINES).join(', ')}`);
  const runnable = wanted.filter((e) => hasKey(ENGINES[e]));
  for (const e of wanted.filter((x) => !runnable.includes(x))) console.error(`Skipping ${e}: ${missingKeyText(ENGINES[e])}`);
  if (!runnable.length) {
    console.error('\nNo engine has a key, so nothing was run. Set ANTHROPIC_API_KEY (the minimum) and try again. See README.md.');
    process.exit(2);
  }
  for (const e of runnable) {
    console.error(`Running ${e} on ${questions.length} questions...`);
    console.log(writeResult(date, await runEngine(e, questions)));
  }
  console.log(writeSummary(date));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e.message || e); process.exit(1); });
}
