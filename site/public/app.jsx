/* SIFF 2026 — Fan Showcase
   Reads window.SIFF_DATA (built by scripts/build_data.py).
   No fetches at runtime — everything is in data.js. */

const { useState, useMemo, useEffect } = React;

const DATA = window.SIFF_DATA;
const PROGRAMS = DATA.programs;
const FILMS = DATA.films;
const FESTIVAL = DATA.festival;

// Build derived filter options
const YEARS = Array.from(new Set(FILMS.map(f => f.year).filter(Boolean))).sort((a, b) => b - a);
const FORMAT_TAGS = Array.from(new Set(FILMS.flatMap(f => f.format_tags || []))).sort();

const SORTS = [
  { id: "program", label: "By program · 按单元", label_zh: "按单元" },
  { id: "title",   label: "Title A→Z · 片名",       label_zh: "片名" },
  { id: "year",    label: "Year (newest first)",    label_zh: "按年份" },
];

// ---- icons ----
const SearchIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
    <circle cx="7" cy="7" r="5"/><path d="M11 11l4 4"/>
  </svg>
);

// ---- color helpers (for poster placeholder gradients) ----
function lightenHex(hex, amt) {
  const m = hex.replace('#', '');
  const r = parseInt(m.substring(0,2),16);
  const g = parseInt(m.substring(2,4),16);
  const b = parseInt(m.substring(4,6),16);
  const f = (v) => Math.min(255, Math.max(0, Math.round(v + (255 - v) * amt)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
function darkenHex(hex, amt) {
  const m = hex.replace('#', '');
  const r = parseInt(m.substring(0,2),16);
  const g = parseInt(m.substring(2,4),16);
  const b = parseInt(m.substring(4,6),16);
  const f = (v) => Math.min(255, Math.max(0, Math.round(v * (1 - amt))));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

function posterBg(color) {
  if (!color) color = "#888";
  return `linear-gradient(160deg, ${lightenHex(color, 0.18)} 0%, ${color} 55%, ${darkenHex(color, 0.4)} 100%)`;
}

// ---- components ----
function Header({ lang, setLang, density, setDensity }) {
  return (
    <header className="site">
      <div className="row">
        <a className="brand" href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
          <span className="b-mark">SIFF · 2026</span>
          <span className="b-title">Shanghai International Film Festival</span>
          <span className="b-zh">上海国际电影节</span>
        </a>
        <div className="lang-toggle" role="tablist" aria-label="Language">
          <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button>
          <button className={lang === 'balanced' ? 'on' : ''} onClick={() => setLang('balanced')}>EN/中</button>
          <button className={lang === 'zh' ? 'on' : ''} onClick={() => setLang('zh')}>中文</button>
        </div>
      </div>
    </header>
  );
}

function FestRibbon() {
  const total = FILMS.length;
  const programs = PROGRAMS.length;
  const directors = new Set(FILMS.map(f => f.director).filter(Boolean)).size;
  const yearsSpan = (() => {
    const ys = FILMS.map(f => f.year).filter(Boolean);
    if (!ys.length) return "—";
    const mn = Math.min(...ys), mx = Math.max(...ys);
    return mn === mx ? `${mn}` : `${mn}—${mx}`;
  })();
  return (
    <section className="fest-ribbon">
      <div className="fest-ribbon-row">
        <div className="fr-cell">
          <span className="fr-k">{FESTIVAL.edition} · {FESTIVAL.edition_zh}</span>
          <span className="fr-v">{FESTIVAL.dates}</span>
        </div>
        <div className="fr-cell">
          <span className="fr-k">Films · 影片</span>
          <span className="fr-v mono">{total}</span>
        </div>
        <div className="fr-cell">
          <span className="fr-k">Programs · 单元</span>
          <span className="fr-v mono">{programs}</span>
        </div>
        <div className="fr-cell">
          <span className="fr-k">Years spanned · 年代</span>
          <span className="fr-v mono">{yearsSpan}</span>
        </div>
        <div className="fr-cell">
          <span className="fr-k">Schedule · 排期</span>
          <span className="fr-v" style={{ color: 'var(--ink-mute)', fontStyle: 'italic', fontSize: 18 }}>TBA · 待公布</span>
        </div>
      </div>
    </section>
  );
}

function SectionStrip({ active, setActive }) {
  return (
    <section className="section-strip">
      <h2>Programs / 策展单元 · {PROGRAMS.length}</h2>
      <div className="strip-row">
        {PROGRAMS.map((p, i) => (
          <button key={p.id}
                  className={"strip-cell" + (active === p.id ? ' active' : '')}
                  onClick={() => {
                    setActive(active === p.id ? null : p.id);
                    setTimeout(() => {
                      const el = document.getElementById('catalog-' + p.id);
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 50);
                  }}>
            <div className="n">
              <span>{String(i + 1).padStart(2, '0')} · {p.kind_en}</span>
              <span>{FILMS.filter(f => f.program_id === p.id).length} films</span>
            </div>
            <div className="name">{p.short_en || p.title_en}</div>
            <div className="zh-name">{p.title_zh}</div>
          </button>
        ))}
      </div>
    </section>
  );
}

function FilterBar({ query, setQuery, program, setProgram, year, setYear, fmt, setFmt, sort, setSort, totalShown, totalAll, onClear }) {
  const anyActive = program || year || fmt || query;
  return (
    <div className="filter-bar">
      <div className="search">
        <SearchIcon />
        <input type="text"
               placeholder="Search films, directors, programs… 搜索影片、导演、单元"
               value={query}
               onChange={(e) => setQuery(e.target.value)} />
        <span className="count">{totalShown}/{totalAll}</span>
      </div>
      <div className="select">
        <select value={program || ''} onChange={(e) => setProgram(e.target.value || null)}>
          <option value="">All programs / 全部单元</option>
          {PROGRAMS.map(p => <option key={p.id} value={p.id}>{p.short_en} · {p.short_zh}</option>)}
        </select>
      </div>
      <div className="select">
        <select value={year || ''} onChange={(e) => setYear(e.target.value || null)}>
          <option value="">All years / 全部年代</option>
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      {FORMAT_TAGS.length > 0 && (
        <div className="select">
          <select value={fmt || ''} onChange={(e) => setFmt(e.target.value || null)}>
            <option value="">All formats / 全部格式</option>
            {FORMAT_TAGS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      )}
      <div className="select">
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          {SORTS.map(s => <option key={s.id} value={s.id}>Sort: {s.label}</option>)}
        </select>
      </div>
      {anyActive && <button className="clear" onClick={onClear}>Clear all ×</button>}
    </div>
  );
}

function Poster({ film, index, big = false }) {
  const hasImg = !!film.poster_url;
  return (
    <div className={(big ? "m-poster" : "poster") + (hasImg ? " has-img" : "")}
         style={{ background: hasImg ? undefined : posterBg(film.color) }}>
      {hasImg && <img src={film.poster_url} alt={film.title_en} loading="lazy" />}
      <span className={big ? "pcorner" : "corner"}>{film.program_zh || film.program_en}</span>
      {typeof index === 'number' && <span className={big ? "pyear" : "num"}>{big ? (film.year || '—') : '№' + String(index + 1).padStart(2, '0')}</span>}
      {!big && film.year && <span className="pyear">{film.year}</span>}
      <span className={big ? "ptag" : "ptag"}>{film.title_zh}</span>
    </div>
  );
}

function Card({ film, index, onOpen }) {
  return (
    <div className="card"
         onClick={() => onOpen(film)}
         style={{ '--poster': film.color }}
         role="button" tabIndex={0}
         onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(film); } }}>
      <Poster film={film} index={index} />
      <div>
        <h3>{film.title_en || film.title_zh}</h3>
        <div className="h-zh">{film.title_zh}</div>
      </div>
      <div className="badge-row">
        {film.year && <span className="badge">{film.year}</span>}
        {(film.format_tags || []).map(t => (
          <span key={t} className="badge fmt">{t}</span>
        ))}
        {film.runtime && <span className="badge">{film.runtime}′</span>}
      </div>
      <div className="meta-row">
        {film.director && (
          <div className="line">
            <span className="dir">dir. {film.director}</span>
            {film.country && <span>{film.country}</span>}
          </div>
        )}
        {!film.director && film.country && (
          <div className="line"><span>{film.country}</span></div>
        )}
        {film.language && (
          <div className="line">
            <span style={{ color: 'var(--ink-mute)' }}>{film.language}</span>
            {!film.runtime && film.year && <span>{film.year}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function Catalog({ films, onOpen, sort, activeProgram }) {
  if (films.length === 0) {
    return (
      <section className="catalog">
        <div className="empty">
          <div className="big">No films match.</div>
          <div className="mono" style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            Try widening your filters · 请调整筛选条件
          </div>
        </div>
      </section>
    );
  }

  if (sort === 'program') {
    const groups = PROGRAMS
      .map(p => ({ program: p, films: films.filter(f => f.program_id === p.id) }))
      .filter(g => g.films.length > 0);
    return (
      <section className="catalog">
        {groups.map(g => (
          <div key={g.program.id} id={'catalog-' + g.program.id}>
            <div className="group-head">
              <h2>
                {g.program.title_en}
                <span className="zh-tag">{g.program.title_zh}</span>
              </h2>
              <span className="group-count">
                {g.films.length} {g.films.length === 1 ? 'film' : 'films'} · {g.program.kind_en}
              </span>
            </div>
            {(g.program.blurb_en || g.program.blurb_zh) && (
              <div className="group-blurb">
                <span className="en">{g.program.blurb_en}</span>
                <span className="zh">{g.program.blurb_zh}</span>
              </div>
            )}
            <div className="grid">
              {g.films.map((f, i) => <Card key={f.id} film={f} index={i} onOpen={onOpen} />)}
            </div>
          </div>
        ))}
      </section>
    );
  }

  // flat sorts
  const sorted = [...films];
  if (sort === 'title') sorted.sort((a, b) => (a.title_en || '').localeCompare(b.title_en || ''));
  if (sort === 'year') sorted.sort((a, b) => (b.year || 0) - (a.year || 0));

  return (
    <section className="catalog">
      <div className="group-head">
        <h2>
          {sort === 'title' ? 'All films · A → Z' : 'All films · by year'}
          <span className="zh-tag">{sort === 'title' ? '按片名' : '按年份'}</span>
        </h2>
        <span className="group-count">{sorted.length} {sorted.length === 1 ? 'film' : 'films'}</span>
      </div>
      <div className="grid">
        {sorted.map((f, i) => <Card key={f.id} film={f} index={i} onOpen={onOpen} />)}
      </div>
    </section>
  );
}

function Modal({ film, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  if (!film) return null;
  const program = PROGRAMS.find(p => p.id === film.program_id);

  // Pick a synopsis fallback from the program blurb
  const synEn = film.synopsis_en || (program && program.blurb_en) || `A selection in ${film.program_en}. Detailed credits and synopsis to be confirmed.`;
  const synZh = film.synopsis_zh || (program && program.blurb_zh) || `《${film.program_zh}》单元选片，主创信息与简介待公布。`;

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="Close">×</button>
        <div className="m-head">
          <div className="crest">
            <span className="sec">{film.program_en} · {film.program_zh}</span>
            {film.year && <span>{film.year}</span>}
            {film.country && <span>{film.country}</span>}
            {film.runtime && <span>{film.runtime} min</span>}
            {film.language && <span>{film.language}</span>}
            {(film.format_tags || []).map(t => <span key={t} style={{ color: 'var(--accent)' }}>{t}</span>)}
          </div>
          <h2>{film.title_en || film.title_zh}</h2>
          {film.title_zh && film.title_en && <div className="h-zh">{film.title_zh}</div>}
          <div className="tagline">
            <div>
              <span className="k">Director / 导演</span>
              <span>{film.director || '—'}{film.director_zh ? ` · ${film.director_zh}` : ''}</span>
            </div>
            <div>
              <span className="k">Country / 国别</span>
              <span>{film.country || '—'}{film.country_zh ? ` · ${film.country_zh}` : ''}</span>
            </div>
            <div>
              <span className="k">Runtime / 片长</span>
              <span>{film.runtime ? `${film.runtime} min` : '—'}</span>
            </div>
          </div>
        </div>
        <div className="m-body">
          <div className="col">
            <h3>Synopsis · 简介</h3>
            <p className="en">{synEn}</p>
            <p className="zh">{synZh}</p>

            <div className="credits">
              <div className="row"><span className="k">Year</span><span>{film.year || '—'}</span></div>
              <div className="row"><span className="k">Language</span><span>{film.language || '—'}</span></div>
              <div className="row"><span className="k">Program</span><span>{film.program_en}</span></div>
              <div className="row"><span className="k">Premiere</span><span>{film.premiere || '—'}</span></div>
            </div>
          </div>
          <div className="col">
            <Poster film={film} index={null} big />

            <h3>Schedule · 排片</h3>
            <div className="schedule-tba">
              <div className="tba-mark mono">— · —</div>
              <div className="tba-msg">
                Showtimes and venues<br/>
                <em>to be announced.</em>
              </div>
              <div className="tba-zh">放映场次与场馆待公布</div>
              {program && program.source_url && (
                <a className="tba-link" href={program.source_url} target="_blank" rel="noopener noreferrer">
                  Program page · 单元页 ↗
                </a>
              )}
            </div>

            {film.runtime && (
              <div className="marquee-stat">
                <span className="big">{film.runtime}<span style={{ fontSize: '0.4em', fontStyle: 'italic', marginLeft: 4 }}>min</span></span>
                <span className="lab">runtime / 片长</span>
              </div>
            )}
            {film.year && (
              <div className="marquee-stat" style={{ marginTop: 6 }}>
                <span className="big" style={{ fontStyle: 'italic' }}>{film.year}</span>
                <span className="lab">year of release / 年份</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="site">
      <div className="colophon">
        <div>
          <h4>About this site / 关于</h4>
          <div className="fan-note">
            A <em>fan-made</em> showcase.
            <br/>Not affiliated with the festival.
            <span className="zh">影迷自製，非官方网站。</span>
          </div>
        </div>
        <div>
          <h4>Festival / 电影节</h4>
          <ul>
            <li><a href="https://www.siff.com" target="_blank" rel="noopener noreferrer">SIFF official ↗</a></li>
            <li>Dates · 6/12 — 6/21, 2026</li>
            <li>Venues · TBA</li>
            <li>Tickets · TBA</li>
          </ul>
        </div>
        <div>
          <h4>Catalog / 片单</h4>
          <ul>
            <li>{FILMS.length} films · 部影片</li>
            <li>{PROGRAMS.length} programs · 个单元</li>
            <li>Bilingual · 中英双语</li>
            <li>Updated · 更新于 May 17, 2026</li>
          </ul>
        </div>
        <div>
          <h4>Colophon / 版权信息</h4>
          <ul>
            <li>Type · Instrument Serif</li>
            <li>Type · IBM Plex Sans</li>
            <li>Type · Noto Serif SC</li>
            <li>Type · JetBrains Mono</li>
          </ul>
        </div>
      </div>
      <div className="small">
        <span>SIFF · 2026 · Fan Showcase</span>
        <span>Built for <em>cinephiles</em> · 为影迷而作</span>
        <span>Source: siff.com crawl, 2026-05-17</span>
      </div>
    </footer>
  );
}

function App() {
  const [lang, setLang] = useState('balanced');
  const [density, setDensity] = useState('comfortable');
  const [query, setQuery] = useState('');
  const [program, setProgram] = useState(null);
  const [year, setYear] = useState(null);
  const [fmt, setFmt] = useState(null);
  const [sort, setSort] = useState('program');
  const [openFilm, setOpenFilm] = useState(null);

  useEffect(() => {
    document.body.dataset.langEmphasis = lang;
    document.body.dataset.density = density;
  }, [lang, density]);

  const filtered = useMemo(() => {
    return FILMS.filter(f => {
      if (program && f.program_id !== program) return false;
      if (year && String(f.year) !== String(year)) return false;
      if (fmt && !(f.format_tags || []).includes(fmt)) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        const hay = [
          f.title_en, f.title_zh, f.director, f.director_zh,
          f.country, f.country_zh, f.program_en, f.program_zh,
          f.language, f.synopsis_en, f.synopsis_zh,
          ...(f.format_tags || []),
        ].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [query, program, year, fmt]);

  const clear = () => { setQuery(''); setProgram(null); setYear(null); setFmt(null); };

  return (
    <>
      <Header lang={lang} setLang={setLang} density={density} setDensity={setDensity} />
      <FestRibbon />
      <SectionStrip active={program} setActive={setProgram} />
      <FilterBar
        query={query} setQuery={setQuery}
        program={program} setProgram={setProgram}
        year={year} setYear={setYear}
        fmt={fmt} setFmt={setFmt}
        sort={sort} setSort={setSort}
        totalShown={filtered.length} totalAll={FILMS.length}
        onClear={clear}
      />
      <Catalog films={filtered} onOpen={setOpenFilm} sort={sort} activeProgram={program} />
      <Footer />
      {openFilm && <Modal film={openFilm} onClose={() => setOpenFilm(null)} />}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
