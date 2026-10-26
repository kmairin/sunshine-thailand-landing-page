# Before vs after, Sunshine Wash & Dry (as of 2026-10-27)

Method: `seo-aeo-framework` ("Reporting before vs after"): same search terms, same method,
signed-out browser, google.com with `gl=th&hl=th&pws=0`, dated. Raw numbers: `tracking/`.

- **Before (website):** 2026-10-17, measured before any site change (`baseline-2026-10-17.md`).
- **Before (Google Maps listing):** 2026-10-18, before the listing edits of 2026-10-26.
- **After:** 2026-10-26, nine days after the website changes and the same day as the listing edits.

Too early to call settled: Google usually takes 2 to 8 weeks. Next measurement 2026-11-17.

## Headline

| | Before | After |
|---|---|---|
| Non-brand searches with Sunshine on Google page 1 (same 13 terms) | 7 of 13 | **10 of 13** |
| ... of those, in the top 3 | 3 of 13 | **5 of 13** |
| Google Maps near the shop, terms where Sunshine is first (7 terms) | 0 of 7 | **3 of 7** |
| Pages Google has indexed | 2 (no Search Console yet) | **6 of 6** |
| Pages with technical problems (site audit) | 2 of 2 | **0 of 6** |
| `http://` moves to `https://` | no | **yes** |
| AI answers (Google AI Mode) naming Sunshine | not measured before | 2 of 10, first both times |

## 1. Normal Google results (blue links), non-brand

"Who else" is the top 3 on 2026-10-17.

| Search | Before | After | Who else was on top (before) |
|---|---|---|---|
| ซักผ้านวม บางพลี | not on page 1 | **1** | เคหะบางพลี forum posts; ซอยลิขิต 7 |
| ซักอบพับ เสาร์อาทิตย์ | not on page 1 | **2** | WashXpress ร้านพี่วัว; delivery article |
| ฝากซักผ้า บางพลี | 7 | **2** | ซักรีด วัดหลวงพ่อโต; a new-branch post (เทพารักษ์); 7-11 laundry |
| ซักอบพับ บางพลี | 2 | 2 | ซัก อบ พับ รับส่งถึงที่ Bangkok |
| ร้านสะดวกซัก บางพลี | 3 | 3 | CODE CLEAN X 7-11; ซอยลิขิต 7 |
| ร้านสะดวกซัก บางโฉลง | 3 | 4 | Tanjai Wash&Dry (2 results) |
| ร้านสะดวกซัก 24 ชม สมุทรปราการ | 7 | 5 | SpeedQueen สมุทรปราการ; ซอยลิขิต 7 |
| ร้านซักผ้า บางพลี | 7 | 6 | ซักรีด วัดหลวงพ่อโต; เคหะบางพลี |
| ร้านซักผ้าหยอดเหรียญ บางพลี | not on page 1 | **6** | CODE CLEAN X; ซอยลิขิต 7; KN Vending |
| laundromat bang phli | 4 | 6 | LaundryBar; เมืองใหม่บางพลี; สนุกซัก |
| ซักอบพับ ฟรี | not on page 1 | not on page 1 | WashXpress ร้านพี่วัว |
| ร้านซักผ้า บางนา | not on page 1 | not on page 1 | Fongfab Bangna |
| ร้านสะดวกซัก ราชาเทวะ | not on page 1 | not on page 1 | WashXpress; ร้านพี่วัว |

Brand search "Sunshine Wash & Dry บางโฉลง": 1 before, 1 after.
Added after the baseline: ร้านซักผ้า บางโฉลง, 2 (no before value).

Went down: ร้านสะดวกซัก บางโฉลง (3 to 4) and laundromat bang phli (4 to 6).

## 2. Google Maps, map centred on the shop

| Search | Before (10-18) | After (10-26) |
|---|---|---|
| ร้านสะดวกซัก | 7 | **1** |
| ซักอบพับ | not listed | **1** |
| ซักผ้านวม | 2 | **1** |
| ร้านซักผ้า | 6 | **2** |
| ฝากซักผ้า | 5 | **2** |
| ร้านซักผ้าหยอดเหรียญ | 6 | 5 |
| laundromat | 7 | 9 (page language differed) |

## 3. Map box on Google search (only the top 3 show)

| Search | Before (10-18) | After (10-26) |
|---|---|---|
| ร้านซักผ้า บางพลี | 2 | **1** |
| ซักอบพับ บางพลี | 2 | **1** |
| ฝากซักผ้า บางพลี | 3 | **2** |
| ร้านสะดวกซัก บางพลี | 9 | **3** |
| ร้านสะดวกซัก บางโฉลง | 3 | 3 |
| ร้านซักผ้าหยอดเหรียญ บางพลี | not in top 20 | 13 |
| laundromat bang phli | not in top 20 | 13 |
| ซักผ้านวม บางพลี | 19 | not in top 21 (worse) |

## 4. AI answers (AEO)

No "before" exists: the AI-answer check was set up on 2026-10-26, after the changes. That is a gap
in this report. The 2026-10-26 result is the baseline for next time: Google AI Mode named Sunshine
in 2 of 10 questions, first both times, and missed all wash-and-fold questions
(`aeo-check/results/2026-10-26-summary.md`). Search Console also counted 12 appearances of the home
page inside Google's AI answers (16 to 24 Oct).

## What changed, and when

| Date | Change |
|---|---|
| 2026-10-17 | Website: weekend wash-dry-fold and comforter pages (Thai and English), titles and descriptions fixed, home page leads with "ร้านซักผ้า", `llms.txt`, sitemap with 6 pages, FAQ data matching the page. Search Console and Bing set up, indexing requested. |
| 2026-10-26 | Maps listing: new description, two wash-and-fold services. Cloudflare "Always Use HTTPS" on. |
| 2026-10-26 | A Maps post was rejected (phone number in the text) and Google switched off posting for the listing. |
| 2026-10-27 | Phone number removed from the website; removal from the Maps listing submitted (Google review pending). |

Because the Maps listing edits and the "after" Maps measurement happened the same day, the Maps
gains are likely but not proven to come from those edits. The website gains (sections 1 and 3)
come nine days after the website changes.

## Not measured

- Bing: no Chrome profile signed in to Bing Webmaster Tools.
- AI engines other than Google AI Mode: no API keys.
- Clicks: Search Console shows 1 click (16 to 24 Oct). Most searches are "near me", whose clicks go
  to the Maps listing (calls, directions), which Search Console does not count.

Evidence: `evidence/` (screenshots dated 2026-10-17 to 2026-10-27).
