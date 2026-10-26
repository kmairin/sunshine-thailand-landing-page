#!/usr/bin/env node
// Builds the service pages and keeps every page's FAQPage JSON-LD in sync with its visible FAQ.
//
//   node scripts/build.mjs
//
// The home pages (index.html, en/index.html) are hand-edited. This script:
//   1. Generates /wash-dry-fold/ and /comforter-wash/ (Thai + English), reusing the header,
//      footer, icon sprite, drop-off card, price table and location block from the home pages
//      so prices and hours have one source of truth.
//   2. Rewrites the FAQPage JSON-LD on every page from its visible <details class="faq-item">
//      list, so Google and AI engines see exactly what visitors see.
// Output is committed; GitHub Pages serves the files as they are.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const ORIGIN = 'https://sunshine-wash-and-dry.cclaundrysystem.com';
const LINE = 'https://lin.ee/V77IMtH';
const MAPS = 'https://maps.app.goo.gl/qasTNTg1pb59pZQq6';
const BUSINESS_ID = `${ORIGIN}/#business`;

const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const write = (f, s) => {
  fs.mkdirSync(path.dirname(path.join(ROOT, f)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, f), s);
};

function block(html, startRe, endTag) {
  const m = html.match(startRe);
  if (!m) throw new Error(`block not found: ${startRe}`);
  const start = m.index;
  // Walk forward counting nested tags of the same name so we get the whole element.
  const tag = endTag.replace(/[</>]/g, '');
  const re = new RegExp(`<${tag}[\\s>]|</${tag}>`, 'g');
  re.lastIndex = start;
  let depth = 0;
  for (let t; (t = re.exec(html));) {
    depth += t[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return html.slice(start, t.index + t[0].length);
  }
  throw new Error(`unclosed block: ${startRe}`);
}

// Home-page anchors become absolute links to the home page from a sub-page.
const homeAnchors = (html, home) => html.replace(/href="#(why|pricing|location|how|faq|dropoff|contact)"/g, `href="${home}#$1"`);

const textOf = (s) => s
  .replace(/<br\s*\/?>/g, ' ')
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/\s+/g, ' ').trim();
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// ---------- FAQ sync ----------
export function visibleFaq(html) {
  return [...html.matchAll(/<details class="faq-item"><summary>([\s\S]*?)<\/summary><div class="answer">([\s\S]*?)<\/div><\/details>/g)]
    .map((m) => ({ q: textOf(m[1]), a: textOf(m[2]) }));
}

function faqJsonLd(faq) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  };
  return `<script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n  </script>`;
}

export function syncFaq(html) {
  const faq = visibleFaq(html);
  const re = /<script type="application\/ld\+json">\s*\{\s*"@context": "https:\/\/schema.org",\s*"@type": "FAQPage"[\s\S]*?<\/script>/;
  if (!faq.length) return html;
  if (!re.test(html)) throw new Error('page has a visible FAQ but no FAQPage block to replace');
  return html.replace(re, faqJsonLd(faq));
}

// ---------- shared pieces from the home pages ----------
const home = { th: read('index.html'), en: read('en/index.html') };
const sprite = block(home.th, /<svg class="icon-svg"/, '</svg>');

function header(lang, selfPath, otherPath) {
  const h = block(home[lang], /<header class="site-header">/, '</header>');
  const homePath = lang === 'th' ? '/' : '/en/';
  return homeAnchors(h, homePath)
    .replace(/<a href="\/" class="is-active" hreflang="th">TH<\/a>/, `<a href="${lang === 'th' ? selfPath : otherPath}"${lang === 'th' ? ' class="is-active"' : ''} hreflang="th">TH</a>`)
    .replace(/<a href="\/en\/" hreflang="en">EN<\/a>/, `<a href="${lang === 'en' ? selfPath : otherPath}"${lang === 'en' ? ' class="is-active"' : ''} hreflang="en">EN</a>`)
    .replace(/<a href="\/" hreflang="th">TH<\/a>/, `<a href="${otherPath}" hreflang="th">TH</a>`)
    .replace(/<a href="\/en\/" class="is-active" hreflang="en">EN<\/a>/, `<a href="${selfPath}" class="is-active" hreflang="en">EN</a>`);
}
const footer = (lang) => homeAnchors(block(home[lang], /<footer class="site-footer">/, '</footer>'), lang === 'th' ? '/' : '/en/');
const mobileCta = (lang) => block(home[lang], /<div class="mobile-cta"/, '</div>');
const dropoff = (lang) => homeAnchors(block(home[lang], /<section id="dropoff"/, '</section>'), lang === 'th' ? '/' : '/en/')
  .replace(`href="${lang === 'th' ? '/' : '/en/'}#pricing"`, 'href="#pricing"');
const pricing = (lang) => block(home[lang], /<section id="pricing"/, '</section>');
const location = (lang) => block(home[lang], /<section id="location">/, '</section>');

// ---------- page template ----------
function page(p) {
  const self = `${ORIGIN}${p.path}`;
  const th = `${ORIGIN}${p.alt.th}`;
  const en = `${ORIGIN}${p.alt.en}`;
  const homeUrl = `${ORIGIN}${p.lang === 'th' ? '/' : '/en/'}`;
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: p.crumbHome, item: homeUrl },
      { '@type': 'ListItem', position: 2, name: p.crumbSelf, item: self },
    ],
  };
  const service = { '@context': 'https://schema.org', ...p.service, url: self, provider: { '@id': BUSINESS_ID } };
  const faqHtml = p.faq.map(([q, a]) => `        <details class="faq-item"><summary>${q}</summary><div class="answer">${a}</div></details>`).join('\n');
  const faqLd = faqJsonLd(p.faq.map(([q, a]) => ({ q: textOf(q), a: textOf(a) })));
  return `<!doctype html>
<html lang="${p.lang}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />

  <title>${esc(p.title)}</title>
  <meta name="description" content="${esc(p.description)}" />
  <link rel="canonical" href="${self}" />
  <link rel="alternate" hreflang="th" href="${th}" />
  <link rel="alternate" hreflang="en" href="${en}" />
  <link rel="alternate" hreflang="x-default" href="${th}" />

  <meta name="geo.region" content="TH-11" />
  <meta name="geo.placename" content="Bang Phli, Samut Prakan" />
  <meta name="geo.position" content="13.6250433;100.726129" />

  <meta property="og:type" content="website" />
  <meta property="og:locale" content="${p.lang === 'th' ? 'th_TH' : 'en_US'}" />
  <meta property="og:title" content="${esc(p.ogTitle || p.title)}" />
  <meta property="og:description" content="${esc(p.description)}" />
  <meta property="og:url" content="${self}" />
  <meta property="og:image" content="${ORIGIN}/assets/storefront.jpg" />
  <meta property="og:site_name" content="Sunshine Wash &amp; Dry" />
  <meta name="twitter:card" content="summary_large_image" />

  <meta name="theme-color" content="#FFD60A" />
  <link rel="icon" type="image/jpeg" href="/assets/logo.jpg" />
  <link rel="apple-touch-icon" href="/assets/logo.jpg" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800&display=swap" onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800&display=swap"></noscript>
  <link rel="stylesheet" href="/styles.css" />

  <script type="application/ld+json">
${JSON.stringify(service, null, 2)}
  </script>
  <script type="application/ld+json">
${JSON.stringify(breadcrumb, null, 2)}
  </script>
  ${faqLd}
</head>
<body>

<!-- Generated by scripts/build.mjs — edit the data there, not this file. -->
${sprite}

${header(p.lang, p.path, p.lang === 'th' ? p.alt.en : p.alt.th)}

<main>
  <section class="hero">
    <div class="container">
      <div class="hero-content">
        <nav class="crumbs" aria-label="breadcrumb"><a href="${p.lang === 'th' ? '/' : '/en/'}">${p.crumbHome}</a> › <span>${p.crumbSelf}</span></nav>
        <span class="eyebrow"><span class="dot"></span> ${p.eyebrow}</span>
        <h1>${p.h1}</h1>
        <p class="lead">${p.lead}</p>
        <div class="hero-ctas">
          <a class="btn btn-line" href="${LINE}" target="_blank" rel="noopener">
            <svg aria-hidden="true"><use href="#i-line"/></svg>
            ${p.lang === 'th' ? 'แอด LINE' : 'Add us on LINE'}
          </a>
          <a class="btn btn-outline" href="${MAPS}" target="_blank" rel="noopener">
            <svg aria-hidden="true"><use href="#i-pin"/></svg>
            ${p.lang === 'th' ? 'นำทางไปร้าน' : 'Directions'}
          </a>
        </div>
      </div>
      <div class="hero-image">
        <img src="/assets/storefront.jpg" alt="${esc(p.imageAlt)}" width="1500" height="1100" loading="eager" fetchpriority="high" />
      </div>
    </div>
  </section>

${p.body}

${pricing(p.lang)}

  <section id="faq" class="faq">
    <div class="container">
      <div class="section-head">
        <div class="kicker">${p.lang === 'th' ? 'คำถามที่พบบ่อย' : 'FAQ'}</div>
        <h2>${p.faqTitle}</h2>
      </div>
      <div class="faq-list">
${faqHtml}
      </div>
    </div>
  </section>

${location(p.lang)}

  <section class="related">
    <div class="container">
      <p>${p.related}</p>
    </div>
  </section>
</main>

${footer(p.lang)}

${mobileCta(p.lang)}

<script src="/script.js" defer></script>
</body>
</html>
`;
}

// ---------- page data ----------
// Facts only from the home page: prices, hours, address, phone, LINE. Nothing new is claimed here.
const weekendHours = [{ '@type': 'OpeningHoursSpecification', dayOfWeek: ['Saturday', 'Sunday'], opens: '09:00', closes: '20:00' }];
const area = ['บางโฉลง', 'บางพลี', 'ราชาเทวะ', 'เมกาบางนา', 'บางนา-ตราด', 'สนามบินสุวรรณภูมิ'].map((name) => ({ '@type': 'Place', name }));

const PAGES = [
  {
    file: 'wash-dry-fold/index.html', path: '/wash-dry-fold/', lang: 'th',
    alt: { th: '/wash-dry-fold/', en: '/en/wash-dry-fold/' },
    title: 'ซักอบพับ ฝากซักผ้า เสาร์-อาทิตย์ ฟรีค่าบริการ บางพลี',
    ogTitle: 'ซักอบพับ ฝากซักผ้า ทุกเสาร์-อาทิตย์ ฟรีค่าบริการ — Sunshine Wash & Dry บางโฉลง',
    description: 'ฝากซักผ้า ซักอบพับ ทุกวันเสาร์ วันอาทิตย์ 9:00–20:00 ฟรีค่าบริการ จ่ายเฉพาะค่าเครื่องซัก-อบ เริ่ม 50 บาท ร้าน Sunshine บางโฉลง บางพลี สั่งผ่าน LINE',
    crumbHome: 'หน้าแรก', crumbSelf: 'ซักอบพับ เสาร์-อาทิตย์',
    eyebrow: 'ทุกเสาร์-อาทิตย์ 9:00–20:00 • ฟรีค่าบริการ',
    h1: 'ซักอบพับ ฝากซักผ้า ทุกวันเสาร์ วันอาทิตย์ ที่<span class="nw">บางโฉลง</span> <span class="nw">บางพลี</span>',
    lead: '<strong>ฝากซักผ้า</strong>ไว้กับเรา แม่บ้านซัก อบ และพับใส่ตะกร้าให้ <strong>ทุกเสาร์-อาทิตย์ 9:00–20:00</strong> <strong>ฟรีค่าบริการ</strong> จ่ายเฉพาะค่าเครื่องซัก-อบตามตารางราคา (เริ่ม 50 บาท) ที่ร้านสะดวกซัก Sunshine Wash &amp; Dry 168 บางโฉลง อำเภอบางพลี สมุทรปราการ สั่งง่ายผ่าน LINE',
    imageAlt: 'ร้านซักอบพับ Sunshine Wash & Dry บางโฉลง บางพลี',
    service: {
      '@type': 'Service',
      name: 'ซักอบพับ ฝากซักผ้า เสาร์-อาทิตย์ (Drop-off Wash, Dry & Fold)',
      alternateName: ['ซักอบพับ', 'ฝากซักผ้า', 'รับซักอบพับ', 'ซักผ้าวันเสาร์', 'ซักผ้าวันอาทิตย์', 'Wash Dry Fold'],
      serviceType: 'Drop-off laundry, wash dry and fold',
      description: 'บริการฝากซัก-อบ-พับ ทุกเสาร์-อาทิตย์ 9:00–20:00 ฟรีค่าบริการ ลูกค้าจ่ายเฉพาะค่าเครื่องซักและเครื่องอบตามตารางราคา',
      areaServed: area,
      hoursAvailable: weekendHours,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'THB', description: 'ไม่มีค่าบริการ จ่ายเฉพาะค่าเครื่องซัก-อบ (เครื่องซักเริ่ม 50 บาท เครื่องอบ 50 บาท/28 นาที)' },
    },
    body: dropoff('th'),
    faqTitle: 'ถามบ่อยเรื่องซักอบพับ',
    faq: [
      ['ซักอบพับ ราคาเท่าไหร่?', '<strong>ไม่มีค่าบริการซักอบพับ</strong> จ่ายเฉพาะค่าเครื่องตามตารางราคา เช่น เครื่องซัก 14 กก. น้ำเย็น 50 บาท + เครื่องอบ 28 นาที 50 บาท รวม 100 บาทต่อหนึ่งเครื่อง'],
      ['ฝากซักผ้าวันเสาร์ วันอาทิตย์ ได้กี่โมงถึงกี่โมง?', 'รับฝากซักอบพับ<strong>ทุกเสาร์และอาทิตย์ 9:00–20:00</strong> ส่วนเครื่องซัก-อบแบบบริการตัวเองเปิด 24 ชั่วโมงทุกวัน'],
      ['ฝากซักวันธรรมดาได้ไหม?', 'ตอนนี้บริการฝากซักอบพับเปิดเฉพาะเสาร์-อาทิตย์ วันจันทร์-ศุกร์ใช้เครื่องซัก-อบเองได้ตลอด 24 ชั่วโมง จ่ายด้วยเหรียญหรือ QR PromptPay'],
      ['ฝากซักผ้าต้องทำอย่างไร?', `<a href="${LINE}" target="_blank" rel="noopener">แอด LINE</a> ของร้าน ถ่ายรูปตะกร้าผ้าส่งเข้าไลน์ พร้อมเลือกโปรแกรมซัก (น้ำเย็น/อุ่น/ร้อน) และโปรแกรมอบ แม่บ้านจะซัก อบ พับ แล้วแจ้งในไลน์เมื่อเสร็จ`],
      ['มารับผ้าหลัง 20:00 ได้ไหม?', 'ได้ ผ้าที่พับเสร็จจะวางไว้บนชั้นวางในร้าน มารับได้ตลอด 24 ชั่วโมง'],
      ['จ่ายเงินอย่างไร?', 'จ่ายที่ร้าน เป็นเงินสด หรือสแกน QR PromptPay ผ่านแอปธนาคาร'],
      ['ซักผ้านวมได้ไหม?', 'ซักผ้านวมได้ด้วยเครื่อง 18 กก. (60–80 บาท) ดูวิธีและราคาที่หน้า <a href="/comforter-wash/">ซักผ้านวม</a> หากต้องการฝากซักผ้านวม แจ้งทาง LINE ก่อน'],
    ],
    related: 'อยากซักเอง? ร้านเปิด <a href="/">ร้านสะดวกซัก 24 ชม. บางโฉลง</a> ทุกวัน • มีผ้านวม ผ้าห่ม? ดู <a href="/comforter-wash/">ซักผ้านวม เครื่อง 18 กก.</a>',
  },
  {
    file: 'en/wash-dry-fold/index.html', path: '/en/wash-dry-fold/', lang: 'en',
    alt: { th: '/wash-dry-fold/', en: '/en/wash-dry-fold/' },
    title: 'Free Wash & Fold Drop-Off on Weekends | Bang Phli Laundry',
    description: 'Drop off your laundry every Saturday and Sunday, 9am–8pm. We wash, dry and fold it free; you pay only the machines, from 50 THB. Bang Chalong, Bang Phli.',
    crumbHome: 'Home', crumbSelf: 'Weekend wash & fold',
    eyebrow: 'Saturdays & Sundays 9am–8pm • No service fee',
    h1: 'Weekend Wash, Dry &amp; Fold Drop-Off in Bang Chalong, Bang Phli',
    lead: 'Leave your laundry with us on <strong>Saturday or Sunday, 9am–8pm</strong>. Our staff wash, dry and fold it into your basket <strong>with no service fee</strong>: you pay only the washer and dryer prices (from 50 THB). Sunshine Wash &amp; Dry, 168 Bang Chalong, Bang Phli, Samut Prakan. Order on LINE.',
    imageAlt: 'Sunshine Wash & Dry laundromat in Bang Chalong, Bang Phli',
    service: {
      '@type': 'Service',
      name: 'Weekend drop-off wash, dry & fold',
      alternateName: ['Wash and fold', 'Drop-off laundry', 'Laundry service Bang Phli'],
      serviceType: 'Drop-off laundry, wash dry and fold',
      description: 'Drop-off wash, dry and fold every Saturday and Sunday 9:00–20:00. No service fee; customers pay only the washer and dryer prices.',
      areaServed: area,
      hoursAvailable: weekendHours,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'THB', description: 'No service fee; machine prices only (washers from 50 THB, dryer 50 THB per 28 minutes).' },
    },
    body: dropoff('en'),
    faqTitle: 'Wash & fold questions',
    faq: [
      ['How much is wash and fold?', 'There is <strong>no service fee</strong>. You pay only the machines: for example a 14 kg cold wash (50 THB) plus one 28-minute dry (50 THB) is 100 THB per load.'],
      ['When can I drop off laundry?', 'Drop-off runs <strong>every Saturday and Sunday, 9am–8pm</strong>. Self-service machines are open 24 hours, every day.'],
      ['Can I drop off on a weekday?', 'Not yet: drop-off is weekends only. On weekdays you can use the machines yourself 24/7 and pay by coin or PromptPay QR.'],
      ['How do I order?', `<a href="${LINE}" target="_blank" rel="noopener">Add us on LINE</a>, send a photo of your basket and choose the wash (cold, warm or hot) and dry programs. Staff wash, dry and fold it and message you on LINE when it is ready.`],
      ['Can I pick up after 8pm?', 'Yes. Folded laundry waits on the in-store shelf and you can collect it any time, 24/7.'],
      ['How do I pay?', 'At the shop, in cash or by PromptPay QR from any Thai banking app.'],
      ['Can you wash comforters?', 'Comforters go in the 18 kg washer (60–80 THB). See <a href="/en/comforter-wash/">comforter washing</a>. To drop off a comforter, message us on LINE first.'],
    ],
    related: 'Prefer to do it yourself? The <a href="/en/">24-hour laundromat in Bang Chalong</a> is open every day. Big bedding? See <a href="/en/comforter-wash/">comforter washing with 18 kg machines</a>.',
  },
  {
    file: 'comforter-wash/index.html', path: '/comforter-wash/', lang: 'th',
    alt: { th: '/comforter-wash/', en: '/en/comforter-wash/' },
    title: 'ซักผ้านวม บางพลี เครื่อง 18 กก. เปิด 24 ชม. | Sunshine',
    ogTitle: 'ซักผ้านวม ผ้าห่ม เครื่อง 18 กก. บางโฉลง บางพลี 24 ชม. — Sunshine Wash & Dry',
    description: 'ซักผ้านวม ผ้าห่ม ผ้าปูที่นอน ด้วยเครื่อง Speed Queen 18 กก. 60–80 บาท อบ 50 บาท/28 นาที เปิด 24 ชม. ที่ร้านสะดวกซัก Sunshine บางโฉลง บางพลี ใกล้เมกาบางนา',
    crumbHome: 'หน้าแรก', crumbSelf: 'ซักผ้านวม',
    eyebrow: 'เครื่อง 18 กก. • เปิด 24 ชม. • รับ PromptPay',
    h1: 'ซักผ้านวม ผ้าห่ม ด้วยเครื่อง <span class="nw">18 กก.</span> ที่<span class="nw">บางโฉลง</span> <span class="nw">บางพลี</span>',
    lead: '<strong>ซักผ้านวม</strong> ผ้าห่ม ผ้าปูที่นอน ด้วยเครื่องซัก Speed Queen <strong>18 กก.</strong> ราคา 60 บาท (น้ำเย็น) 70 บาท (น้ำอุ่น) 80 บาท (น้ำร้อน) แล้วอบต่อได้ทันที 50 บาท/28 นาที เปิด <strong>24 ชั่วโมงทุกวัน</strong> ที่ 168 บางโฉลง อำเภอบางพลี สมุทรปราการ ใกล้เมกาบางนา',
    imageAlt: 'เครื่องซักผ้า Speed Queen สำหรับซักผ้านวม ร้าน Sunshine Wash & Dry บางโฉลง',
    service: {
      '@type': 'Service',
      name: 'ซักผ้านวม ผ้าห่ม เครื่อง 18 กก. (Comforter washing)',
      alternateName: ['ซักผ้านวม', 'ร้านซักผ้านวม', 'ซักผ้าห่ม', 'Comforter washing'],
      serviceType: 'Self-service comforter and blanket washing',
      areaServed: area,
      hoursAvailable: [{ '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], opens: '00:00', closes: '23:59' }],
      offers: [
        { '@type': 'Offer', name: 'เครื่องซัก 18 กก. น้ำเย็น', price: '60', priceCurrency: 'THB' },
        { '@type': 'Offer', name: 'เครื่องซัก 18 กก. น้ำอุ่น', price: '70', priceCurrency: 'THB' },
        { '@type': 'Offer', name: 'เครื่องซัก 18 กก. น้ำร้อน', price: '80', priceCurrency: 'THB' },
        { '@type': 'Offer', name: 'เครื่องอบ 28 นาที', price: '50', priceCurrency: 'THB' },
      ],
    },
    body: `  <section class="why">
    <div class="container">
      <div class="section-head">
        <div class="kicker">ซักผ้านวมเองง่ายๆ</div>
        <h2>ซักผ้านวมที่ร้าน ใน 4 ขั้นตอน</h2>
      </div>
      <div class="steps">
        <div class="step"><div class="step-num">1</div><h3>ใช้เครื่อง 18 กก.</h3><p>ผ้านวมและผ้าห่มต้องมีที่ว่างให้หมุน ทางร้านแนะนำเครื่อง 18 กก.</p></div>
        <div class="step"><div class="step-num">2</div><h3>เลือกน้ำเย็น / อุ่น / ร้อน</h3><p>60 / 70 / 80 บาท เลือกตามป้ายดูแลผ้า</p></div>
        <div class="step"><div class="step-num">3</div><h3>จ่ายเหรียญหรือ QR</h3><p>หยอดเหรียญ 5 และ 10 บาท หรือสแกน QR PromptPay</p></div>
        <div class="step"><div class="step-num">4</div><h3>อบให้แห้งสนิท</h3><p>อบ 50 บาท/28 นาที ผ้าหนาแนะนำเพิ่มเวลา 1–2 รอบ (10 บาท/6 นาที)</p></div>
      </div>
    </div>
  </section>`,
    faqTitle: 'ถามบ่อยเรื่องซักผ้านวม',
    faq: [
      ['ซักผ้านวม ราคาเท่าไหร่?', 'เครื่องซัก 18 กก. <strong>60 บาท</strong> (น้ำเย็น) <strong>70 บาท</strong> (น้ำอุ่น) <strong>80 บาท</strong> (น้ำร้อน) อบ 50 บาทต่อ 28 นาที เพิ่มเวลาอบ 10 บาทต่อ 6 นาที'],
      ['เครื่อง 14 กิโล ซักผ้านวมได้ไหม?', 'ทางร้านแนะนำ<strong>เครื่อง 18 กก.</strong> สำหรับผ้านวมและผ้าห่ม เพื่อให้ผ้าหมุนได้และสะอาดทั่วถึง ไม่แน่ใจขนาดผ้านวม ถ่ายรูปถามทาง LINE ได้'],
      ['อบผ้านวมนานแค่ไหน?', 'อบรอบแรก 28 นาที ผ้าหนาหรือผ้านวมแนะนำเพิ่มเวลา 1–2 รอบ (รอบละ 6 นาที 10 บาท) ให้แห้งสนิทก่อนเก็บ'],
      ['ไปซักผ้านวมตอนกลางคืนได้ไหม?', 'ได้ ร้านเปิด<strong>24 ชั่วโมงทุกวัน</strong> สว่างทั้งคืนและมีกล้องวงจรปิด'],
      ['ฝากซักผ้านวมได้ไหม?', 'บริการ <a href="/wash-dry-fold/">ฝากซักอบพับ</a> เปิดทุกเสาร์-อาทิตย์ 9:00–20:00 ฟรีค่าบริการ หากเป็นผ้านวม แจ้งทาง LINE ก่อนนำมาฝาก'],
      ['ร้านอยู่ที่ไหน?', '168 ตำบลบางโฉลง อำเภอบางพลี สมุทรปราการ 10540 ห่างเมกาบางนาประมาณ 5 กม. และสนามบินสุวรรณภูมิประมาณ 10 กม.'],
    ],
    related: 'ไม่อยากรอเครื่อง? ใช้ <a href="/wash-dry-fold/">บริการฝากซักอบพับ ทุกเสาร์-อาทิตย์</a> • กลับ <a href="/">หน้าแรก ร้านสะดวกซัก 24 ชม. บางโฉลง</a>',
  },
  {
    file: 'en/comforter-wash/index.html', path: '/en/comforter-wash/', lang: 'en',
    alt: { th: '/comforter-wash/', en: '/en/comforter-wash/' },
    title: 'Comforter Washing in Bang Phli, 18 kg Washers | Sunshine',
    description: 'Wash comforters, blankets and bedding in 18 kg Speed Queen washers: 60–80 THB, dryer 50 THB per 28 min. Open 24/7 in Bang Chalong, Bang Phli.',
    crumbHome: 'Home', crumbSelf: 'Comforter washing',
    eyebrow: '18 kg washers • Open 24/7 • PromptPay',
    h1: 'Comforter &amp; Blanket Washing with 18 kg Machines in Bang Phli',
    lead: 'Wash <strong>comforters</strong>, blankets and bed sheets in our <strong>18 kg</strong> Speed Queen washers: 60 THB (cold), 70 THB (warm), 80 THB (hot), then dry for 50 THB per 28 minutes. Open <strong>24 hours, every day</strong> at 168 Bang Chalong, Bang Phli, Samut Prakan, near Mega Bangna.',
    imageAlt: 'Speed Queen washers for comforters at Sunshine Wash & Dry, Bang Chalong',
    service: {
      '@type': 'Service',
      name: 'Comforter and blanket washing (18 kg washers)',
      alternateName: ['Comforter washing', 'Duvet washing', 'Blanket laundry'],
      serviceType: 'Self-service comforter and blanket washing',
      areaServed: area,
      hoursAvailable: [{ '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], opens: '00:00', closes: '23:59' }],
      offers: [
        { '@type': 'Offer', name: '18 kg washer, cold', price: '60', priceCurrency: 'THB' },
        { '@type': 'Offer', name: '18 kg washer, warm', price: '70', priceCurrency: 'THB' },
        { '@type': 'Offer', name: '18 kg washer, hot', price: '80', priceCurrency: 'THB' },
        { '@type': 'Offer', name: 'Dryer, 28 minutes', price: '50', priceCurrency: 'THB' },
      ],
    },
    body: `  <section class="why">
    <div class="container">
      <div class="section-head">
        <div class="kicker">Do it yourself</div>
        <h2>Wash a comforter in 4 steps</h2>
      </div>
      <div class="steps">
        <div class="step"><div class="step-num">1</div><h3>Use the 18 kg washer</h3><p>Comforters need room to tumble; we recommend the 18 kg machine.</p></div>
        <div class="step"><div class="step-num">2</div><h3>Cold, warm or hot</h3><p>60 / 70 / 80 THB. Follow the care label.</p></div>
        <div class="step"><div class="step-num">3</div><h3>Coins or QR</h3><p>5 and 10 THB coins, or PromptPay QR.</p></div>
        <div class="step"><div class="step-num">4</div><h3>Dry it fully</h3><p>50 THB per 28 minutes; thick items usually need 1–2 extra top-ups (10 THB per 6 minutes).</p></div>
      </div>
    </div>
  </section>`,
    faqTitle: 'Comforter washing questions',
    faq: [
      ['How much does it cost to wash a comforter?', 'The 18 kg washer is <strong>60 THB</strong> cold, <strong>70 THB</strong> warm, <strong>80 THB</strong> hot. The dryer is 50 THB per 28 minutes; extra time is 10 THB per 6 minutes.'],
      ['Can I use the 14 kg washer for a comforter?', 'We recommend the <strong>18 kg washer</strong> for comforters and blankets so they tumble freely and come out clean. Not sure? Send us a photo on LINE.'],
      ['How long should I dry a comforter?', 'Start with 28 minutes, then add 1–2 top-ups (6 minutes, 10 THB each) until it is completely dry.'],
      ['Can I come at night?', 'Yes. We are open <strong>24 hours a day, every day</strong>, fully lit with CCTV.'],
      ['Can I drop off a comforter instead?', 'Our <a href="/en/wash-dry-fold/">weekend wash &amp; fold drop-off</a> runs Saturday and Sunday, 9am–8pm, with no service fee. For comforters, message us on LINE first.'],
      ['Where are you?', '168 Bang Chalong, Bang Phli, Samut Prakan 10540: about 5 km from Mega Bangna and 10 km from Suvarnabhumi Airport.'],
    ],
    related: 'No time to wait? Try the <a href="/en/wash-dry-fold/">free weekend wash &amp; fold drop-off</a>. Back to the <a href="/en/">24-hour laundromat in Bang Chalong</a>.',
  },
];

for (const p of PAGES) write(p.file, page(p));
for (const f of ['index.html', 'en/index.html']) write(f, syncFaq(read(f)));
console.log(`built ${PAGES.length} pages, synced FAQ on home pages`);
