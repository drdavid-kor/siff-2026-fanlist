/* SIFF 2026 — Fan showcase app */
const { useState, useMemo, useEffect, useCallback, useRef } = React;

const FILMS = window.SIFF_FILMS;
const SECTIONS = window.SIFF_SECTIONS;

// derive filter options
const COUNTRIES = Array.from(new Set(FILMS.map(f => f.country))).sort();
const LANGUAGES = Array.from(new Set(FILMS.map(f => f.language))).sort();

const SORTS = [
  { id: "section", label: "By section" },
  { id: "title", label: "A → Z" },
  { id: "runtime", label: "Runtime" },
  { id: "country", label: "By country" },
];

const SearchIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
    <circle cx="7" cy="7" r="5"/><path d="M11 11l4 4"/>
  </svg>
);

function Header({ active, onNavigate, lang, setLang }) {
  return (
    <header className="site">
      <div className="row">
        <a className="brand" href="#" onClick={(e)=>{e.preventDefault(); onNavigate('catalog');}}>
          <span className="b-mark">SIFF · 2026</span>
          <span>Shanghai International<br/>Film Festival</span>
          <span className="b-zh">上海国际电影节</span>
        </a>
        <nav className="top">
          <a className={active==='catalog'?'active':''} href="#" onClick={(e)=>{e.preventDefault(); onNavigate('catalog');}}>Films <span style={{color:'var(--ink-mute)', fontFamily:'var(--mono)', fontSize:11}}> · 影片</span></a>
          <a className={active==='programs'?'active':''} href="#" onClick={(e)=>{e.preventDefault(); onNavigate('programs');}}>Programs <span style={{color:'var(--ink-mute)', fontFamily:'var(--mono)', fontSize:11}}> · 单元</span></a>
          <a href="#" onClick={(e)=>e.preventDefault()}>Notes <span style={{color:'var(--ink-mute)', fontFamily:'var(--mono)', fontSize:11}}> · 札记</span></a>
        </nav>
        <div className="lang-toggle">
          <button className={lang==='en'?'on':''} onClick={()=>setLang('en')}>EN</button>
          <button className={lang==='balanced'?'on':''} onClick={()=>setLang('balanced')}>EN/中</button>
          <button className={lang==='zh'?'on':''} onClick={()=>setLang('zh')}>中文</button>
        </div>
      </div>
    </header>
  );
}

function FestRibbon() {
  const total = FILMS.length;
  const countries = new Set(FILMS.map(f => f.country)).size;
  return (
    <section className="fest-ribbon">
      <div className="fest-ribbon-row">
        <div className="fr-cell">
          <span className="fr-k">27th SIFF</span>
          <span className="fr-v">Jun 13 — Jun 22, 2026</span>
        </div>
        <div className="fr-cell">
          <span className="fr-k">Films · 影片</span>
          <span className="fr-v mono">{total}</span>
        </div>
        <div className="fr-cell">
          <span className="fr-k">Countries · 国别</span>
          <span className="fr-v mono">{countries}</span>
        </div>
        <div className="fr-cell">
          <span className="fr-k">Programs · 单元</span>
          <span className="fr-v mono">{SECTIONS.length}</span>
        </div>
        <div className="fr-cell">
          <span className="fr-k">Schedule · 排期</span>
          <span className="fr-v" style={{color:'var(--ink-mute)', fontStyle:'italic', fontSize:18}}>TBA · 待公布</span>
        </div>
      </div>
    </section>
  );
}

function SectionStrip({ active, setActive }) {
  return (
    <section className="section-strip">
      <h2>Curated programs / 策展单元</h2>
      <div className="strip-row">
        {SECTIONS.map((s, i) => (
          <button key={s.id}
                  className={"strip-cell" + (active === s.id ? ' active' : '')}
                  onClick={() => setActive(active === s.id ? null : s.id)}>
            <div className="n">
              <span>{String(i+1).padStart(2,'0')}</span>
              <span>{FILMS.filter(f => f.section === s.id).length} films</span>
            </div>
            <div className="name">{s.id}</div>
            <div className="zh-name">{s.zh}</div>
          </button>
        ))}
      </div>
    </section>
  );
}

function FilterBar({ query, setQuery, section, setSection, country, setCountry, lang, setLangFilter, sort, setSort, totalShown, totalAll, onClear }) {
  const anyActive = section || country || lang || query;
  return (
    <>
    <div className="filter-bar">
      <div className="search">
        <SearchIcon />
        <input type="text"
               placeholder="Search films, directors, countries…  搜索"
               value={query}
               onChange={(e) => setQuery(e.target.value)} />
        <span className="count">{totalShown}/{totalAll}</span>
      </div>
      <div className="select">
        <select value={section || ''} onChange={(e)=>setSection(e.target.value || null)}>
          <option value="">All sections / 全部单元</option>
          {SECTIONS.map(s => <option key={s.id} value={s.id}>{s.id}  ·  {s.zh}</option>)}
        </select>
      </div>
      <div className="select">
        <select value={country || ''} onChange={(e)=>setCountry(e.target.value || null)}>
          <option value="">All countries / 全部国别</option>
          {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="select">
        <select value={lang || ''} onChange={(e)=>setLangFilter(e.target.value || null)}>
          <option value="">All languages / 全部语言</option>
          {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>
      <div className="select">
        <select value={sort} onChange={(e)=>setSort(e.target.value)}>
          {SORTS.map(s => <option key={s.id} value={s.id}>Sort: {s.label}</option>)}
        </select>
      </div>
      {anyActive && <button className="clear" onClick={onClear}>Clear all ×</button>}
    </div>
    {(section || country || lang) && (
      <div className="active-row">
        <span className="lab">Filtering</span>
        {section && <button className="chip on" onClick={()=>setSection(null)}>{section} <span className="x">×</span></button>}
        {country && <button className="chip on" onClick={()=>setCountry(null)}>{country} <span className="x">×</span></button>}
        {lang && <button className="chip on" onClick={()=>setLangFilter(null)}>{lang} <span className="x">×</span></button>}
      </div>
    )}
    </>
  );
}

function Card({ film, index, onOpen }) {
  return (
    <div className="card" onClick={() => onOpen(film)}
         style={{ '--poster': film.color }}
         role="button" tabIndex={0}
         onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(film); } }}>
      <div className="poster" style={{ '--poster': film.color, backgroundColor: film.color }}>
        <span className="corner">{film.country.split(',')[0]}</span>
        <span className="num">№{String(index+1).padStart(2,'0')}</span>
        <span className="placeholder-tag">[ {film.stills[0]} ]</span>
      </div>
      <div>
        <h3>
          <span className="en">{film.title}</span>
        </h3>
        <div className="h-zh">{film.titleZh}</div>
      </div>
      <div className="badge-row">
        <span className="badge">{film.premiere}</span>
        <span className="badge">{film.section}</span>
      </div>
      <div className="meta-row">
        <div className="line">
          <span className="dir">dir. {film.director}</span>
          <span>{film.runtime}′</span>
        </div>
        <div className="line">
          <span>{film.country}</span>
          <span>{film.language}</span>
        </div>
      </div>
    </div>
  );
}

function Catalog({ films, onOpen, sort }) {
  const renderCard = (f, i) => (
    <Card key={f.id} film={f} index={i} onOpen={onOpen} />
  );
  // Grouping
  if (sort === 'section') {
    const groups = SECTIONS.map(s => ({
      key: s.id, zh: s.zh, desc: s.desc,
      films: films.filter(f => f.section === s.id),
    })).filter(g => g.films.length > 0);
    if (groups.length === 0) return <EmptyState />;
    return (
      <section className="catalog">
        {groups.map(g => (
          <div key={g.key}>
            <div className="group-head">
              <h2>{g.key}<span className="zh-tag">{g.zh}</span></h2>
              <span className="group-count">{g.films.length} {g.films.length===1?'film':'films'} · {g.desc}</span>
            </div>
            <div className="grid">
              {g.films.map(renderCard)}
            </div>
          </div>
        ))}
      </section>
    );
  }
  if (sort === 'country') {
    const byCountry = {};
    films.forEach(f => { (byCountry[f.country] = byCountry[f.country] || []).push(f); });
    const groups = Object.keys(byCountry).sort().map(k => ({ key: k, films: byCountry[k] }));
    if (groups.length === 0) return <EmptyState />;
    return (
      <section className="catalog">
        {groups.map(g => (
          <div key={g.key}>
            <div className="group-head">
              <h2>{g.key}</h2>
              <span className="group-count">{g.films.length} {g.films.length===1?'film':'films'}</span>
            </div>
            <div className="grid">
              {g.films.map(renderCard)}
            </div>
          </div>
        ))}
      </section>
    );
  }
  // flat list (sort by title or runtime)
  const sorted = [...films];
  if (sort === 'title') sorted.sort((a,b) => a.title.localeCompare(b.title));
  if (sort === 'runtime') sorted.sort((a,b) => a.runtime - b.runtime);

  if (sorted.length === 0) return <EmptyState />;
  return (
    <section className="catalog">
      <div className="group-head">
        <h2>{sort === 'title' ? 'All films' : 'By runtime'}<span className="zh-tag">{sort==='title' ? '全部影片' : '按片长'}</span></h2>
        <span className="group-count">{sorted.length} {sorted.length===1?'film':'films'}</span>
      </div>
      <div className="grid">
        {sorted.map(renderCard)}
      </div>
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

function Modal({ film, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  if (!film) return null;

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e)=>e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="Close">×</button>
        <div className="m-head">
          <div className="crest">
            <span className="sec">{film.section} · {film.sectionZh}</span>
            <span>{film.premiere}</span>
            <span>{film.country} · {film.year}</span>
            <span>{film.runtime} minutes</span>
            <span>{film.language} (subtitled 中/EN)</span>
          </div>
          <h2>{film.title}{film.title.includes(',') ? '' : <em>.</em>}</h2>
          <div className="h-zh">{film.titleZh}</div>
          <div className="tagline">
            <div><span className="k">Director / 导演</span><span>{film.director} · {film.directorZh}</span></div>
            <div><span className="k">Rating</span><span>{film.rating}</span></div>
            <div><span className="k">Tags</span><span>{film.tags.join(' · ')}</span></div>
          </div>
        </div>
        <div className="m-body">
          <div className="col">
            <h3>Synopsis · 简介</h3>
            <p>{film.synopsis}</p>
            <p className="zh">{film.synopsisZh}</p>

            <div className="stills">
              {film.stills.map((s, i) => (
                <div key={i} className="still" style={{ '--still': film.color, backgroundColor: film.color }}>
                  <span className="ix">STILL {String(i+1).padStart(2,'0')}</span>
                  <span className="lab">[ {s} ]</span>
                </div>
              ))}
            </div>

            <div className="credits">
              <div className="row"><span className="k">Cinematography</span><span>—</span></div>
              <div className="row"><span className="k">Editor</span><span>—</span></div>
              <div className="row"><span className="k">Producer</span><span>—</span></div>
              <div className="row"><span className="k">Sales</span><span>—</span></div>
            </div>
          </div>
          <div className="col">
            <h3>Schedule · 排片</h3>
            <div className="schedule-tba">
              <div className="tba-mark mono">— · —</div>
              <div className="tba-msg">
                Showtimes and venues<br/>
                <em>to be announced.</em>
              </div>
              <div className="tba-zh">放映场次与场馆待公布</div>
            </div>

            <div className="marquee-stat">
              <span className="big">{film.runtime}<span style={{fontSize:'0.4em', fontStyle:'italic', marginLeft:4}}>min</span></span>
              <span className="lab">runtime / 片长</span>
            </div>

            <div className="marquee-stat" style={{marginTop:6}}>
              <span className="big" style={{fontStyle:'italic'}}>{film.premiere === 'World Premiere' ? '1st' : film.premiere === 'International Premiere' ? '2nd' : film.premiere === 'Asian Premiere' ? '3rd' : '—'}</span>
              <span className="lab">{film.premiere} / 首映级别</span>
            </div>
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
            A <em>fan-made</em> showcase. Not affiliated with the festival.
            <span className="zh">影迷自製，非官方网站。</span>
          </div>
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
        <div>
          <h4>Catalog / 片单</h4>
          <ul>
            <li>All films · 全部影片</li>
            <li>By section · 按单元</li>
            <li>Schedule · 时间表</li>
            <li>My watchlist · 收藏</li>
          </ul>
        </div>
        <div>
          <h4>Newsletter / 通讯</h4>
          <ul>
            <li>Daily dispatch</li>
            <li>Critics' picks</li>
            <li>Awards updates</li>
            <li>RSS feed</li>
          </ul>
        </div>
      </div>
      <div className="small">
        <span>SIFF·2026 · Fan Showcase v0.1</span>
        <span>Type set in <em>Instrument Serif</em> &amp; <em>IBM Plex</em></span>
        <span>Built with care · 用心而作</span>
      </div>
    </footer>
  );
}

/* --- Tweaks --- */
function TweakControls({ tweaks, setTweak }) {
  return (
    <TweaksPanel title="Tweaks">
      <TweakSection label="Identity">
        <TweakColor
          label="Accent color"
          value={tweaks.accent}
          onChange={(v) => setTweak('accent', v)}
          options={['#c8392a', '#1d3a8a', '#0f5f3f', '#7a3aa6', '#1a1a1a']}
        />
      </TweakSection>
      <TweakSection label="Layout">
        <TweakRadio
          label="Density"
          value={tweaks.density}
          onChange={(v) => setTweak('density', v)}
          options={[
            { value: 'compact', label: 'Compact' },
            { value: 'comfortable', label: 'Default' },
            { value: 'airy', label: 'Airy' },
          ]}
        />
        <TweakRadio
          label="Language"
          value={tweaks.languageEmphasis}
          onChange={(v) => setTweak('languageEmphasis', v)}
          options={[
            { value: 'en', label: 'EN' },
            { value: 'balanced', label: 'EN/中' },
            { value: 'zh', label: '中文' },
          ]}
        />
      </TweakSection>
      <TweakSection label="Display">
        <TweakToggle
          label="Programs strip"
          value={tweaks.showSectionStrip}
          onChange={(v) => setTweak('showSectionStrip', v)}
        />
        <TweakToggle
          label="Mono metadata"
          value={tweaks.monoMetadata}
          onChange={(v) => setTweak('monoMetadata', v)}
        />
      </TweakSection>
    </TweaksPanel>
  );
}

/* --- App --- */
function App() {
  const [tweaks, setTweak] = useTweaks(window.SIFF_TWEAKS);
  const [query, setQuery] = useState('');
  const [section, setSection] = useState(null);
  const [country, setCountry] = useState(null);
  const [langFilter, setLangFilter] = useState(null);
  const [sort, setSort] = useState('section');
  const [openFilm, setOpenFilm] = useState(null);
  const [active, setActive] = useState('catalog');

  // Apply tweak attrs to body
  useEffect(() => {
    document.body.dataset.density = tweaks.density;
    document.body.dataset.langEmphasis = tweaks.languageEmphasis;
    document.body.dataset.mono = tweaks.monoMetadata ? 'on' : 'off';
    document.documentElement.style.setProperty('--accent', tweaks.accent);
  }, [tweaks]);

  const filtered = useMemo(() => {
    return FILMS.filter(f => {
      if (section && f.section !== section) return false;
      if (country && f.country !== country) return false;
      if (langFilter && f.language !== langFilter) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        const hay = [f.title, f.titleZh, f.director, f.directorZh, f.country, f.countryZh, f.section, f.language, ...f.tags].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [query, section, country, langFilter]);

  const clear = () => {
    setQuery(''); setSection(null); setCountry(null); setLangFilter(null);
  };

  const setLangEmphasis = (l) => setTweak('languageEmphasis', l);

  return (
    <>
      <Header active={active} onNavigate={setActive} lang={tweaks.languageEmphasis} setLang={setLangEmphasis} />
      <FestRibbon />
      {tweaks.showSectionStrip && <SectionStrip active={section} setActive={setSection} />}
      <FilterBar
        query={query} setQuery={setQuery}
        section={section} setSection={setSection}
        country={country} setCountry={setCountry}
        lang={langFilter} setLangFilter={setLangFilter}
        sort={sort} setSort={setSort}
        totalShown={filtered.length} totalAll={FILMS.length}
        onClear={clear}
      />
      <Catalog films={filtered} onOpen={setOpenFilm} sort={sort} />
      <Footer />
      {openFilm && <Modal film={openFilm} onClose={() => setOpenFilm(null)} />}
      <TweakControls tweaks={tweaks} setTweak={setTweak} />
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
