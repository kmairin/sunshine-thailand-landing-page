# SEO / AEO hand-off, Sunshine Wash & Dry (2026-10-17)

**Goal:** show up on Google page 1 (and in AI answers) for the searches nearby customers type,
especially the weekend drop-off wash, dry & fold service (ซักอบพับ / ฝากซักผ้า เสาร์-อาทิตย์).

Site: https://sunshine-wash-and-dry.cclaundrysystem.com, repo `kmairin/sunshine-thailand-landing-page`
(GitHub Pages, branch `main`, behind Cloudflare).

## Before and after

| | Before (2026-10-17 morning) | After (2026-10-17) |
|---|---|---|
| Google Search Console | not set up | verified; sitemap read, 6 pages found; indexing requested for `/`, `/wash-dry-fold/`, `/comforter-wash/` |
| Bing Webmaster Tools | not set up | verified; sitemap submitted; all 6 pages submitted |
| Pages | 2 (TH + EN home) | 6 (adds weekend wash-dry-fold and comforter pages, TH + EN) |
| Pages with technical problems (audit) | 2 of 2 (titles/descriptions too long) | 0 of 6 |
| llms.txt (summary for AI engines) | missing | live |
| FAQ data given to Google matches the visible FAQ | no (drifted) | yes, generated from the page |
| Automated SEO checks | none | 26 tests, all pass |

Ranking positions before: `baseline-2026-10-17.md`. Re-measure with the same terms and method on
the dates below. Rankings usually take 2 to 8 weeks to move; in the first month look at
Search Console "Pages" (indexed) and "Performance" (impressions) instead.

## What was done

Commits on `main`: `2dfd953` (Google verification tag), `0a70744` (Bing verification tag),
`e2ad1cf` (pages, llms.txt, tests, docs).

1. **Keyword research** (`term-map.md`): 697 real Google suggestions plus Google Trends.
   "ร้านซักผ้า" is searched about 7 times more than "ร้านสะดวกซัก"; demand peaked the week of
   27 Sep 2026 (rainy season). Nobody types "ซักอบพับ เสาร์อาทิตย์"; they type "ซักอบพับ",
   "ฝากซักผ้า", "ซักอบพับ ฟรี", "ซักผ้านวม ราคา", and lots of "ใกล้ฉัน" (near me).
2. **New page `/wash-dry-fold/`** (and `/en/wash-dry-fold/`): "ซักอบพับ ฝากซักผ้า ทุกวันเสาร์
   วันอาทิตย์" in the title, heading and first paragraph; 7-question FAQ; Service data with
   Saturday/Sunday 9:00–20:00 hours and the free service fee.
3. **New page `/comforter-wash/`** (and English): "ซักผ้านวม" with real 18 kg prices; answers
   the searched question "14 กิโลซักผ้านวมได้ไหม".
4. **Home pages:** titles and descriptions cut to fit Google; Thai home now leads with
   "ร้านซักผ้า ร้านสะดวกซัก บางโฉลง"; links to the new pages from the drop-off card, price table,
   FAQ and a new footer "บริการ" column.
5. **llms.txt**: address, hours, prices, weekend process and page links in plain text.
6. **sitemap.xml**: all 6 pages with language links; dropped the hand-typed dates.

How to change things: edit prices/hours on `index.html` and `en/index.html`, edit service-page
text in `scripts/build.mjs`, then run:

```bash
node scripts/build.mjs
node --test tests/
```

## Owner actions (I could not do these)

1. **Cloudflare: turn on "Always Use HTTPS"** for `cclaundrysystem.com`. Right now
   `http://sunshine-wash-and-dry...` loads without moving to `https://`. 2 minutes, needs
   Cloudflare login.
2. **Google Business Profile "Sunshine ซัก+อบ"** (the Maps listing, 4.9 stars, 45 reviews). Most
   searches are "ใกล้ฉัน" (near me), and Google answers those with the map box, not websites.
   In the profile: set the website to this site, add the weekend wash-dry-fold service with its
   hours, add photos, and post about the weekend service. 15 minutes.
3. **Confirm facts:** is the weekend drop-off still free of service fee, 9:00–20:00? Does the
   customer bring the basket to the shop (the pages assume yes)? The drop-off card says dryer
   "30 / 40 นาที" while the price table says 28 minutes per cycle; which is right?
4. **Facebook / other profiles:** a Facebook post "Sunshine Wash & Fold" shows for the brand
   search. If that is yours, send the page link; it goes into the business data (`sameAs`) so
   Google ties the profiles together.
5. **Pickup and delivery (รับ-ส่ง)** is heavily searched. If you ever offer it, it deserves its
   own page.

## Re-measure dates

- **2026-11-17:** Search Console Pages (indexed count) and Performance (impressions, queries);
  logged-out check of the baseline term list.
- **2026-12-17:** same again; compare with `baseline-2026-10-17.md`.

## Maintenance

| How often | What |
|---|---|
| Weekly, 10 min | Search Console → Performance → queries; note new ones and positions |
| After any new page | Add it to `tests/seo.test.mjs` PAGES and sitemap, resubmit sitemap, request indexing |
| Monthly | Same logged-out search check; keyword suggestions again |
| Every price/hours change | Edit home pages, run `node scripts/build.mjs`, update `llms.txt`, run tests |

## Mistakes not to repeat

- Do not put questions only in the Google data: the FAQ data is built from the visible FAQ.
- Count Thai title length in characters, not bytes; keep titles ≤ 60, descriptions ≤ 155.
- `gh` may be signed in as another account; push this repo as `kmairin`.
