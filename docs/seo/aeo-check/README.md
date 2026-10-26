# AI-answer check (AEO)

Asks AI answer engines the 10 questions in `questions.json` and records whether Sunshine Wash &
Dry is named or linked, and who is recommended instead. Copied from the `seo-aeo-framework` skill
and retargeted to this shop (`TARGETS` at the top of `aeo-check.mjs`).

With API keys (any of `ANTHROPIC_API_KEY`, `PERPLEXITY_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`):

```bash
node docs/seo/aeo-check/aeo-check.mjs
```

Without keys, ask the questions by hand in a signed-out browser (Google AI Mode:
`https://www.google.com/search?q=<question>&udm=50&gl=th`), save the answers in the format of
`imports/2026-10-26-google-ai-mode.json`, then:

```bash
node docs/seo/aeo-check/aeo-check.mjs --import docs/seo/aeo-check/imports/<file>.json --date YYYY-MM-DD
```

Read the "Name only" answers by hand (other shops are called Sunshine), write what you found in
`results/<date>-notes.md`, run `--summarize <date>`, and add a row to `../tracking/aeo.csv`.
Keep question ids stable so months compare.
