/* SIFF 2026 — Fan Showcase, redesigned around three user jobs:
   Programme (browse by strand) · All Films (search + filter) · My List (persisted watchlist)
   Reads window.SIFF_DATA built by scripts/build_data.py. */

const { useState, useMemo, useEffect, useCallback } = React;

const DATA = window.SIFF_DATA;
const PROGRAMS = DATA.programs;
const FILMS = DATA.films;
const FESTIVAL = DATA.festival;

const PROG_BY_ID = Object.fromEntries(PROGRAMS.map(p => [p.id, p]));

const KIND_ORDER = [
  "Competition",
  "Festival Highlights",
  "Section",
  "Curated Program",
  "Tribute",
  "Special Program",
  "Special Selection",
  "Series",
  "Format Showcase",
];
const KIND_ZH = {
  "Competition": "金爵奖竞赛",
  "Festival Highlights": "影展精粹",
  "Section": "单元",
  "Curated Program": "策展单元",
  "Tribute": "向大师致敬",
  "Special Program": "特别企划",
  "Special Selection": "特别策划",
  "Series": "系列电影",
  "Format Showcase": "格式展映",
};

const PREMIERE_ZH = {
  "World Premiere": "全球首映",
  "International Premiere": "国际首映",
  "Asia Premiere": "亚洲首映",
};

const KIND_GROUPS = KIND_ORDER
  .map(kind => ({ kind, kindZh: KIND_ZH[kind], programs: PROGRAMS.filter(p => p.kind_en === kind) }))
  .filter(g => g.programs.length > 0);

const SORTS = [
  { id: "program", label: "By program" },
  { id: "title",   label: "A → Z" },
  { id: "year",    label: "By year" },
  { id: "runtime", label: "Runtime" },
  { id: "country", label: "By country" },
];

const filmCount = (programId) => FILMS.filter(f => f.program_id === programId).length;
const pad2 = (n) => String(n).padStart(2, '0');

/* ---------- Icons ---------- */
const SearchIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="7" cy="7" r="5"/><path d="M11 11l4 4"/></svg>
);
const ExtIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M6 3H3v10h10v-3M9 3h4v4M13 3L7 9"/></svg>
);
const BookmarkIcon = ({ filled }) => (
  <svg viewBox="0 0 16 16" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.4">
    <path d="M4 2.5h8v11l-4-3-4 3z" strokeLinejoin="round"/>
  </svg>
);

/* ---------- Watchlist (persisted) ---------- */
function useWatchlist() {
  const KEY = 'siff2026-watchlist';
  const [ids, setIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch (e) { return new Set(); }
  });
  const toggle = useCallback((id) => {
    setIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      try { localStorage.setItem(KEY, JSON.stringify([...n])); } catch (e) {}
      return n;
    });
  }, []);
  const clear = useCallback(() => {
    setIds(new Set());
    try { localStorage.setItem(KEY, '[]'); } catch (e) {}
  }, []);
  return { ids, toggle, clear };
}

/* ---------- Header ---------- */
function Header({ active, onNavigate, lang, setLang, watchCount, planCount }) {
  return (
    <header className="site">
      <div className="row">
        <a className="brand" href="#" onClick={(e)=>{e.preventDefault(); onNavigate('programs');}}>
          <span className="b-mark">SIFF · 2026</span>
          <span>Shanghai International<br/>Film Festival</span>
          <span className="b-zh">上海国际电影节</span>
        </a>
        <nav className="top">
          <a className={active==='programs'?'active':''} href="#" onClick={(e)=>{e.preventDefault(); onNavigate('programs');}}>Programme <span className="nav-zh">单元</span></a>
          <a className={active==='films'?'active':''} href="#" onClick={(e)=>{e.preventDefault(); onNavigate('films');}}>All Films <span className="nav-zh">影片</span></a>
        </nav>
        <button className={"wl-pill" + (active==='watchlist'?' on':'')} onClick={()=>onNavigate('watchlist')}>
          <BookmarkIcon filled={watchCount>0} />
          <span>My List</span>
          <span className="wl-n mono">{watchCount}</span>
        </button>
        <button className={"wl-pill plan-pill" + (active==='plan'?' on':'')} onClick={()=>onNavigate('plan')}>
          <TicketIcon filled={planCount>0} />
          <span>My Plan</span>
          <span className="wl-n mono">{planCount}</span>
        </button>
        <div className="lang-toggle">
          <button className={lang==='en'?'on':''} onClick={()=>setLang('en')}>EN</button>
          <button className={lang==='balanced'?'on':''} onClick={()=>setLang('balanced')}>EN/中</button>
          <button className={lang==='zh'?'on':''} onClick={()=>setLang('zh')}>中文</button>
        </div>
      </div>
    </header>
  );
}

/* ---------- Poster-wall hero ---------- */
const POSTER_FILMS = FILMS.filter(f => f.poster_url);
const _hash = (s) => { let h = 0; for (let i=0;i<s.length;i++) h = (h*31 + s.charCodeAt(i)) >>> 0; return h; };
const WALL_PICK = [...POSTER_FILMS].sort((a,b) => _hash(a.id) - _hash(b.id)).slice(0, 60);
const WALL_ROWS = [WALL_PICK.slice(0,20), WALL_PICK.slice(20,40), WALL_PICK.slice(40,60)];

function PosterWall({ onOpen }) {
  return (
    <div className="poster-wall" aria-hidden="false">
      {WALL_ROWS.map((row, ri) => (
        <div key={ri} className={"pw-row" + (ri % 2 ? ' rev' : '')}>
          {[...row, ...row].map((f, i) => (
            <button key={f.id + '-' + i} className="pw-tile" title={f.title_en}
                    onClick={() => onOpen(f)} tabIndex={i < row.length ? 0 : -1}>
              <img src={f.poster_url} alt={f.title_en} draggable="false" />
            </button>
          ))}
        </div>
      ))}
      <div className="pw-scrim"></div>
    </div>
  );
}

/* ---------- Programme landing (default view) ---------- */
function ProgramsView({ onPick, onSearch, onOpen }) {
  const [q, setQ] = useState('');
  const countries = new Set(FILMS.map(f => f.country).filter(Boolean)).size;
  const submit = (e) => { e.preventDefault(); if (q.trim()) onSearch(q.trim()); };
  return (
    <section className="programs-view">
      <div className="pw-hero">
        <PosterWall onOpen={onOpen} />
        <div className="pw-masthead">
          <div className="pv-eyebrow mono">{FESTIVAL.edition} · {FESTIVAL.dates}</div>
          <h1>The Programme<span className="pv-zh">展映单元</span></h1>
          <p className="pw-lead">
            {FILMS.length} films · {PROGRAMS.length} programs · {countries} countries — the full 2026 selection.
          </p>
        </div>
      </div>

      <div className="pv-bar">
        <form className="pv-search" onSubmit={submit}>
          <SearchIcon />
          <input value={q} onChange={(e)=>setQ(e.target.value)}
                 placeholder="Search films, directors, countries…  搜索全部影片" />
          <button type="submit" className="pv-search-go mono">Search →</button>
        </form>
        <div className="pv-bar-stats mono">
          <span><b>{FILMS.length}</b> films</span>
          <span><b>{PROGRAMS.length}</b> programs</span>
          <span><b>{KIND_GROUPS.length}</b> strands</span>
        </div>
      </div>

      {KIND_GROUPS.map(g => (
        <div key={g.kind} className="kind-block">
          <div className="kind-head">
            <h2>{g.kind}</h2>
            <span className="kind-zh">{g.kindZh}</span>
            <span className="kind-count">{g.programs.length} {g.programs.length===1?'program':'programs'}</span>
          </div>
          <div className="prog-grid">
            {g.programs.map(p => (
              <button key={p.id} className="prog-card" onClick={() => onPick(p.id)} style={{'--pc': p.color}}>
                <span className="pc-bar"></span>
                <div className="pc-top">
                  <span className="pc-n mono">{pad2(p.order)}</span>
                  <span className="pc-count mono">{filmCount(p.id)} films</span>
                </div>
                <div className="pc-name">{p.short_en || p.title_en}</div>
                <div className="pc-zh">{p.short_zh || p.title_zh}</div>
                {p.blurb_en && <div className="pc-blurb">{p.blurb_en}</div>}
                {p.blurb_zh && <div className="pc-blurb pc-blurb-zh">{p.blurb_zh}</div>}
                <span className="pc-go mono">Browse →</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

/* ---------- Filter bar (All Films) ---------- */
function FilterBar({ query, setQuery, program, setProgram, kind, setKind, sort, setSort, totalShown, totalAll, onClear }) {
  const anyActive = program || kind || query;
  return (
    <>
    <div className="filter-bar">
      <div className="search">
        <SearchIcon />
        <input type="text" placeholder="Search films, directors, countries…  搜索"
               value={query} onChange={(e) => setQuery(e.target.value)} />
        <span className="count">{totalShown}/{totalAll}</span>
      </div>
      <div className="select">
        <select value={kind || ''} onChange={(e)=>setKind(e.target.value || null)}>
          <option value="">All strands / 全部类别</option>
          {KIND_GROUPS.map(g => <option key={g.kind} value={g.kind}>{g.kind} · {g.kindZh}</option>)}
        </select>
      </div>
      <div className="select">
        <select value={program || ''} onChange={(e)=>setProgram(e.target.value || null)}>
          <option value="">All programs / 全部单元</option>
          {KIND_GROUPS.map(g => (
            <optgroup key={g.kind} label={g.kind}>
              {g.programs.map(p => <option key={p.id} value={p.id}>{p.short_en || p.title_en} ({filmCount(p.id)})</option>)}
            </optgroup>
          ))}
        </select>
      </div>
      <div className="select">
        <select value={sort} onChange={(e)=>setSort(e.target.value)}>
          {SORTS.map(s => <option key={s.id} value={s.id}>Sort: {s.label}</option>)}
        </select>
      </div>
      {anyActive && <button className="clear" onClick={onClear}>Clear all ×</button>}
    </div>
    {(program || kind) && (
      <div className="active-row">
        <span className="lab">Filtering</span>
        {kind && <button className="chip on" onClick={()=>setKind(null)}>{kind} <span className="x">×</span></button>}
        {program && <button className="chip on" onClick={()=>setProgram(null)}>{PROG_BY_ID[program]?.short_en} <span className="x">×</span></button>}
      </div>
    )}
    </>
  );
}

/* ---------- Poster ---------- */
function Poster({ film, saved, onToggle }) {
  const [err, setErr] = useState(false);
  const prog = PROG_BY_ID[film.program_id];
  const showImg = film.poster_url && !err;
  const formatTags = film.format_tags || [];
  return (
    <div className={"poster" + (showImg ? ' has-img' : '')}
         style={{ '--poster': film.color, backgroundColor: film.color }}>
      <span className="placeholder-tag">[ {prog ? (prog.short_en || prog.title_en) : film.title_en} ]</span>
      {showImg && <img src={film.poster_url} alt={film.title_en} loading="lazy" onError={() => setErr(true)} />}
      {film.country && <span className="corner">{film.country.split(/[,/]/)[0].trim()}</span>}
      {formatTags.length > 0 && <span className="fmt-tag">{formatTags[0]}</span>}
      <button className={"watch-btn" + (saved ? ' on' : '')} title={saved ? 'Remove from My List' : 'Add to My List'}
              onClick={(e) => { e.stopPropagation(); onToggle(film.id); }}>
        <BookmarkIcon filled={saved} />
      </button>
    </div>
  );
}

/* ---------- Card ---------- */
function Card({ film, onOpen, saved, onToggle }) {
  const prog = PROG_BY_ID[film.program_id];
  return (
    <div className="card" onClick={() => onOpen(film)} role="button" tabIndex={0}
         onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(film); } }}>
      <Poster film={film} saved={saved} onToggle={onToggle} />
      <div>
        <h3><span className="en">{film.title_en}</span></h3>
        <div className="h-zh">{film.title_zh}</div>
      </div>
      <div className="badge-row">
        {prog && <span className="badge">{prog.short_en || prog.title_en}</span>}
        {film.year && <span className="badge year">{film.year}</span>}
      </div>
      <div className="meta-row">
        <div className="line">
          <span className="dir">{film.director ? 'dir. ' + film.director : '—'}</span>
          {film.runtime != null && <span>{film.runtime}′</span>}
        </div>
        <div className="line">
          <span>{film.country || '—'}</span>
          <span>{film.language}</span>
        </div>
      </div>
    </div>
  );
}

/* ---------- Catalog ---------- */
function Catalog({ films, onOpen, sort, watchlist, onToggle }) {
  const renderCard = (f, i) => (
    <Card key={f.id + '-' + i} film={f} onOpen={onOpen} saved={watchlist.has(f.id)} onToggle={onToggle} />
  );
  if (films.length === 0) return <EmptyState />;

  if (sort === 'program') {
    const groups = PROGRAMS
      .map(p => ({ prog: p, films: films.filter(f => f.program_id === p.id) }))
      .filter(g => g.films.length > 0);
    return (
      <section className="catalog">
        {groups.map(g => (
          <div key={g.prog.id}>
            <div className="group-head" style={{ '--gc': g.prog.color }}>
              <div className="gh-left">
                <span className="gh-kind mono">{g.prog.kind_en} · {g.prog.kind_zh}</span>
                <h2>{g.prog.short_en || g.prog.title_en}<span className="zh-tag">{g.prog.short_zh || g.prog.title_zh}</span></h2>
                {g.prog.blurb_en && <p className="gh-blurb">{g.prog.blurb_en}</p>}
                {g.prog.blurb_zh && <p className="gh-blurb gh-blurb-zh">{g.prog.blurb_zh}</p>}
              </div>
              <span className="group-count">{g.films.length} {g.films.length===1?'film':'films'}</span>
            </div>
            <div className="grid">{g.films.map(renderCard)}</div>
          </div>
        ))}
      </section>
    );
  }

  if (sort === 'country') {
    const by = {};
    films.forEach(f => { const k = f.country || 'Unknown'; (by[k] = by[k] || []).push(f); });
    const groups = Object.keys(by).sort().map(k => ({ key: k, films: by[k] }));
    return (
      <section className="catalog">
        {groups.map(g => (
          <div key={g.key}>
            <div className="group-head">
              <div className="gh-left"><h2>{g.key}</h2></div>
              <span className="group-count">{g.films.length} {g.films.length===1?'film':'films'}</span>
            </div>
            <div className="grid">{g.films.map(renderCard)}</div>
          </div>
        ))}
      </section>
    );
  }

  const sorted = [...films];
  if (sort === 'title') sorted.sort((a,b) => (a.title_en || '').localeCompare(b.title_en || ''));
  if (sort === 'runtime') sorted.sort((a,b) => (a.runtime||999) - (b.runtime||999));
  if (sort === 'year') sorted.sort((a,b) => (+b.year||0) - (+a.year||0) || (a.title_en || '').localeCompare(b.title_en || ''));
  const heads = { title: ['All films','全部影片'], runtime: ['By runtime','按片长'], year: ['By year','按年份'] };
  return (
    <section className="catalog">
      <div className="group-head">
        <div className="gh-left"><h2>{heads[sort][0]}<span className="zh-tag">{heads[sort][1]}</span></h2></div>
        <span className="group-count">{sorted.length} films</span>
      </div>
      <div className="grid">{sorted.map(renderCard)}</div>
    </section>
  );
}

function EmptyState() {
  return (
    <div className="catalog">
      <div className="empty">
        <div className="big">No films match.</div>
        <div className="mono" style={{fontSize:11, letterSpacing:'0.14em', textTransform:'uppercase'}}>Try widening your filters · 请调整筛选条件</div>
      </div>
    </div>
  );
}

/* ---------- My List (watchlist) ---------- */
function WatchlistView({ lang, onOpen, watchlist, onToggle, onClear, onBrowse }) {
  const saved = FILMS.filter(f => watchlist.has(f.id));
  const totalRuntime = saved.reduce((s, f) => s + (f.runtime || 0), 0);
  const hours = Math.floor(totalRuntime / 60), mins = totalRuntime % 60;
  const isZh = lang === 'zh';
  return (
    <section className="watchlist-view">
      <div className="wl-head">
        <div className="wl-head-left">
          <div className="pv-eyebrow mono">Your festival plan · 我的片单</div>
          <h1>My List<span className="pv-zh">收藏</span></h1>
          {saved.length > 0 && (
            <p className="pv-lead">
              {isZh
                ? <>已收藏 {saved.length} 部{totalRuntime > 0 && <> · 约 {hours>0 && `${hours}小时`}{mins}分钟</>}<span className="wl-note"> · 仅保存在本设备</span></>
                : <>{saved.length} {saved.length===1?'film':'films'} saved{totalRuntime > 0 && <> · {hours>0 && `${hours}h `}{mins}m of cinema</>}<span className="wl-note"> · saved on this device</span></>
              }
            </p>
          )}
        </div>
        {saved.length > 0 && <button className="wl-clear mono" onClick={onClear}>{isZh ? '清空 ×' : 'Clear list ×'}</button>}
      </div>
      {saved.length === 0 ? (
        <div className="wl-empty">
          <div className="big">{isZh ? '收藏单还是空的。' : 'Your list is empty.'}</div>
          {isZh
            ? <p>点击任意影片海报上的 <span className="wl-inline-icon"><BookmarkIcon /></span> 收藏按钮即可加入此处。</p>
            : <p>Tap the <span className="wl-inline-icon"><BookmarkIcon /></span> on any film to save it here for the festival.</p>}
          <button className="wl-browse mono" onClick={onBrowse}>{isZh ? '浏览展映单元 →' : 'Browse the programme →'}</button>
        </div>
      ) : (
        <div className="grid wl-grid">
          {saved.map((f,i) => (
            <Card key={f.id+'-'+i} film={f} onOpen={onOpen} saved={true} onToggle={onToggle} />
          ))}
        </div>
      )}
    </section>
  );
}

/* ---------- Modal ---------- */
function Modal({ lang, film, onClose, onPickProgram, saved, onToggle, planEntries, onRemovePlan, onAddPlan }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);
  const [err, setErr] = useState(false);
  if (!film) return null;
  const prog = PROG_BY_ID[film.program_id];
  const showImg = film.poster_url && !err;
  const formatTags = film.format_tags || [];

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e)=>e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="Close">×</button>
        <div className="m-head">
          <div className="crest">
            {prog && <button className="sec" onClick={()=>onPickProgram(film.program_id)}>{prog.short_en} · {prog.short_zh || prog.title_zh}</button>}
            <span>{[film.country, film.year].filter(Boolean).join(' · ')}</span>
            {film.runtime != null && <span>{film.runtime} minutes</span>}
            {film.language && <span>{film.language}</span>}
            {film.premiere && <span className="premiere">{film.premiere}{PREMIERE_ZH[film.premiere] ? ' · ' + PREMIERE_ZH[film.premiere] : ''}</span>}
            {formatTags.map(t => <span key={t} className="fmt">{t}</span>)}
          </div>
          <h2>{film.title_en}</h2>
          <div className="h-zh">{film.title_zh}</div>
          <div className="tagline">
            {film.director && <div><span className="k">Director / 导演</span><span>{film.director}{film.director_zh ? ' · ' + film.director_zh : ''}</span></div>}
            <div><span className="k">Strand / 类别</span><span>{prog ? prog.kind_en + ' · ' + prog.kind_zh : '—'}</span></div>
          </div>
        </div>
        <div className="m-body">
          <div className="col">
            <h3>Synopsis · 简介</h3>
            {film.synopsis_en ? <p>{film.synopsis_en}</p> : <p className="muted">Synopsis to be published. · 简介待补。</p>}
            {film.synopsis_zh && <p className="zh">{film.synopsis_zh}</p>}

            {prog && (prog.blurb_en || prog.blurb_zh) && (
              <div className="prog-note">
                <span className="k mono">In the program · 所属单元</span>
                <button className="pn-name" onClick={()=>onPickProgram(film.program_id)}>{prog.title_en}</button>
                <div className="pn-name-zh">{prog.title_zh}</div>
                {prog.blurb_en && <p className="pn-blurb">{prog.blurb_en}</p>}
                {prog.blurb_zh && <p className="pn-blurb pn-blurb-zh">{prog.blurb_zh}</p>}
              </div>
            )}
          </div>
          <div className="col">
            <div className={"m-poster" + (showImg ? '' : ' empty')} style={{ backgroundColor: film.color }}>
              {showImg ? <img src={film.poster_url} alt={film.title_en} onError={()=>setErr(true)} />
                       : <span className="mp-lab mono">no poster · 暂无海报</span>}
            </div>

            <button className={"modal-wl" + (saved ? ' on' : '')} onClick={()=>onToggle(film.id)}>
              <BookmarkIcon filled={saved} />
              <span>{lang === 'zh' ? (saved ? '已加入收藏' : '加入我的收藏') : (saved ? 'Saved to My List' : 'Add to My List')}</span>
            </button>

            {film.imdb_url && (
              <a className="imdb-link" href={film.imdb_url} target="_blank" rel="noopener noreferrer">
                <span>{lang === 'zh' ? '在 IMDb 查看' : 'View on IMDb'}</span><ExtIcon />
              </a>
            )}

            <h3 style={{marginTop:24}}>My plan · 我的排片</h3>
            <FilmPlanSection lang={lang} film={film} entries={planEntries} onRemove={onRemovePlan} onAdd={onAddPlan} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Footer ---------- */
function Footer() {
  return (
    <footer className="site">
      <div className="colophon">
        <div>
          <h4>About this site / 关于</h4>
          <div className="fan-note">
            A <em>fan-made</em> catalogue of the full 2026 programme.
            <span className="zh">影迷自製全单元片单，非官方网站。</span>
          </div>
        </div>
        <div>
          <h4>Catalogue / 片单</h4>
          <ul>
            <li>{FILMS.length} films · 部影片</li>
            <li>{PROGRAMS.length} programs · 个单元</li>
            <li>{KIND_GROUPS.length} strands · 类别</li>
            <li>{FESTIVAL.dates} · 会期</li>
          </ul>
        </div>
        <div>
          <h4>Sources / 来源</h4>
          <ul>
            <li>Programme listings</li>
            <li>Posters via TMDB</li>
            <li>Links via IMDb</li>
            <li>Plan · you build it</li>
          </ul>
        </div>
        <div>
          <h4>Festival / 电影节</h4>
          <ul>
            <li>Dates · 日期</li>
            <li>Venues · 场馆</li>
            <li>Tickets · 票务</li>
            <li>Press · 媒体</li>
          </ul>
        </div>
      </div>
      <div className="small">
        <span>{FESTIVAL.edition} · Fan Catalogue</span>
        <span>Type set in <em>Instrument Serif</em> &amp; <em>IBM Plex</em></span>
        <span>Built with care · 用心而作</span>
      </div>
    </footer>
  );
}

/* ---------- App ---------- */
function App() {
  const [lang, setLang] = useState('balanced');
  const [query, setQuery] = useState('');
  const [program, setProgram] = useState(null);
  const [kind, setKind] = useState(null);
  const [sort, setSort] = useState('program');
  const [openFilm, setOpenFilm] = useState(null);
  const [active, setActive] = useState('programs');
  const [picker, setPicker] = useState(null);
  const watch = useWatchlist();
  const plan = usePlan();

  const openPicker = (preset) => setPicker(preset || {});

  useEffect(() => {
    document.body.dataset.langEmphasis = lang;
  }, [lang]);

  const filtered = useMemo(() => {
    return FILMS.filter(f => {
      if (program && f.program_id !== program) return false;
      if (kind && PROG_BY_ID[f.program_id]?.kind_en !== kind) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        const hay = [f.title_en, f.title_zh, f.director, f.director_zh, f.country, f.country_zh, f.language, PROG_BY_ID[f.program_id]?.short_en].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [query, program, kind]);

  const clear = () => { setQuery(''); setProgram(null); setKind(null); };
  const navigate = (view) => { setActive(view); window.scrollTo({ top: 0 }); };

  const pickProgram = (pid) => {
    setKind(null); setProgram(pid); setQuery(''); setSort('program');
    setOpenFilm(null); setActive('films'); window.scrollTo({ top: 0 });
  };
  const searchAll = (q) => {
    setQuery(q); setProgram(null); setKind(null); setSort('title');
    setActive('films'); window.scrollTo({ top: 0 });
  };

  return (
    <>
      <Header active={active} onNavigate={navigate} lang={lang} setLang={setLang}
              watchCount={watch.ids.size} planCount={plan.entries.length} />

      {active === 'programs' && <ProgramsView onPick={pickProgram} onSearch={searchAll} onOpen={setOpenFilm} />}

      {active === 'films' && (
        <>
          <FilterBar
            query={query} setQuery={setQuery}
            program={program} setProgram={setProgram}
            kind={kind} setKind={setKind}
            sort={sort} setSort={setSort}
            totalShown={filtered.length} totalAll={FILMS.length}
            onClear={clear}
          />
          <Catalog films={filtered} onOpen={setOpenFilm} sort={sort} watchlist={watch.ids} onToggle={watch.toggle} />
        </>
      )}

      {active === 'watchlist' && (
        <WatchlistView lang={lang} onOpen={setOpenFilm} watchlist={watch.ids} onToggle={watch.toggle}
                       onClear={watch.clear} onBrowse={() => navigate('programs')} />
      )}

      {active === 'plan' && (
        <CalendarView
          lang={lang}
          entries={plan.entries}
          onRemove={plan.remove}
          onClear={plan.clear}
          onAddSlot={(d, s) => openPicker({ day: d, slot: s })}
          onAddOpen={() => openPicker()}
          onOpenFilm={setOpenFilm}
        />
      )}

      <Footer />
      {openFilm && <Modal lang={lang} film={openFilm} onClose={() => setOpenFilm(null)} onPickProgram={pickProgram}
                          saved={watch.ids.has(openFilm.id)} onToggle={watch.toggle}
                          planEntries={plan.entries} onRemovePlan={plan.remove}
                          onAddPlan={(f) => openPicker({ film: f })} />}
      {picker && (
        <EntryPicker
          lang={lang}
          preset={picker}
          watchIds={watch.ids}
          onClose={() => setPicker(null)}
          onConfirm={(entry) => { plan.add(entry); setPicker(null); if (active !== 'plan' && !openFilm) navigate('plan'); }}
        />
      )}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
