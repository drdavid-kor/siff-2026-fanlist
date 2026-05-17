"""
Parse SIFF 2026 raw CSV crawl into structured JSON.

Reads:   ../data/siff-com-2026-05-17.csv
Writes:  ../data/programs.json   (array of program objects)
         ../data/films.json      (array of film objects, keyed by id)

Each line of `film_title_english` looks like:
    中文片名 | ENGLISH TITLE | YEAR
or  中文片名丨ENGLISH TITLE丨YEAR
with occasional suffixes like "4K", "(IMAX)", "(DOLBY VISION)", "(3D IMAX)".

Extending the catalog later: drop new rows into the CSV (same format)
or append to programs.json / films.json directly.
"""

import csv
import json
import re
import unicodedata
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
SRC = ROOT / "data" / "siff-com-2026-05-17.csv"
OUT_PROGRAMS = ROOT / "data" / "programs.json"
OUT_FILMS = ROOT / "data" / "films.json"

# ---------- helpers ----------

# Common program-name (Chinese) -> {en short label, en long, palette accent}
PROGRAM_META = {
    "特别策划 ｜ 泥土与灵魂：陀思妥耶夫斯基的银幕变奏": {
        "id": "dostoyevsky",
        "en": "Soil & Soul: Dostoyevsky on Screen",
        "short_en": "Dostoyevsky on Screen",
        "short_zh": "陀思妥耶夫斯基",
        "kind": "Special Selection",
        "kind_zh": "特别策划",
        "blurb_en": "Five screen variations on the Russian master, from Bresson's chamber severity to Villeneuve's mirrored unease.",
        "blurb_zh": "陀思妥耶夫斯基的五次银幕变奏，从布列松的室内严苛，到维伦纽瓦的双生不安。",
        "color": "#7a3a30",
    },
    "影展精粹": {
        "id": "official-selection",
        "en": "Official Selection",
        "short_en": "Official Selection",
        "short_zh": "影展精粹",
        "kind": "Festival Highlights",
        "kind_zh": "影展精粹",
        "blurb_en": "Major prize-winners and most-talked-about titles from the year's leading festivals.",
        "blurb_zh": "本年度国际重要电影节上的得奖与话题之作。",
        "color": "#c8392a",
    },
    "“一带一路”电影周": {
        "id": "belt-and-road",
        "en": "Belt & Road Film Week",
        "short_en": "Belt & Road",
        "short_zh": "一带一路",
        "kind": "Curated Program",
        "kind_zh": "策展单元",
        "blurb_en": "New voices from countries along the Belt and Road, in their own tongues.",
        "blurb_zh": "来自一带一路沿线国家的新作，以各自的母语讲述。",
        "color": "#b8843a",
    },
    "SIFF动画": {
        "id": "siff-animation",
        "en": "SIFF Animation",
        "short_en": "Animation",
        "short_zh": "动画",
        "kind": "Section",
        "kind_zh": "单元",
        "blurb_en": "Hand-drawn, stop-motion, and computer-animated features — for the whole family.",
        "blurb_zh": "手绘、定格与电脑动画长片——适合全家共赏。",
        "color": "#d4a02a",
    },
    "向大师致敬 ｜ 狂野之梦：比利·怀尔德 x 玛丽莲·梦露": {
        "id": "tribute-wilder-monroe",
        "en": "Tribute · Wild Dreams: Billy Wilder × Marilyn Monroe",
        "short_en": "Wilder × Monroe",
        "short_zh": "怀尔德 × 梦露",
        "kind": "Tribute",
        "kind_zh": "向大师致敬",
        "blurb_en": "Eight films from the partnership and orbit of two Hollywood legends, restored where possible.",
        "blurb_zh": "比利·怀尔德与玛丽莲·梦露轨道交汇的八部经典，尽可能呈现修复版本。",
        "color": "#d65a8f",
    },
    "年度亚洲电影": {
        "id": "asian-film-of-the-year",
        "en": "Asian Film of the Year",
        "short_en": "Asian Film",
        "short_zh": "年度亚洲",
        "kind": "Section",
        "kind_zh": "单元",
        "blurb_en": "Standout features from across the Asian production landscape.",
        "blurb_zh": "本年度亚洲电影中的醒目之作。",
        "color": "#2f6f6a",
    },
    "名导新作": {
        "id": "auteurs-new",
        "en": "New Films by Renowned Directors",
        "short_en": "Auteurs · New",
        "short_zh": "名导新作",
        "kind": "Section",
        "kind_zh": "单元",
        "blurb_en": "The latest from filmmakers whose names alone bring the room in.",
        "blurb_zh": "重要作者导演的最新作品。",
        "color": "#3a4a5e",
    },
    "放大": {
        "id": "blow-up",
        "en": "Blow-Up",
        "short_en": "Blow-Up",
        "short_zh": "放大",
        "kind": "Section",
        "kind_zh": "单元",
        "blurb_en": "Genre cinema at scale — sharp, propulsive, made to be seen big.",
        "blurb_zh": "类型电影的放大尺寸——锋利、推进，且必须在大银幕观看。",
        "color": "#4a3a2a",
    },
    "向大师致敬 ｜ 写实巨匠肯·洛奇": {
        "id": "tribute-ken-loach",
        "en": "Tribute · Ken Loach, Master of Realism",
        "short_en": "Ken Loach",
        "short_zh": "肯·洛奇",
        "kind": "Tribute",
        "kind_zh": "向大师致敬",
        "blurb_en": "A through-line of working-class British cinema, from Kes to The Old Oak.",
        "blurb_zh": "从《小孩与鹰》到《老橡树酒馆》——一条延续半世纪的英伦工人阶级叙事。",
        "color": "#5a4a3a",
    },
    "科幻电影周": {
        "id": "sci-fi-week",
        "en": "Sci-Fi Film Week",
        "short_en": "Sci-Fi Week",
        "short_zh": "科幻",
        "kind": "Curated Program",
        "kind_zh": "策展单元",
        "blurb_en": "Imagined futures, restored and reframed.",
        "blurb_zh": "被修复、被重新框定的想象未来。",
        "color": "#3a3a6a",
    },
    "新视野 ｜ 杜比视界": {
        "id": "new-horizons-dolby",
        "en": "New Horizons · Dolby Vision",
        "short_en": "Dolby Vision",
        "short_zh": "杜比视界",
        "kind": "Format Showcase",
        "kind_zh": "格式展映",
        "blurb_en": "Films presented in Dolby Vision HDR — full dynamic range, original intent.",
        "blurb_zh": "杜比视界 HDR 呈现——完整动态范围，忠实创作意图。",
        "color": "#1d3a8a",
    },
    "向大师致敬｜特别纪念": {
        "id": "tribute-memorial",
        "en": "Tribute · In Memoriam",
        "short_en": "In Memoriam",
        "short_zh": "特别纪念",
        "kind": "Tribute",
        "kind_zh": "向大师致敬",
        "blurb_en": "Programs of remembrance — Yi Wen, Godard, Reiner, Rob Reiner's circle, Ke Jin, Béla Tarr.",
        "blurb_zh": "致敬过往：易文、戈达尔、罗伯·莱纳一脉，及贝拉·塔尔的全景式回顾。",
        "color": "#3a3a3a",
    },
    "影史推荐": {
        "id": "film-history",
        "en": "From Film History",
        "short_en": "Film History",
        "short_zh": "影史",
        "kind": "Section",
        "kind_zh": "单元",
        "blurb_en": "A spine of classics — silent to '90s — re-met on the big screen.",
        "blurb_zh": "一条经典脊柱：从默片到九十年代，重返大银幕。",
        "color": "#7a5530",
    },
    "影像无限": {
        "id": "image-unlimited",
        "en": "Image Unlimited",
        "short_en": "Image Unlimited",
        "short_zh": "影像无限",
        "kind": "Special Program",
        "kind_zh": "特别企划",
        "blurb_en": "Films that stretch what a film can do — concert, performance, hybrid.",
        "blurb_zh": "拓展电影边界的作品——音乐会、现场、混合形式。",
        "color": "#5a3aa6",
    },
    "SIFF狂想曲": {
        "id": "siff-rhapsody",
        "en": "SIFF Rhapsody",
        "short_en": "Rhapsody",
        "short_zh": "狂想曲",
        "kind": "Curated Program",
        "kind_zh": "策展单元",
        "blurb_en": "Films about music, musicians, and the lives shaped by both.",
        "blurb_zh": "关于音乐、音乐家，以及被音乐塑形的人生。",
        "color": "#a05050",
    },
    "新视野 ｜ IMAX": {
        "id": "new-horizons-imax",
        "en": "New Horizons · IMAX",
        "short_en": "IMAX",
        "short_zh": "IMAX",
        "kind": "Format Showcase",
        "kind_zh": "格式展映",
        "blurb_en": "Eight titles in true IMAX presentation — including restored concert films.",
        "blurb_zh": "八部 IMAX 呈现的影片——包含修复版演唱会电影。",
        "color": "#0f5f3f",
    },
}


def slugify(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-").lower()
    return s or "untitled"


# Split tokens used inside the data block. Some rows use ASCII '|', others 丨 (U+4E28).
SPLIT_RE = re.compile(r"\s*[|丨｜]\s*")


def parse_film_line(raw: str):
    """Parse one line like '中文片名 | ENGLISH TITLE | YEAR' -> dict or None."""
    line = raw.strip().strip("　 ").strip()
    if not line:
        return None
    if line.startswith("注："):  # editorial footnote
        return None
    parts = [p.strip() for p in SPLIT_RE.split(line) if p.strip()]
    if len(parts) < 2:
        return None
    # Find a 4-digit year token (last numeric)
    year = None
    for p in reversed(parts):
        m = re.search(r"\b(19|20)\d{2}\b", p)
        if m:
            year = int(m.group(0))
            break
    # Strip any year-only trailing parts
    parts = [p for p in parts if not re.fullmatch(r"(19|20)\d{2}", p)]
    if not parts:
        return None
    zh = parts[0]
    en = parts[1] if len(parts) >= 2 else ""
    # Detect format tags
    format_tags = []
    for tag in ("4K", "IMAX", "3D IMAX", "DOLBY VISION"):
        if tag in en.upper() or tag in zh.upper():
            format_tags.append(tag)
    # Clean parenthetical/format suffixes from display titles (ASCII + fullwidth parens)
    def clean(s):
        s = re.sub(r"[\(（]\s*(IMAX|3D IMAX|DOLBY VISION|4K)\s*[\)）]", "", s, flags=re.IGNORECASE)
        s = re.sub(r"\s*4K\s*$", "", s)
        s = re.sub(r"\s{2,}", " ", s).strip()
        return s
    return {
        "title_zh": clean(zh),
        "title_en": clean(en),
        "year": year,
        "format_tags": format_tags,
        "raw": line,
    }


def split_data_block(block: str):
    # Lines are separated by newlines (sometimes with separator paragraphs).
    return [parse_film_line(L) for L in block.splitlines() if L.strip()]


# ---------- main ----------

def main():
    programs = []
    films = []
    used_ids = set()
    by_program_count = {}

    with SRC.open("r", encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))

    for i, row in enumerate(rows):
        zh_title = row["item_page_title"].strip()
        meta = PROGRAM_META.get(zh_title, {
            "id": slugify(zh_title) or f"program-{i+1}",
            "en": zh_title,
            "short_en": zh_title,
            "short_zh": zh_title,
            "kind": "Program",
            "kind_zh": "单元",
            "blurb_en": "",
            "blurb_zh": "",
            "color": "#888",
        })

        program = {
            "id": meta["id"],
            "title_zh": zh_title,
            "title_en": meta["en"],
            "short_en": meta["short_en"],
            "short_zh": meta["short_zh"],
            "kind_en": meta["kind"],
            "kind_zh": meta["kind_zh"],
            "blurb_en": meta["blurb_en"],
            "blurb_zh": meta["blurb_zh"],
            "color": meta["color"],
            "source_url": row.get("item_page_link", ""),
            "published_date": row.get("phone", ""),
            "order": i + 1,
        }
        programs.append(program)

        parsed = [p for p in split_data_block(row["film_title_english"]) if p]
        by_program_count[program["id"]] = len(parsed)

        for j, p in enumerate(parsed):
            base = slugify(p["title_en"] or p["title_zh"])
            fid = f"{program['id']}-{base}"
            n = 2
            while fid in used_ids:
                fid = f"{program['id']}-{base}-{n}"
                n += 1
            used_ids.add(fid)
            films.append({
                "id": fid,
                "title_en": p["title_en"],
                "title_zh": p["title_zh"],
                "year": p["year"],
                "format_tags": p["format_tags"],
                "program_id": program["id"],
                "program_en": program["title_en"],
                "program_zh": zh_title,
                "order_in_program": j + 1,
                "color": program["color"],
                # Fields below to be enriched later — see README.md
                "director": None,
                "director_zh": None,
                "country": None,
                "country_zh": None,
                "runtime": None,
                "language": None,
                "synopsis_en": None,
                "synopsis_zh": None,
                "poster_url": None,
                "premiere": None,
                "imdb_id": None,
                "tmdb_id": None,
            })

    OUT_PROGRAMS.write_text(json.dumps(programs, ensure_ascii=False, indent=2), encoding="utf-8")
    OUT_FILMS.write_text(json.dumps(films, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Wrote {len(programs)} programs -> {OUT_PROGRAMS.name}")
    print(f"Wrote {len(films)} films   -> {OUT_FILMS.name}")
    for pid, n in by_program_count.items():
        print(f"  {pid:30s} {n:3d} films")


if __name__ == "__main__":
    main()
