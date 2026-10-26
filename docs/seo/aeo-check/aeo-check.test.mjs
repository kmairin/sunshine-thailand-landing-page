// Run: node --test docs/seo/aeo-check/
import test from 'node:test';
import assert from 'node:assert/strict';
import { analyse, hostOf, normaliseSources, topDomains } from './aeo-check.mjs';

const src = (url, cited = true) => ({ url, title: '', cited });
const t = (a, id) => a.targets[id];

test('empty answer names nobody', () => {
  const a = analyse('', []);
  assert.equal(a.verdict, 'none');
  assert.equal(t(a, 'site').in_answer, false);
});

test('our site as a cited source is detected', () => {
  const a = analyse('Some answer.', [src('https://sunshine-wash-and-dry.cclaundrysystem.com/wash-dry-fold/')]);
  assert.equal(a.verdict, 'site_cited');
  assert.equal(t(a, 'site').in_sources, true);
});

test('look-alike domains do not match', () => {
  const a = analyse('see sunshine-wash-and-dry.cclaundrysystem.com.evil.com', [src('https://cclaundrysystem.com/')]);
  assert.equal(t(a, 'site').in_answer, false);
  assert.equal(t(a, 'site').in_sources, false);
});

test('site at the end of a sentence still matches', () => {
  const a = analyse('Website: sunshine-wash-and-dry.cclaundrysystem.com.', []);
  assert.equal(t(a, 'site').in_answer, true);
  assert.equal(a.verdict, 'site_in_text');
});

test('full shop name in Thai or English is a name hit', () => {
  assert.equal(t(analyse('ลองไปที่ Sunshine ซัก+อบ บางโฉลง', []), 'sunshine_name').in_answer, true);
  const a = analyse('Sunshine Wash & Dry is open 24 hours.', []);
  assert.equal(t(a, 'sunshine_name').in_answer, true);
  assert.equal(a.verdict, 'name_only');
});

test('another "Sunshine" laundry is only a maybe', () => {
  const a = analyse('Sunshine Wash ม.นเรศวร is a laundromat in Phitsanulok.', []);
  assert.equal(t(a, 'sunshine_name').in_answer, false);
  assert.equal(t(a, 'sunshine_name').maybe_in_answer, true);
  assert.equal(a.verdict, 'maybe');
});

test('LINE link counts as ours', () => {
  const a = analyse('x', [src('https://lin.ee/V77IMtH')]);
  assert.equal(t(a, 'line').in_sources, true);
});

test('hostOf strips www and survives junk', () => {
  assert.equal(hostOf('https://www.Example.com/a?b=1'), 'example.com');
  assert.equal(hostOf('not a url'), '');
});

test('normaliseSources dedupes by url and keeps cited if any copy was cited', () => {
  const n = normaliseSources([
    { url: 'https://a.com/x', title: 'A', cited: false },
    { url: 'https://a.com/x', title: '', cited: true },
    { url: 'junk' },
  ]);
  assert.equal(n.length, 1);
  assert.equal(n[0].cited, true);
  assert.equal(n[0].title, 'A');
});

test('topDomains counts each domain once per question', () => {
  const top = topDomains([
    [src('https://a.com/1'), src('https://a.com/2'), src('https://b.com/1')],
    [src('https://a.com/3')],
  ]);
  assert.deepEqual(top[0], { host: 'a.com', questions: 2 });
});

// ---- engine parsers, fed canned responses (no network, no keys) ----

function stubFetch(routes) {
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const hit = routes.find(([m]) => String(url).includes(m));
    if (!hit) throw new Error(`unexpected fetch ${url}`);
    return hit[1](url, init);
  };
  return () => { globalThis.fetch = real; };
}
const json = (body, headers = {}) => ({ ok: true, status: 200, text: async () => JSON.stringify(body), headers: { get: (k) => headers[k.toLowerCase()] ?? null } });

test('anthropic parser: text, cited sources, retrieved sources, pause_turn continuation', async () => {
  const { ENGINES } = await import('./aeo-check.mjs');
  process.env.ANTHROPIC_API_KEY = 'test';
  let calls = 0;
  const restore = stubFetch([['api.anthropic.com', async (_u, init) => {
    calls++;
    const body = JSON.parse(init.body);
    assert.equal(body.tools[0].type, 'web_search_20260209');
    if (calls === 1) {
      return json({ stop_reason: 'pause_turn', content: [
        { type: 'server_tool_use', id: 's1', name: 'web_search', input: { query: 'x' } },
        { type: 'web_search_tool_result', tool_use_id: 's1', content: [{ type: 'web_search_result', url: 'https://sv-academy.org/', title: 'SV Academy' }] },
      ] });
    }
    assert.equal(body.messages.length, 2); // original question + assistant content so far
    return json({ stop_reason: 'end_turn', content: [
      { type: 'text', text: 'Try SV Academy.', citations: [{ type: 'web_search_result_location', url: 'https://example.com/a', title: 'A' }] },
    ] });
  }]]);
  try {
    const out = await ENGINES.anthropic.ask('q');
    assert.equal(out.answer, 'Try SV Academy.');
    const urls = out.sources.map((s) => [s.url, s.cited]);
    assert.deepEqual(urls, [['https://sv-academy.org/', false], ['https://example.com/a', true]]);
    assert.equal(calls, 2);
  } finally { restore(); }
});

test('perplexity parser', async () => {
  const { ENGINES } = await import('./aeo-check.mjs');
  process.env.PERPLEXITY_API_KEY = 'test';
  const restore = stubFetch([['perplexity.ai', async () => json({ choices: [{ message: { content: 'ans' } }], citations: ['https://a.com/1'], search_results: [{ title: 'T', url: 'https://a.com/1' }] })]]);
  try {
    const out = await ENGINES.perplexity.ask('q');
    assert.equal(out.answer, 'ans');
    assert.equal(normaliseSources(out.sources).length, 1);
  } finally { restore(); }
});

test('openai parser', async () => {
  const { ENGINES } = await import('./aeo-check.mjs');
  process.env.OPENAI_API_KEY = 'test';
  const restore = stubFetch([['api.openai.com', async () => json({ output: [{ type: 'web_search_call' }, { type: 'message', content: [{ type: 'output_text', text: 'hello', annotations: [{ type: 'url_citation', url: 'https://b.com/x', title: 'B' }] }] }] })]]);
  try {
    const out = await ENGINES.openai.ask('q');
    assert.equal(out.answer, 'hello');
    assert.equal(out.sources[0].url, 'https://b.com/x');
  } finally { restore(); }
});

test('gemini parser follows the redirect and falls back to the title as host', async () => {
  const { ENGINES } = await import('./aeo-check.mjs');
  process.env.GEMINI_API_KEY = 'test';
  const restore = stubFetch([
    ['generativelanguage.googleapis.com', async () => json({ candidates: [{ content: { parts: [{ text: 'g' }] }, groundingMetadata: { groundingChunks: [
      { web: { uri: 'https://vertexaisearch.cloud.google.com/r/1', title: 'resolved.com' } },
      { web: { uri: 'https://vertexaisearch.cloud.google.com/r/2', title: 'stuck.com' } },
    ] } }] })],
    ['vertexaisearch.cloud.google.com/r/1', async () => json({}, { location: 'https://resolved.com/page' })],
    ['vertexaisearch.cloud.google.com/r/2', async () => json({}, {})],
  ]);
  try {
    const out = await ENGINES.gemini.ask('q');
    assert.equal(out.sources[0].url, 'https://resolved.com/page');
    assert.equal(out.sources[1].host, 'stuck.com');
    assert.equal(topDomains([normaliseSources(out.sources)]).map((d) => d.host).sort().join(), 'resolved.com,stuck.com');
  } finally { restore(); }
});
