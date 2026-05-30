"""
Compare films.json (CSV-derived ground truth) against enrichment_tmdb.json
(auto-matched from TMDB) and bucket every match as ok / sus / wrong.

Heuristics
----------
Year delta (CSV year vs tmdb_release_date year):
    0          → strong positive
    1          → benign (production-year vs release-year)
    2-4        → suspicious
    >=5        → wrong (unless the title overlap is overwhelming)

Title overlap (Jaccard of stop-word-stripped tokens, CSV title_en vs tmdb_title_en):
    >=0.7      → strong positive
    0.4-0.7    → suspicious
    <0.4       → wrong (likely matched a different film entirely)

Combine — a match is `wrong` if BOTH year and title disagree, or if year
disagrees by 5+ even when title overlap is high (different film of same name).

Run modes
---------
    python3 scripts/audit_tmdb.py                  # print report only
    python3 scripts/audit_tmdb.py --erase          # also erase 'wrong' from enrichment_tmdb.json
"""

import argparse
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA = HERE.parent / "data"
FILMS = DATA / "films.json"
ENRICH = DATA / "enrichment_tmdb.json"

STOPWORDS = {"the", "a", "an", "of", "and", "to", "in", "on", "for", "at", "is", "le", "la", "les"}


def latin_tokens(s):
    s = (s or "").lower()
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    return {t for t in s.split() if t and t not in STOPWORDS}


def cjk_chars(s):
    return {c for c in (s or "") if "一" <= c <= "鿿"}


def jaccard_latin(a, b):
    ta, tb = latin_tokens(a), latin_tokens(b)
    if not ta and not tb:
        return None
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def jaccard_cjk(a, b):
    ca, cb = cjk_chars(a), cjk_chars(b)
    if not ca and not cb:
        return None
    if not ca or not cb:
        return 0.0
    return len(ca & cb) / len(ca | cb)


def classify(csv_year, tmdb_year, sim, has_tmdb_title):
    if not has_tmdb_title:
        return "thin", "tmdb-has-id-but-no-title-or-date"
    if tmdb_year is None:
        return "sus", "tmdb-has-no-date"
    yd = abs(csv_year - tmdb_year) if csv_year else None
    if yd is None:
        return "sus", "csv-has-no-year"
    if sim < 0.35:
        return "wrong", f"title-sim={sim:.2f}, year-diff={yd} — likely matched a different film"
    if yd >= 5 and sim < 0.7:
        return "wrong", f"year-off-by-{yd}, title-sim={sim:.2f}"
    if yd >= 5:
        return "sus", f"year-off-by-{yd}-but-title-matches"
    if yd >= 2 and sim < 0.4:
        return "wrong", f"year-off-by-{yd}, title-sim={sim:.2f}"
    if yd >= 2:
        return "sus", f"year-off-by-{yd}, title-sim={sim:.2f}"
    if sim < 0.4 and yd <= 1:
        return "sus", f"title-sim={sim:.2f} (year ok)"
    return "ok", ""


def audit():
    films = json.loads(FILMS.read_text(encoding="utf-8"))
    enr = json.loads(ENRICH.read_text(encoding="utf-8"))
    rows = []
    for f in films:
        e = enr.get(f["id"])
        if not e or not e.get("tmdb_id"):
            continue
        csv_year = f.get("year")
        tmdb_date = e.get("tmdb_release_date") or ""
        tmdb_year = int(tmdb_date[:4]) if tmdb_date[:4].isdigit() else None
        sim_en = jaccard_latin(f.get("title_en"), e.get("tmdb_title_en"))
        sim_zh = jaccard_cjk(f.get("title_zh"), e.get("tmdb_title_zh"))
        sims = [s for s in (sim_en, sim_zh) if s is not None]
        sim = max(sims) if sims else 0.0
        has_tmdb_title = bool(e.get("tmdb_title_en") or e.get("tmdb_title_zh"))
        verdict, reason = classify(csv_year, tmdb_year, sim, has_tmdb_title)
        rows.append({
            "id": f["id"],
            "csv_title_en": f.get("title_en"),
            "csv_title_zh": f.get("title_zh"),
            "csv_year": csv_year,
            "tmdb_title_en": e.get("tmdb_title_en"),
            "tmdb_title_zh": e.get("tmdb_title_zh"),
            "tmdb_year": tmdb_year,
            "tmdb_id": e.get("tmdb_id"),
            "sim": round(sim, 2),
            "sim_en": sim_en,
            "sim_zh": sim_zh,
            "verdict": verdict,
            "reason": reason,
        })
    return rows


def print_report(rows):
    by_verdict = {"wrong": [], "sus": [], "thin": [], "ok": []}
    for r in rows:
        by_verdict[r["verdict"]].append(r)

    print(f"Total matched: {len(rows)}")
    print(f"  ok:    {len(by_verdict['ok'])}")
    print(f"  thin:  {len(by_verdict['thin'])}  (TMDB id only, no usable metadata)")
    print(f"  sus:   {len(by_verdict['sus'])}")
    print(f"  wrong: {len(by_verdict['wrong'])}")

    for bucket in ("wrong", "sus", "thin"):
        if not by_verdict[bucket]:
            continue
        print()
        print(f"=== {bucket.upper()} ({len(by_verdict[bucket])}) ===")
        for r in sorted(by_verdict[bucket], key=lambda r: (r["verdict"], r["id"])):
            print(f"  {r['id']}")
            print(f"    CSV : {r['csv_title_en']!r} / {r['csv_title_zh']!r} ({r['csv_year']})")
            print(f"    TMDB: {r['tmdb_title_en']!r} / {r['tmdb_title_zh']!r} ({r['tmdb_year']})  tmdb_id={r['tmdb_id']}")
            print(f"    why : {r['reason']}")


def erase(rows):
    enr = json.loads(ENRICH.read_text(encoding="utf-8"))
    erased = 0
    for r in rows:
        if r["verdict"] != "wrong":
            continue
        enr[r["id"]] = {
            "tmdb_id": None,
            "_error": "audit-erased",
            "_reason": r["reason"],
            "_was_tmdb_id": r["tmdb_id"],
            "_was_tmdb_title_en": r["tmdb_title_en"],
            "_was_tmdb_year": r["tmdb_year"],
        }
        erased += 1
    ENRICH.write_text(json.dumps(enr, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nErased {erased} wrong entries from {ENRICH.name}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--erase", action="store_true",
                    help="Replace 'wrong' entries with audit-erased stubs.")
    args = ap.parse_args()

    rows = audit()
    print_report(rows)
    if args.erase:
        erase(rows)


if __name__ == "__main__":
    main()
