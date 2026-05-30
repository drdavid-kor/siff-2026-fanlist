"""
Enrich films.json with TMDB data — posters, IMDB ids, synopses (EN + zh-CN),
runtime, director, country.

Writes:   data/enrichment_tmdb.json
Merges:   build_data.py reads it alongside enrichment.json (hand-curated wins).

Setup:
  1. Sign up at https://www.themoviedb.org and get a free v3 API key.
     (Settings → API → Create → Developer)
  2. export TMDB_API_KEY="your-key-here"
  3. python3 scripts/enrich_from_tmdb.py
  4. git add data/enrichment_tmdb.json && git commit && git push

Idempotent: re-running only fetches films that don't already have a TMDB match.
Safe to interrupt — partial results are saved every 5 films.

Stdlib only — no external dependencies.
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
DATA = ROOT / "data"

FILMS = DATA / "films.json"
OUT = DATA / "enrichment_tmdb.json"

API_KEY = os.environ.get("TMDB_API_KEY", "").strip()
BASE = "https://api.themoviedb.org/3"
IMG_BASE = "https://image.tmdb.org/t/p"  # append /w500/<poster_path>

SAVE_EVERY = 5  # save partial results every N films
SLEEP = 0.12    # be polite — TMDB allows ~50 req/sec, we use ~8


# Status codes we retry. 500/502/503/504 are transient on TMDB's side; 429 = rate-limited.
RETRY_STATUSES = {429, 500, 502, 503, 504}
MAX_RETRIES = 4   # so up to 5 attempts total per request
BASE_BACKOFF = 1.5  # seconds; doubled each retry


class TMDBError(Exception):
    def __init__(self, status, message):
        super().__init__(f"HTTP {status}: {message}")
        self.status = status


def http_get(path, **params):
    """GET a TMDB endpoint with exponential-backoff retry on 429/5xx."""
    params["api_key"] = API_KEY
    qs = urllib.parse.urlencode(params)
    url = f"{BASE}{path}?{qs}"
    req = urllib.request.Request(url, headers={"Accept": "application/json"})

    for attempt in range(MAX_RETRIES + 1):
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            status = e.code
            if status in RETRY_STATUSES and attempt < MAX_RETRIES:
                # Respect Retry-After when TMDB sends it (typical for 429)
                ra = e.headers.get("Retry-After") if e.headers else None
                if ra and ra.isdigit():
                    wait = int(ra)
                else:
                    wait = BASE_BACKOFF * (2 ** attempt)
                print(f"    {status} retry in {wait:.1f}s (attempt {attempt + 1}/{MAX_RETRIES})",
                      file=sys.stderr)
                time.sleep(wait)
                continue
            raise TMDBError(status, str(e))
        except urllib.error.URLError as e:
            # network blip — same backoff
            if attempt < MAX_RETRIES:
                wait = BASE_BACKOFF * (2 ** attempt)
                print(f"    network err ({e.reason}); retry in {wait:.1f}s", file=sys.stderr)
                time.sleep(wait)
                continue
            raise TMDBError(0, f"network: {e.reason}")
    # exhausted — shouldn't reach
    raise TMDBError(0, "max retries exceeded")


def normalize_title(s):
    s = s or ""
    # strip "4K" / "(IMAX)" / "(DOLBY VISION)" remnants
    s = re.sub(r"\b(4K|IMAX|3D IMAX|DOLBY VISION)\b", "", s, flags=re.IGNORECASE)
    s = re.sub(r"[\(\)（）\[\]【】]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def search_movie(title, year=None):
    """Returns (result_dict, error_str_or_None)."""
    title = normalize_title(title)
    if not title:
        return None, "empty-title"
    kwargs = {"query": title, "include_adult": "false", "language": "en-US"}
    if year:
        kwargs["year"] = str(year)
    try:
        data = http_get("/search/movie", **kwargs)
    except TMDBError as e:
        return None, f"search-{e.status}"
    results = data.get("results") or []
    if not results and year:
        try:
            data = http_get("/search/movie", query=title, include_adult="false", language="en-US")
            results = data.get("results") or []
        except TMDBError:
            pass
    if not results:
        return None, None  # no-match (not an error)

    def year_of(r):
        d = r.get("release_date") or ""
        return int(d[:4]) if d[:4].isdigit() else 0

    if year:
        results.sort(key=lambda r: (abs(year_of(r) - year), -r.get("popularity", 0)))
    else:
        results.sort(key=lambda r: -r.get("popularity", 0))
    return results[0], None


def fetch_details(tmdb_id):
    """Returns (en, zh, credits, error_str_or_None). en==None means details fetch failed."""
    try:
        en = http_get(f"/movie/{tmdb_id}", language="en-US")
    except TMDBError as e:
        return None, None, None, f"details-{e.status}"
    try:
        zh = http_get(f"/movie/{tmdb_id}", language="zh-CN")
    except TMDBError:
        zh = None
    try:
        credits = http_get(f"/movie/{tmdb_id}/credits", language="en-US")
    except TMDBError:
        credits = None
    return en, zh, credits, None


def pick_director(credits):
    if not credits:
        return None
    for c in credits.get("crew", []) or []:
        if c.get("job") == "Director":
            return c.get("name")
    return None


def country_of(en):
    if not en:
        return None
    pcs = en.get("production_countries") or []
    return ", ".join(p.get("name") for p in pcs if p.get("name")) or None


def needs_fetch(entry, mode):
    """mode = 'all' (skip success only) | 'retry-misses' (skip success, retry failures and no-match) | 'retry-errors' (only previous HTTP errors)."""
    if not entry:
        return True
    if entry.get("tmdb_id"):
        return False
    if entry.get("_error") == "audit-erased":
        return False  # stays erased until manually cleared from enrichment_tmdb.json
    if mode == "all":
        return True
    if mode == "retry-misses":
        return True
    if mode == "retry-errors":
        return bool(entry.get("_error")) and entry.get("_error") != "audit-erased"
    return False


def main():
    ap = argparse.ArgumentParser(description="Enrich films.json from TMDB.")
    ap.add_argument("--retry-errors", action="store_true",
                    help="Only re-fetch films that previously failed with an HTTP error "
                         "(useful after TMDB had a 500 spike).")
    ap.add_argument("--retry-all-misses", action="store_true",
                    help="Re-fetch every film that doesn't yet have a tmdb_id, "
                         "including 'no-match' entries from earlier runs.")
    args = ap.parse_args()

    if args.retry_errors:
        mode = "retry-errors"
    elif args.retry_all_misses:
        mode = "retry-misses"
    else:
        mode = "all"  # default: anything without a tmdb_id

    if not API_KEY:
        print("ERROR: set TMDB_API_KEY environment variable.\n"
              "       Get a free key at https://www.themoviedb.org/settings/api",
              file=sys.stderr)
        sys.exit(2)

    films = json.loads(FILMS.read_text(encoding="utf-8"))
    if OUT.exists():
        existing = json.loads(OUT.read_text(encoding="utf-8"))
    else:
        existing = {}

    n_total = len(films)
    n_skip = 0
    n_new = 0
    n_miss = 0
    n_err = 0

    for i, f in enumerate(films, 1):
        fid = f["id"]
        if not needs_fetch(existing.get(fid), mode):
            n_skip += 1
            continue

        title_en = f.get("title_en") or ""
        title_zh = f.get("title_zh") or ""
        year = f.get("year")
        label = title_en or title_zh

        print(f"[{i:3d}/{n_total}] {label[:50]:50s} ({year}) ...", end=" ", flush=True)
        match, search_err = search_movie(title_en, year=year)
        if not match and not search_err and title_zh:
            # Fallback: search by Chinese title
            match, search_err = search_movie(title_zh, year=year)

        if match:
            tmdb_id = match["id"]
            time.sleep(SLEEP)
            en, zh, credits, det_err = fetch_details(tmdb_id)
            time.sleep(SLEEP)
            if det_err and not en:
                # Details fetch failed — record the error so --retry-errors can pick it up later
                existing[fid] = {
                    "tmdb_id": None,
                    "_error": det_err,
                    "_attempted_tmdb_id": tmdb_id,
                    "_searched_at": int(time.time()),
                }
                print(f"DETAILS-ERR ({det_err})")
                n_err += 1
            else:
                entry = {
                    "tmdb_id": tmdb_id,
                    "imdb_id": (en or {}).get("imdb_id"),
                    "poster_url": (IMG_BASE + "/w500" + match["poster_path"]) if match.get("poster_path") else None,
                    "backdrop_url": (IMG_BASE + "/w1280" + en["backdrop_path"]) if en and en.get("backdrop_path") else None,
                    "synopsis_en": (en or {}).get("overview") or None,
                    "synopsis_zh": (zh or {}).get("overview") or None,
                    "director": pick_director(credits),
                    "country": country_of(en),
                    "runtime": (en or {}).get("runtime") or None,
                    "language": ((en or {}).get("original_language") or "").upper() or None,
                    "tmdb_title_en": (en or {}).get("title"),
                    "tmdb_title_zh": (zh or {}).get("title"),
                    "tmdb_release_date": (en or {}).get("release_date"),
                    "_searched_at": int(time.time()),
                }
                entry = {k: v for k, v in entry.items() if v not in (None, "", [])}
                existing[fid] = entry
                print(f"ok  imdb={entry.get('imdb_id', '—')}")
                n_new += 1
        elif search_err:
            existing[fid] = {
                "tmdb_id": None,
                "_error": search_err,
                "_searched_at": int(time.time()),
            }
            print(f"SEARCH-ERR ({search_err})")
            n_err += 1
        else:
            # Search succeeded but no result
            existing[fid] = {
                "tmdb_id": None,
                "_error": None,
                "_searched_at": int(time.time()),
            }
            print("no-match")
            n_miss += 1

        if (i % SAVE_EVERY) == 0:
            OUT.write_text(json.dumps(existing, ensure_ascii=False, indent=2), encoding="utf-8")
        time.sleep(SLEEP)

    OUT.write_text(json.dumps(existing, ensure_ascii=False, indent=2), encoding="utf-8")
    matched = sum(1 for v in existing.values() if v.get("tmdb_id"))
    err_remaining = [fid for fid, v in existing.items() if v.get("_error")]

    print()
    print(f"Mode: {mode}")
    print(f"Wrote {OUT} ({OUT.stat().st_size:,} bytes)")
    print(f"  total films:    {n_total}")
    print(f"  skipped (done): {n_skip}")
    print(f"  newly matched:  {n_new}")
    print(f"  no-match:       {n_miss}")
    print(f"  HTTP errors:    {n_err}")
    print(f"  ─────────────")
    print(f"  matched total:  {matched}/{n_total}")
    if err_remaining:
        print()
        print(f"  Films still in HTTP-error state ({len(err_remaining)}):")
        for fid in err_remaining[:15]:
            print(f"    - {fid}: {existing[fid].get('_error')}")
        if len(err_remaining) > 15:
            print(f"    ... and {len(err_remaining) - 15} more")
        print()
        print(f"  Rerun:  python3 scripts/enrich_from_tmdb.py --retry-errors")


if __name__ == "__main__":
    main()
