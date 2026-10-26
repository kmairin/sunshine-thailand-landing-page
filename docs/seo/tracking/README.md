# SEO / AEO tracking

Numbers over time, one row per measurement. Add rows; never edit old ones. `node --test` checks
the files stay well formed.

| File | What | How to fill it |
|---|---|---|
| `rankings.csv` | Our position per search term | Signed-out browser, google.com with `gl=th&hl=th&pws=0`. Empty position = not found; say why in `note`. |
| `search-console.csv` | Clicks, appearances, average position, appearances inside AI answers, indexed pages | Search Console (krairat.mairin@gmail.com): Performance, Performance → Generative AI, Indexing → Pages. |
| `aeo.csv` | How many AI answers name us | `node docs/seo/aeo-check/aeo-check.mjs` (needs API keys) or by hand with `--import`; see `../aeo-check/`. |
| `gsc-queries-*.tsv`, `gsc-pages-*.tsv` | Search Console query and page tables on that date | Copy the tables (Queries, Pages tabs, 28 days). |

Surfaces in `rankings.csv`:

- `google_organic`: position among the normal blue links on page 1.
- `google_map_box`: position in Google's local results (the map box shows the top 3).
- `google_maps_at_shop`: position in the Google Maps list with the map centred on the shop
  (13.6250433, 100.726129, zoom 15). This is what someone near the shop sees.
- `bing_organic`: reserved.

Same terms every time so months compare. The term list is the 2026-10-17 baseline
(`../baseline-2026-10-17.md`) plus `ร้านซักผ้า บางโฉลง`.

Space searches out (a few seconds apart, not more than about 12 in a row). Google shows a "prove
you're human" page after too many; stop and finish another day rather than solving it.
