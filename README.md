# SIFF 2026 Fanlist

A fan-made bilingual showcase of the 28th Shanghai International Film Festival (June 12 – 21, 2026).

- **Live site source:** [`/site/`](./site/) — see [`site/README.md`](./site/README.md) for build, data, and deployment instructions.
- **Sample design (reference only):** [`/sample_design/`](./sample_design/) — original React proof-of-concept by the project lead, used as the visual reference for the live site.

## Quick start

```bash
cd site
python3 scripts/parse_csv.py      # CSV → JSON
python3 scripts/parse_schedule.py # cndata-*.json → public/schedule-data.js  (+ adds new films / programs / venues)
python3 scripts/build_data.py     # JSON → public/data.js
open public/index.html            # or `python3 -m http.server -d public 8000`
```

## Deployment

GitHub Actions workflow at [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml) builds and deploys `site/public/` to GitHub Pages on every push to `main`.

For Cloudflare Pages: connect this repo, set build command to `python3 scripts/build_data.py` (run from `site/`), output directory to `site/public/`.

Not affiliated with the festival.
