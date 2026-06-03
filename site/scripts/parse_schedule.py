"""
Parse the official SIFF schedule JSON (cndata-*.json) into:
  - public/schedule-data.js  (real showtimes, plus any new films/programs/venues)

It also updates:
  - data/programs.json  (appending newly-announced programs)
  - data/films.json     (appending newly-announced films)

The schedule JSON is an array of per-screening records with the full pairing:
  cinema · date · stime · filmId · nameCn · nameEn · group · hallsName · length · ...

We match each row to the catalogue (programs.json / films.json / theatres.js).
Anything that doesn't match is added — so the catalogue always covers everything
the schedule mentions.

Run from `site/`:
  python3 scripts/parse_schedule.py
  python3 scripts/build_data.py        # regenerate public/data.js
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
REPO = ROOT.parent
DATA = ROOT / "data"
PUB = ROOT / "public"
SRC = REPO / "cndata-20260603-001.json"


# --------------------------------------------------------------------------
# Schedule-group ZH name  ->  catalogue program id
# (covers groups whose names don't normalize cleanly to an existing program)
# --------------------------------------------------------------------------
GROUP_OVERRIDES: dict[str, str] = {
    "金爵奖参赛片-主竞赛": "goblet-main",
    "金爵奖参赛片-亚洲新人奖": "goblet-asian-talent",
    "金爵奖参赛片-纪录片": "goblet-documentary",
    "金爵奖参赛片-动画片": "goblet-animation",
    "金爵奖参赛片-短片": "goblet-short-live",
}


# --------------------------------------------------------------------------
# Groups that should become *new* programs (they don't exist in programs.json
# at all). Mapping holds the program record to append.
# --------------------------------------------------------------------------
NEW_PROGRAMS: dict[str, dict] = {
    "向大师致敬-电影骑士安杰伊·瓦伊达": {
        "id": "tribute-wajda",
        "title_en": "Tribute · Andrzej Wajda, Knight of Cinema",
        "title_zh": "向大师致敬 ｜ 电影骑士安杰伊·瓦伊达",
        "short_en": "Andrzej Wajda",
        "short_zh": "瓦伊达",
        "kind_en": "Tribute",
        "kind_zh": "向大师致敬",
        "blurb_en": "Six landmark works from the late Polish master, restored where possible.",
        "blurb_zh": "波兰电影大师的六部里程碑之作，尽可能呈现修复版本。",
        "color": "#8a5a3a",
    },
    "置身扩影": {
        "id": "immersive-cinema",
        "title_en": "Immersive Cinema",
        "title_zh": "置身扩影",
        "short_en": "Immersive Cinema",
        "short_zh": "置身扩影",
        "kind_en": "Special Program",
        "kind_zh": "特别企划",
        "blurb_en": "Experimental works that push the boundary between screen and space.",
        "blurb_zh": "在银幕与空间之间寻求突破的实验影像。",
        "color": "#3a7a8a",
    },
    "多元视角-开云特别支持": {
        "id": "kering-special",
        "title_en": "Spectrum · Kering Special Support",
        "title_zh": "多元视角 ｜ 开云特别支持",
        "short_en": "Kering Special",
        "short_zh": "开云特别",
        "kind_en": "Special Program",
        "kind_zh": "特别企划",
        "blurb_en": "Spectrum strand presented in partnership with Kering.",
        "blurb_zh": "由开云集团特别支持的多元视角单元。",
        "color": "#a6873a",
    },
    "华语新风": {
        "id": "chinese-new-wave",
        "title_en": "Chinese New Wave",
        "title_zh": "华语新风",
        "short_en": "Chinese New Wave",
        "short_zh": "华语新风",
        "kind_en": "Section",
        "kind_zh": "单元",
        "blurb_en": "Fresh voices from the Mandarin- and Cantonese-speaking world.",
        "blurb_zh": "来自华语世界的崭新创作之声。",
        "color": "#c8392a",
    },
    "世界万象-英伦精选": {
        "id": "focus-uk",
        "title_en": "Focus on the UK",
        "title_zh": "世界万象 ｜ 英伦精选",
        "short_en": "Focus on UK",
        "short_zh": "英伦精选",
        "kind_en": "Curated Program",
        "kind_zh": "策展单元",
        "blurb_en": "A British selection within the World Cinema strand.",
        "blurb_zh": "世界万象单元中的英伦精选。",
        "color": "#1d3a8a",
    },
    "特别策划-光影浪潮·香港电影新动力": {
        "id": "hk-new-wave",
        "title_en": "Special Selection · Hong Kong New Energy",
        "title_zh": "特别策划 ｜ 光影浪潮·香港电影新动力",
        "short_en": "HK New Energy",
        "short_zh": "香港新动力",
        "kind_en": "Special Selection",
        "kind_zh": "特别策划",
        "blurb_en": "New voices and currents in contemporary Hong Kong cinema.",
        "blurb_zh": "当下香港电影的新声与新潮。",
        "color": "#a6353d",
    },
    "世界万象-博斯普鲁斯之眼": {
        "id": "bosphorus-eye",
        "title_en": "Focus on Türkiye · Eye on the Bosphorus",
        "title_zh": "世界万象 ｜ 博斯普鲁斯之眼",
        "short_en": "Eye on Bosphorus",
        "short_zh": "博斯普鲁斯之眼",
        "kind_en": "Curated Program",
        "kind_zh": "策展单元",
        "blurb_en": "A Turkish selection within the World Cinema strand.",
        "blurb_zh": "世界万象中的土耳其电影精选。",
        "color": "#c44a2a",
    },
    "科幻电影周-史蒂文·斯皮尔伯格科幻片经典": {
        "id": "spielberg-scifi",
        "title_en": "Sci-Fi Week · Spielberg Sci-Fi Classics",
        "title_zh": "科幻电影周 ｜ 史蒂文·斯皮尔伯格科幻片经典",
        "short_en": "Spielberg Sci-Fi",
        "short_zh": "斯皮尔伯格科幻",
        "kind_en": "Curated Program",
        "kind_zh": "策展单元",
        "blurb_en": "Spielberg's foundational science-fiction films, paired in tribute.",
        "blurb_zh": "斯皮尔伯格科幻经典致敬展。",
        "color": "#2a5a8a",
    },
    "科幻电影周-阿内·拉鲁科幻动画三部曲": {
        "id": "laloux-trilogy",
        "title_en": "Sci-Fi Week · René Laloux Sci-Fi Animation Trilogy",
        "title_zh": "科幻电影周 ｜ 阿内·拉鲁科幻动画三部曲",
        "short_en": "Laloux Trilogy",
        "short_zh": "拉鲁三部曲",
        "kind_en": "Curated Program",
        "kind_zh": "策展单元",
        "blurb_en": "Three landmark animated sci-fi features from René Laloux.",
        "blurb_zh": "法国动画大师阿内·拉鲁的三部科幻经典。",
        "color": "#7a3aa6",
    },
    "世界万象-巴西速写": {
        "id": "brazil-sketches",
        "title_en": "Focus on Brazil · Brazilian Sketches",
        "title_zh": "世界万象 ｜ 巴西速写",
        "short_en": "Brazil Sketches",
        "short_zh": "巴西速写",
        "kind_en": "Curated Program",
        "kind_zh": "策展单元",
        "blurb_en": "A Brazilian selection within the World Cinema strand.",
        "blurb_zh": "世界万象中的巴西影像速写。",
        "color": "#0f5f3f",
    },
    "特别放映": {
        "id": "special-screenings",
        "title_en": "Special Screenings",
        "title_zh": "特别放映",
        "short_en": "Special Screenings",
        "short_zh": "特别放映",
        "kind_en": "Special Program",
        "kind_zh": "特别企划",
        "blurb_en": "Out-of-strand special presentations.",
        "blurb_zh": "单元之外的特别呈现。",
        "color": "#5a5a5a",
    },
    "开闭幕片": {
        "id": "opening-closing",
        "title_en": "Opening & Closing Films",
        "title_zh": "开闭幕片",
        "short_en": "Opening / Closing",
        "short_zh": "开闭幕",
        "kind_en": "Festival Highlights",
        "kind_zh": "影展精粹",
        "blurb_en": "The festival's opening and closing-night presentations.",
        "blurb_zh": "电影节的开幕与闭幕之作。",
        "color": "#c8a23a",
    },
}


# --------------------------------------------------------------------------
# Schedule cinema ZH name  ->  catalogue theatre id (typos / variant naming)
# --------------------------------------------------------------------------
CINEMA_OVERRIDES: dict[str, str] = {
    "MOViE MOViE影城（前滩太古里店）": "t26",
    "SFC上影百联影城（八佰伴IMAX店）": "t28",
    "SFC永华电影荟（世纪汇店）": "t30",
    "久事·上海商城剧院": "t13",
    "九棵树未来艺术中心": "t45",
    "博悦汇影城(BFC外滩金融中心店)": "t08",
    "嘉定影剧院": "t42",
    "寰映影城（大融城店）": "t14",
    "星轶STARX影剧院（上海宝山日月光店）": "t41",
}

# --------------------------------------------------------------------------
# Cinemas in the schedule that aren't in theatres.js. These get added.
# --------------------------------------------------------------------------
NEW_THEATRES = [
    {
        "id": "t53",
        "city": "Shanghai",
        "region": "Xuhui",
        "nameEn": "Duoyunxuan Dolby Atmos Cinema",
        "nameZh": "朵云轩杜比全景声影城",
        "addr": "天钥桥路1188号",
        "flagship": False,
        "imax": False,
        "format": True,
    },
    {
        "id": "t54",
        "city": "Shanghai",
        "region": "Jing'an",
        "nameEn": "Shanghai Yihai Theatre",
        "nameZh": "上海艺海剧院",
        "addr": "江宁路466号",
        "flagship": True,
        "imax": False,
        "format": False,
    },
    {
        "id": "t55",
        "city": "Shanghai",
        "region": "Jing'an",
        "nameEn": "Shanghai Hubei Cinema",
        "nameZh": "上海市沪北电影院",
        "addr": "中华新路1207号",
        "flagship": False,
        "imax": False,
        "format": False,
    },
]
NEW_THEATRE_BY_ZH = {t["nameZh"]: t for t in NEW_THEATRES}


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------
_PROG_PREFIXES = [
    "向大师致敬-", "向大师致敬｜",
    "新视野-",
    "金爵奖参赛片-",
    "多元视角-",
    "世界万象-",
    "特别策划-", "特别策划｜",
    "官方推荐-",
    "科幻电影周-",
    "今日亚洲-",
    "SIFF经典-",
    "系列电影 -", "系列电影-", "系列电影｜",
]


def _strip_prog_prefix(s: str) -> str:
    for p in _PROG_PREFIXES:
        if s.startswith(p):
            return s[len(p):]
    return s


def _norm_prog(s: str | None) -> str:
    if not s:
        return ""
    return re.sub(r"[\s\-\|｜·•‧\-－—–_／/]+", "", s).lower()


def _norm_cinema(s: str | None) -> str:
    """Normalize cinema names so half-width and full-width punctuation match."""
    if not s:
        return ""
    s = s.strip()
    # Normalize whitespace + every common bracket / dash variant to nothing
    s = re.sub(r"[\s\(\)（）【】\[\]\-－—–·•‧]", "", s)
    return s


_FORMAT_KW = r"(4K|IMAX|HDR|DOLBY|杜比|3D|2K|DCP|RESTORED|CINITY|LUXE|ONYX|REALD|ATMOS|VISION|HFR)"


def _norm_title(s: str | None) -> str:
    if not s:
        return ""
    s_u = s.upper()
    # Drop parens that contain a known format keyword (4K, IMAX, Dolby, ...).
    # We must NOT strip parens like "(上)" / "(下)" / "(Part 1)" — those are
    # legitimate title disambiguators (Deathly Hallows Pt 1 vs Pt 2 etc).
    s = re.sub(
        r"[\(（][^）)]*" + _FORMAT_KW + r"[^）)]*[\)）]",
        "",
        s_u,
        flags=re.I,
    )
    s = re.sub(r"[\s\(\)（）【】·\-:：!！?？.,，。、\"'•‧]", "", s)
    return s.upper()


def _slugify(s: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s.lower()).strip("-")
    return s or "film"


def _parse_runtime(length: str | None) -> int | None:
    if not length:
        return None
    m = re.search(r"(\d+)", length)
    return int(m.group(1)) if m else None


def _detect_format(*texts: str | None) -> str | None:
    """Pull a format tag out of nameCn / hallsName / format."""
    blob = " ".join(t for t in texts if t)
    blob_u = blob.upper()
    # Priority order matters: CINITY / IMAX / 4DX / LUXE / Dolby / 4K
    for kw, tag in (
        ("CINITY", "CINITY"),
        ("IMAX", "IMAX"),
        ("4DX", "4DX"),
        ("LUXE", "LUXE"),
        ("ONYX", "ONYX"),
        ("REALD", "RealD"),
        ("ATMOS", "Atmos"),
        ("杜比剧场", "Dolby"),
        ("杜比影院", "Dolby"),
        ("DOLBY", "Dolby"),
        ("4K", "4K"),
    ):
        if kw in blob_u:
            return tag
    return None


def _read_theatres() -> list[dict]:
    js = (PUB / "theatres.js").read_text(encoding="utf-8")
    m = re.search(r"\[(.*?)\];", js, re.S)
    body = m.group(1)
    return [json.loads(r) for r in re.findall(r"\{[^}]+\}", body)]


# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------
def main() -> None:
    rows = json.loads(SRC.read_text(encoding="utf-8"))
    programs = json.loads((DATA / "programs.json").read_text(encoding="utf-8"))
    films = json.loads((DATA / "films.json").read_text(encoding="utf-8"))
    theatres = _read_theatres()

    # Build lookup indexes
    prog_by_id = {p["id"]: p for p in programs}
    prog_by_norm = {_norm_prog(p["title_zh"]): p["id"] for p in programs}
    for p in programs:
        prog_by_norm.setdefault(_norm_prog(_strip_prog_prefix(p["title_zh"])), p["id"])

    theatre_by_zh = {t["nameZh"]: t["id"] for t in theatres}
    theatre_by_zh_norm = {_norm_cinema(t["nameZh"]): t["id"] for t in theatres}
    cinema_overrides_norm = {_norm_cinema(k): v for k, v in CINEMA_OVERRIDES.items()}
    new_theatre_by_zh_norm = {_norm_cinema(t["nameZh"]): t for t in NEW_THEATRES}

    films_by_zh: dict[str, list[dict]] = {}
    films_by_en: dict[str, list[dict]] = {}
    for f in films:
        if f.get("title_zh"):
            films_by_zh.setdefault(_norm_title(f["title_zh"]), []).append(f)
        if f.get("title_en"):
            films_by_en.setdefault(_norm_title(f["title_en"]), []).append(f)

    # ------------------------------------------------------------------
    # 1) Resolve each schedule group to a program_id, appending new ones.
    # ------------------------------------------------------------------
    base_order = max((p.get("order", 0) for p in programs), default=0)
    group_to_pid: dict[str, str] = {}
    appended_programs: list[dict] = []

    # Maintain insertion order over the schedule's natural iteration order.
    seen_groups = []
    for r in rows:
        g = r["group"]
        if g not in seen_groups:
            seen_groups.append(g)

    for g in seen_groups:
        if g in GROUP_OVERRIDES:
            group_to_pid[g] = GROUP_OVERRIDES[g]
            continue
        pid = prog_by_norm.get(_norm_prog(g)) or prog_by_norm.get(_norm_prog(_strip_prog_prefix(g)))
        if pid:
            group_to_pid[g] = pid
            continue
        if g in NEW_PROGRAMS:
            np = dict(NEW_PROGRAMS[g])
            base_order += 1
            np["order"] = base_order
            programs.append(np)
            prog_by_id[np["id"]] = np
            appended_programs.append(np)
            group_to_pid[g] = np["id"]
            continue
        # Last-resort: synthesize a placeholder program so nothing is lost.
        base_order += 1
        synth = {
            "id": f"sched-{_slugify(g)[:40]}-{base_order}",
            "title_en": g,
            "title_zh": g,
            "short_en": g[:24],
            "short_zh": g[:12],
            "kind_en": "Section",
            "kind_zh": "单元",
            "blurb_en": "",
            "blurb_zh": "",
            "color": "#666666",
            "order": base_order,
        }
        programs.append(synth)
        prog_by_id[synth["id"]] = synth
        appended_programs.append(synth)
        group_to_pid[g] = synth["id"]

    # ------------------------------------------------------------------
    # 2) Resolve each schedule filmId to a catalogue film id (or add new).
    # ------------------------------------------------------------------
    siff_to_film: dict[str, str] = {}  # numeric SIFF filmId -> catalogue id
    appended_films: list[dict] = []
    seen_film_ids: dict[str, dict] = {}
    for r in rows:
        if r["filmId"] not in seen_film_ids:
            seen_film_ids[r["filmId"]] = r

    for sid, sample in seen_film_ids.items():
        cz = films_by_zh.get(_norm_title(sample["nameCn"]), [])
        ce = films_by_en.get(_norm_title(sample["nameEn"]), [])
        cand = cz[0] if cz else (ce[0] if ce else None)
        if cand:
            siff_to_film[sid] = cand["id"]
            # Backfill metadata when the catalogue had blanks
            for src_key, dest_key in (
                ("director", "director"),
                ("country", "country"),
                ("synopsis", "synopsis_zh"),
            ):
                if not cand.get(dest_key) and sample.get(src_key):
                    cand[dest_key] = sample[src_key]
            rt = _parse_runtime(sample.get("length"))
            if rt and not cand.get("runtime"):
                cand["runtime"] = rt
            continue
        # Add a brand-new catalogue film for this schedule filmId
        pid = group_to_pid[sample["group"]]
        new_id = f"sched-{sid}-{_slugify(sample['nameEn'] or sample['nameCn'])[:40]}"
        prog = prog_by_id[pid]
        film: dict = {
            "id": new_id,
            "title_en": (sample.get("nameEn") or "").strip() or sample.get("nameCn", ""),
            "title_zh": (sample.get("nameCn") or "").strip(),
            "year": None,
            "format_tags": [],
            "program_id": pid,
            "program_en": prog["title_en"],
            "program_zh": prog["title_zh"],
            "order_in_program": 0,
            "color": prog.get("color") or "#666666",
            "director": (sample.get("director") or None),
            "director_zh": None,
            "country": (sample.get("country") or None),
            "country_zh": (sample.get("country") or None),
            "runtime": _parse_runtime(sample.get("length")),
            "language": None,
            "synopsis_en": None,
            "synopsis_zh": (sample.get("synopsis") or None),
            "poster_url": None,
            "premiere": None,
            "imdb_id": None,
            "tmdb_id": None,
        }
        films.append(film)
        appended_films.append(film)
        siff_to_film[sid] = new_id
        films_by_zh.setdefault(_norm_title(film["title_zh"]), []).append(film)
        films_by_en.setdefault(_norm_title(film["title_en"]), []).append(film)

    # ------------------------------------------------------------------
    # 3) Resolve cinemas to theatre ids (with overrides + new venues).
    # ------------------------------------------------------------------
    appended_theatres: list[dict] = []
    cinema_to_tid: dict[str, str] = {}
    for r in rows:
        c = r["cinema"]
        if c in cinema_to_tid:
            continue
        cn = _norm_cinema(c)
        tid = (
            cinema_overrides_norm.get(cn)
            or theatre_by_zh_norm.get(cn)
        )
        if tid:
            cinema_to_tid[c] = tid
            continue
        nt = new_theatre_by_zh_norm.get(cn)
        if nt:
            if nt["id"] not in {t["id"] for t in theatres}:
                theatres.append(nt)
                appended_theatres.append(nt)
                theatre_by_zh_norm[_norm_cinema(nt["nameZh"])] = nt["id"]
            cinema_to_tid[c] = nt["id"]
            continue
        # Hard failure: surface it so we can fix the override table.
        raise SystemExit(
            f"Unmapped cinema {c!r} — add an override in CINEMA_OVERRIDES or NEW_THEATRES."
        )

    # ------------------------------------------------------------------
    # 4) Build screenings.
    # ------------------------------------------------------------------
    screenings = []
    by_film: dict[str, list[str]] = {}
    seen_ids = set()
    for i, r in enumerate(rows):
        date = r.get("date", "")
        m_d = re.search(r"(\d+)\s*月\s*(\d+)\s*日", date)
        if not m_d:
            continue
        day = int(m_d.group(2))
        di = day - 12  # Jun 12 = 0 ... Jun 21 = 9
        if di < 0 or di > 9:
            continue
        t = (r.get("stime") or "").strip()
        if not re.match(r"^\d{1,2}:\d{2}$", t):
            continue
        h, mm = t.split(":")
        mins = int(h) * 60 + int(mm)
        film_id = siff_to_film.get(r["filmId"])
        th_id = cinema_to_tid[r["cinema"]]
        if not film_id:
            continue
        fmt = _detect_format(r.get("nameCn"), r.get("hallsName"), r.get("format"))
        # Use the SIFF record id when possible (stable, deterministic).
        scr_id = f"s-{r.get('id') or i}"
        if scr_id in seen_ids:
            scr_id = f"s-{r.get('id') or i}-{i}"
        seen_ids.add(scr_id)
        screening = {
            "id": scr_id,
            "f": film_id,
            "di": di,
            "t": t,
            "m": mins,
            "th": th_id,
            "fmt": fmt,
        }
        screenings.append(screening)
        by_film.setdefault(film_id, []).append(scr_id)

    # Sort each film's screenings chronologically
    scr_by_id = {s["id"]: s for s in screenings}
    for fid in by_film:
        by_film[fid].sort(key=lambda sid: (scr_by_id[sid]["di"], scr_by_id[sid]["m"]))

    # ------------------------------------------------------------------
    # 5) Persist updated catalogue inputs.
    # ------------------------------------------------------------------
    (DATA / "programs.json").write_text(
        json.dumps(programs, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (DATA / "films.json").write_text(
        json.dumps(films, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    # Rewrite theatres.js when we added new venues
    if appended_theatres:
        header = (
            "// SIFF 2026 — festival venues, parsed from SIFF_2026_Theatres.csv\n"
            "// flags: flagship (premiere/gala houses), imax (true IMAX / giant-screen),\n"
            "//        format (premium-format: LUXE / CINITY / Dolby / 4DX / boutique).\n"
            "// region = Shanghai district, or city for out-of-town venues.\n"
        )
        body = "window.SIFF_THEATRES = [\n"
        for t in theatres:
            body += "  " + json.dumps(t, ensure_ascii=False) + ",\n"
        body = body.rstrip(",\n") + "\n];\n"
        (PUB / "theatres.js").write_text(header + body, encoding="utf-8")

    # ------------------------------------------------------------------
    # 6) Emit schedule-data.js
    # ------------------------------------------------------------------
    src_label = SRC.name
    out_lines: list[str] = []
    out_lines.append(f"// SIFF 2026 — REAL festival schedule, parsed from {src_label}.")
    out_lines.append(
        f"// {len(screenings):,} screenings across "
        f"{len(by_film)} films, Jun 12-21, 2026."
    )
    out_lines.append("// Generated by scripts/parse_schedule.py.")
    out_lines.append("(function () {")
    out_lines.append("  const SCREENINGS = " + json.dumps(screenings, ensure_ascii=False) + ";")
    out_lines.append("  const BY_FILM = " + json.dumps(by_film, ensure_ascii=False) + ";")
    out_lines.append("  window.SIFF_SCREENINGS = SCREENINGS;")
    out_lines.append("  window.SIFF_SCREENINGS_BY_FILM = BY_FILM;")
    out_lines.append("})();")

    (PUB / "schedule-data.js").write_text("\n".join(out_lines) + "\n", encoding="utf-8")

    # ------------------------------------------------------------------
    # Report
    # ------------------------------------------------------------------
    print(f"Read {len(rows):,} schedule rows from {SRC.name}")
    print(f"Programs: {len(programs)}  (added {len(appended_programs)})")
    print(f"Films:    {len(films)}  (added {len(appended_films)})")
    print(f"Theatres: {len(theatres)}  (added {len(appended_theatres)})")
    print(f"Screenings: {len(screenings):,}")
    print(f"Films with showtimes: {len(by_film)}")
    print(f"Wrote {PUB / 'schedule-data.js'}")


if __name__ == "__main__":
    main()
