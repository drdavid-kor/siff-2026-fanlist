"""
Flatten the merged catalog (public/data.js) into a CSV — one row per film,
joined with its parent program. Hand this CSV to a design tool to inform
a layout/redesign.

Output: data/films-with-programs.csv
"""

import csv
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
DATA_JS = ROOT / "public" / "data.js"
OUT = ROOT / "data" / "films-with-programs.csv"


def load_payload():
    text = DATA_JS.read_text(encoding="utf-8")
    m = re.search(r"window\.SIFF_DATA\s*=\s*(\{.*\});\s*$", text, re.DOTALL)
    if not m:
        raise SystemExit("Could not find window.SIFF_DATA = {...}; in data.js")
    return json.loads(m.group(1))


def main():
    payload = load_payload()
    programs = {p["id"]: p for p in payload["programs"]}
    films = payload["films"]

    film_counts = {}
    for f in films:
        film_counts[f["program_id"]] = film_counts.get(f["program_id"], 0) + 1

    columns = [
        "program_order", "program_id", "program_en", "program_zh",
        "program_short_en", "program_short_zh", "program_kind_en", "program_kind_zh",
        "program_color", "program_blurb_en", "program_blurb_zh", "program_film_count",
        "order_in_program", "film_id", "title_en", "title_zh", "year",
        "director", "director_zh", "runtime_min", "country", "country_zh",
        "language", "format_tags",
        "synopsis_en", "synopsis_zh",
        "poster_url", "imdb_id", "imdb_url", "tmdb_id",
    ]

    def cell(v):
        if v is None:
            return ""
        if isinstance(v, list):
            return ", ".join(str(x) for x in v)
        return v

    films_sorted = sorted(
        films,
        key=lambda f: (programs[f["program_id"]].get("order", 999), f.get("order_in_program", 0)),
    )

    with OUT.open("w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(columns)
        for f in films_sorted:
            p = programs[f["program_id"]]
            row = {
                "program_order": p.get("order"),
                "program_id": p["id"],
                "program_en": p.get("title_en"),
                "program_zh": p.get("title_zh"),
                "program_short_en": p.get("short_en"),
                "program_short_zh": p.get("short_zh"),
                "program_kind_en": p.get("kind_en"),
                "program_kind_zh": p.get("kind_zh"),
                "program_color": p.get("color"),
                "program_blurb_en": p.get("blurb_en"),
                "program_blurb_zh": p.get("blurb_zh"),
                "program_film_count": film_counts.get(p["id"], 0),
                "order_in_program": f.get("order_in_program"),
                "film_id": f["id"],
                "title_en": f.get("title_en"),
                "title_zh": f.get("title_zh"),
                "year": f.get("year"),
                "director": f.get("director"),
                "director_zh": f.get("director_zh"),
                "runtime_min": f.get("runtime"),
                "country": f.get("country"),
                "country_zh": f.get("country_zh"),
                "language": f.get("language"),
                "format_tags": f.get("format_tags") or [],
                "synopsis_en": f.get("synopsis_en"),
                "synopsis_zh": f.get("synopsis_zh"),
                "poster_url": f.get("poster_url"),
                "imdb_id": f.get("imdb_id"),
                "imdb_url": f.get("imdb_url"),
                "tmdb_id": f.get("tmdb_id"),
            }
            w.writerow([cell(row[c]) for c in columns])

    print(f"Wrote {OUT} ({OUT.stat().st_size:,} bytes)")
    print(f"  rows:     {len(films)}")
    print(f"  programs: {len(programs)}")


if __name__ == "__main__":
    main()
