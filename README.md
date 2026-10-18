# The Threshold Atlas

A map, metrics and a 3D world of near-death experiences, built only from published research, plus anonymous experiences people add themselves, kept strictly separate.

Live site: https://kristiwynn.github.io/threshold-atlas/

## How it is built

Plain HTML, CSS and JavaScript. No build step: edit a file, push, and GitHub Pages serves it.

- `index.html` – home and the realistic map (MapLibre GL + OpenFreeMap tiles)
- `patterns.html` – feature frequencies, comparisons, breakdowns
- `world.html` – the 3D passage (three.js), driven only by `data/scene-params.json`
- `share.html` – anonymous submission form (Greyson scale, consent, deletion code)
- `code.html` – private: code an NDERF/IANDS account on the Greyson items (needs the moderation key; saves codes only)
- `stories.html` – approved, redacted community stories
- `sources.html` – citations, generated from `data/studies.json`
- `worker/` – the Cloudflare Worker API and D1 schema (submissions, suppressed stats, moderation)
- `data/` – the research tier: every number with its source
- `assets/` – shared styles and helpers (Wilson intervals, charts, nav)

Pages load `assets/*` with `?v=YYYYMMDD`. When you change a file in `assets/`, bump that number in every page, or browsers may pair a new page with an old cached script (GitHub Pages caches for 10 minutes).

## Rules

1. Four kinds of data are kept apart and never averaged together: published research, external archives (linked only, never copied), archive accounts this atlas has read and coded (codes and the account link only, never text), and experiences people share here.
2. Every proportion carries its sample size and a 95% confidence interval.
3. Community figures hide below n=10, grey below 30; group comparisons need 30 per group; "significant" needs multiple-comparison correction, a 10-point difference, and agreement in direction with published research where it exists.
4. The 3D world reads only `data/scene-params.json`, where every value is cited.

## Roadmap

1. Research site (this): map, patterns, world, sources.
2. DONE: anonymous submissions (Cloudflare Worker + D1), consent, moderation, deletion codes, k=5 suppression; community layer on the map, patterns and world captions.
3. Significance badges, story coding, community toggle in the world once n>=100.
4. Headset mode (WebXR) for the world.
