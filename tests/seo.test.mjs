// SEO guard rails for the static site. Run: node --test
// Each check protects something a later copy edit could silently undo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const ORIGIN = 'https://sunshine-wash-and-dry.cclaundrysystem.com';

// URL path -> file on disk
const PAGES = {
  '/': 'index.html',
  '/en/': 'en/index.html',
  '/wash-dry-fold/': 'wash-dry-fold/index.html',
  '/en/wash-dry-fold/': 'en/wash-dry-fold/index.html',
  '/comforter-wash/': 'comforter-wash/index.html',
  '/en/comforter-wash/': 'en/comforter-wash/index.html',
};

const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const exists = (f) => fs.existsSync(path.join(ROOT, f));
const decode = (s) => s
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/\s+/g, ' ').trim();
const chars = (s) => [...s].length;
const meta = (html, name) => (html.match(new RegExp(`<meta name="${name}" content="([^"]*)"`)) || [])[1];
const title = (html) => decode((html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '');
const h1 = (html) => decode((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || '');
const jsonLd = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
  .map((m) => JSON.parse(m[1]));
const alternates = (html) => Object.fromEntries(
  [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => [m[1], m[2]]));

test('every page exists', () => {
  for (const [url, file] of Object.entries(PAGES)) assert.ok(exists(file), `${url} -> ${file} missing`);
});

for (const [url, file] of Object.entries(PAGES)) {
  test(`${url}: title, description, h1, canonical`, () => {
    const html = read(file);
    const t = title(html);
    const d = decode(meta(html, 'description') || '');
    assert.ok(t, 'no title');
    assert.ok(chars(t) <= 60, `title ${chars(t)} chars: ${t}`);
    assert.ok(d, 'no meta description');
    assert.ok(chars(d) <= 155, `description ${chars(d)} chars: ${d}`);
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, 'exactly one h1');
    assert.ok(html.includes(`<link rel="canonical" href="${ORIGIN}${url}" />`), 'canonical to itself');
    assert.equal((html.match(/<html lang="([^"]+)"/) || [])[1], url.startsWith('/en/') ? 'en' : 'th');
    assert.ok(html.includes('google-site-verification') || url !== '/', 'home keeps Google verification tag');
    assert.ok(html.includes('msvalidate.01') || url !== '/', 'home keeps Bing verification tag');
  });

  test(`${url}: JSON-LD parses and visible FAQ matches FAQPage`, () => {
    const html = read(file);
    const blocks = jsonLd(html);
    assert.ok(blocks.length >= 1, 'no JSON-LD');
    const faq = blocks.find((b) => b['@type'] === 'FAQPage');
    const visible = [...html.matchAll(/<details class="faq-item"><summary>([\s\S]*?)<\/summary>/g)].map((m) => decode(m[1]));
    if (!faq) {
      assert.equal(visible.length, 0, 'visible FAQ without FAQPage');
      return;
    }
    const names = faq.mainEntity.map((q) => q.name);
    assert.deepEqual(names, visible, 'FAQPage questions must equal the visible FAQ, same order');
  });

  test(`${url}: hreflang th/en/x-default point both ways`, () => {
    const alt = alternates(read(file));
    assert.ok(alt.th && alt.en && alt['x-default'], 'missing hreflang');
    for (const lang of ['th', 'en']) {
      const other = alt[lang].replace(ORIGIN, '');
      assert.ok(PAGES[other], `hreflang ${lang} -> unknown ${other}`);
      const back = alternates(read(PAGES[other]));
      assert.equal(back.th, alt.th);
      assert.equal(back.en, alt.en);
    }
  });
}

test('sitemap lists every page and nothing else, no made-up lastmod', () => {
  const xml = read('sitemap.xml');
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(ORIGIN, ''));
  assert.deepEqual([...locs].sort(), Object.keys(PAGES).sort());
  assert.ok(!xml.includes('<lastmod>'), 'drop lastmod unless it is a real edit date');
});

test('robots.txt names the sitemap', () => {
  assert.match(read('robots.txt'), new RegExp(`Sitemap: ${ORIGIN}/sitemap.xml`));
});

test('weekend wash-dry-fold page targets the phrases people type', () => {
  const html = read(PAGES['/wash-dry-fold/']);
  const t = title(html);
  const head = h1(html);
  const lead = decode((html.match(/<p class="lead">([\s\S]*?)<\/p>/) || [])[1] || '');
  assert.match(t, /ซักอบพับ/);
  assert.match(t, /เสาร์/);
  assert.match(head, /ซักอบพับ/);
  assert.match(head, /เสาร์/);
  assert.match(head, /อาทิตย์/);
  assert.match(lead, /ฝากซักผ้า/);
  assert.match(lead, /9:00/);
  assert.match(lead, /20:00/);
  const types = JSON.stringify(jsonLd(html));
  assert.match(types, /"Service"/);
  assert.match(types, /"Saturday"/);
  assert.match(types, /"Sunday"/);
});

test('comforter page targets ซักผ้านวม and quotes real prices', () => {
  const html = read(PAGES['/comforter-wash/']);
  assert.match(title(html), /ซักผ้านวม/);
  assert.match(h1(html), /ซักผ้านวม/);
  assert.match(html, /18 กก\./);
  // Prices on the page must match the price table on the home page.
  for (const p of ['60', '70', '80']) assert.match(html, new RegExp(`${p} บาท`));
});

test('home page leads with the most-searched wording (Google Trends: ร้านซักผ้า)', () => {
  const html = read('index.html');
  assert.match(title(html), /^ร้านซักผ้า/);
  assert.match(h1(html), /ร้านซักผ้า/);
  assert.match(h1(html), /ร้านสะดวกซัก/);
});

test('home page links to both service pages in raw HTML', () => {
  const html = read('index.html');
  assert.ok(html.includes('href="/wash-dry-fold/"'));
  assert.ok(html.includes('href="/comforter-wash/"'));
  const en = read('en/index.html');
  assert.ok(en.includes('href="/en/wash-dry-fold/"'));
  assert.ok(en.includes('href="/en/comforter-wash/"'));
});

test('llms.txt summarises the shop for AI engines', () => {
  assert.ok(exists('llms.txt'), 'llms.txt missing');
  const t = read('llms.txt');
  for (const s of ['Sunshine Wash & Dry', '168', 'บางโฉลง', '24', '9:00', '20:00', '50', '092-272-0955', '/wash-dry-fold/', '/comforter-wash/']) {
    assert.ok(t.includes(s), `llms.txt missing "${s}"`);
  }
});

// Tracking files in docs/seo/tracking are edited by hand each month; keep them parseable.
const csv = (f) => read(f).trim().split('\n').map((l) => l.split(','));

test('rankings.csv rows are well formed', () => {
  const [head, ...rows] = csv('docs/seo/tracking/rankings.csv');
  assert.deepEqual(head, ['date', 'surface', 'term', 'position', 'note']);
  assert.ok(rows.length > 0);
  for (const r of rows) {
    assert.equal(r.length, 5, `wrong column count: ${r.join(',')}`);
    assert.match(r[0], /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(['google_organic', 'google_map_box', 'google_maps_at_shop', 'bing_organic'].includes(r[1]), `unknown surface ${r[1]}`);
    assert.ok(r[3] === '' || /^\d+$/.test(r[3]), `position must be a number or empty: ${r.join(',')}`);
    if (r[3] === '') assert.ok(r[4], `empty position needs a note: ${r.join(',')}`);
  }
});

test('search-console.csv and aeo.csv rows are well formed', () => {
  for (const [f, cols] of [['docs/seo/tracking/search-console.csv', 10], ['docs/seo/tracking/aeo.csv', 7]]) {
    const [head, ...rows] = csv(f);
    assert.equal(head.length, cols, f);
    assert.ok(rows.length > 0, f);
    for (const r of rows) {
      assert.equal(r.length, cols, `${f}: ${r.join(',')}`);
      assert.match(r[0], /^\d{4}-\d{2}-\d{2}$/);
    }
  }
});
