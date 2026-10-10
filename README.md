# The Threshold Atlas

A map, metrics and a 3D world of near-death experiences, built only from published research, with room for people to add their own (coming next).

Live site: https://kristiwynn.github.io/threshold-atlas/

## How it is built

Plain HTML, CSS and JavaScript. No build step: edit a file, push, and GitHub Pages serves it.

- `index.html` – home and the realistic map (MapLibre GL + OpenFreeMap tiles)
- `patterns.html` – feature frequencies, comparisons, breakdowns
- `world.html` – the 3D passage (three.js), driven only by `data/scene-params.json`
- `sources.html` – citations, generated from `data/studies.json`
- `data/` – the research tier: every number with its source
- `assets/` – shared styles and helpers (Wilson intervals, charts, nav)

## Rules

1. Three kinds of data are kept apart and never averaged together: published research, external archives (linked only, never copied), and experiences people share here.
2. Every proportion carries its sample size and a 95% confidence interval.
3. Community figures hide below n=10, grey below 30; group comparisons need 30 per group; "significant" needs multiple-comparison correction, a 10-point difference, and agreement in direction with published research where it exists.
4. The 3D world reads only `data/scene-params.json`, where every value is cited.

## Roadmap

1. Research site (this): map, patterns, world, sources.
2. Collect: anonymous submissions (Supabase), consent, moderation, deletion codes, k=5 suppression.
3. Community layer on the map and patterns, significance badges, community toggle in the world.
4. Headset mode (WebXR) for the world.
