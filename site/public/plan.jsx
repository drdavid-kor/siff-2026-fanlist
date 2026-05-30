/* SIFF 2026 — personal calendar planner.
   No real showtimes exist, so the user fills the grid themselves: for any day × slot
   they add one or more (film + theatre) entries. Everything persists on-device. */

const { useState: _useState, useMemo: _useMemo, useCallback: _useCallback } = React;

const P_FILMS = window.SIFF_DATA.films;
const P_PROGS = window.SIFF_DATA.programs;
const P_FILM_BY_ID = Object.fromEntries(P_FILMS.map(f => [f.id, f]));
const P_PROG_BY_ID = Object.fromEntries(P_PROGS.map(p => [p.id, p]));
const P_DATES = window.SIFF_DATES;
const P_SLOTS = window.SIFF_SLOTS;
const P_THEATRES = window.SIFF_THEATRES;
const P_THEATRE = window.SIFF_THEATRE_BY_ID;
const P_FILMS_AZ = P_FILMS.slice().sort((a, b) => (a.title_en || '').localeCompare(b.title_en || ''));

const slotTime = (s) => `${P_SLOTS[s].start}–${P_SLOTS[s].end}`;
const entryId = (filmId, d, s, t) => `${filmId}@${d}-${s}-${t}`;

const P_REGIONS = (() => {
  const seen = new Map();
  P_THEATRES.forEach(t => { if (!seen.has(t.region)) seen.set(t.region, t.city); });
  return [...seen.keys()];
})();

/* ---------- Icons ---------- */
const TicketIcon = ({ filled }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
    <path d="M2 5.5A1.5 1.5 0 0 1 3.5 4h9A1.5 1.5 0 0 1 14 5.5V6a1.2 1.2 0 0 0 0 2.4v.1A1.5 1.5 0 0 1 12.5 12h-9A1.5 1.5 0 0 1 2 10.5v-.1A1.2 1.2 0 0 0 2 8V6z"
          fill={filled ? 'currentColor' : 'none'} strokeLinejoin="round"/>
    <path d="M9 4.5v7" strokeDasharray="1.4 1.4" stroke={filled ? 'var(--paper)' : 'currentColor'}/>
  </svg>
);
const PinIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M8 14s5-4.2 5-8A5 5 0 0 0 3 6c0 3.8 5 8 5 8z"/><circle cx="8" cy="6" r="1.7"/></svg>
);
const PlusIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 3v10M3 8h10"/></svg>
);
const PSearch = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="7" cy="7" r="5"/><path d="M11 11l4 4"/></svg>
);
const CheckIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 8.5l3.2 3L13 5"/></svg>
);

/* ---------- Persisted plan (array of entries) ---------- */
function usePlan() {
  const KEY = 'siff2026-plan-v2';
  const [entries, setEntries] = _useState(() => {
    try { const a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  });
  const save = (next) => { try { localStorage.setItem(KEY, JSON.stringify(next)); } catch (e) {} };
  const add = _useCallback((e) => {
    const id = entryId(e.filmId, e.dayIndex, e.slot, e.theatreId);
    setEntries(prev => {
      if (prev.some(x => x.id === id)) return prev;
      const next = [...prev, { id, filmId: e.filmId, dayIndex: e.dayIndex, slot: e.slot, theatreId: e.theatreId }];
      save(next); return next;
    });
  }, []);
  const remove = _useCallback((id) => {
    setEntries(prev => { const next = prev.filter(x => x.id !== id); save(next); return next; });
  }, []);
  const clear = _useCallback(() => { setEntries([]); save([]); }, []);
  return { entries, add, remove, clear };
}

/* ============ Entry chip (used in calendar cells) ============ */
function EntryChip({ entry, onOpenFilm, onRemove }) {
  const f = P_FILM_BY_ID[entry.filmId];
  const t = P_THEATRE[entry.theatreId];
  if (!f) return null;
  return (
    <div className="cal-chip" style={{ '--pc': f.color }}>
      <button className="cal-chip-main" onClick={() => onOpenFilm(f)}>
        <span className="cc-title">{f.title_en}</span>
        <span className="cc-venue"><PinIcon /> {t ? t.nameEn : '—'}</span>
      </button>
      <button className="cal-chip-x" title="Remove" onClick={() => onRemove(entry.id)}>×</button>
    </div>
  );
}

/* ============ Calendar planner ============ */
function CalendarView({ entries, onRemove, onClear, onAddSlot, onAddOpen, onOpenFilm }) {
  const [mode, setMode] = _useState('grid');
  const byCell = _useMemo(() => {
    const m = {};
    entries.forEach(e => { const k = e.dayIndex + '|' + e.slot; (m[k] = m[k] || []).push(e); });
    return m;
  }, [entries]);

  const dayCount = _useMemo(() => new Set(entries.map(e => e.dayIndex)).size, [entries]);
  const totalRuntime = entries.reduce((s, e) => s + (P_FILM_BY_ID[e.filmId]?.runtime || 0), 0);
  const hours = Math.floor(totalRuntime / 60), mins = totalRuntime % 60;

  const agendaDays = _useMemo(() => {
    const m = {};
    entries.forEach(e => { (m[e.dayIndex] = m[e.dayIndex] || []).push(e); });
    return Object.keys(m).map(Number).sort((a, b) => a - b)
      .map(di => ({ di, list: m[di].slice().sort((a, b) => a.slot - b.slot) }));
  }, [entries]);

  return (
    <section className="cal-view">
      <div className="wl-head">
        <div className="wl-head-left">
          <div className="pv-eyebrow mono">Build your own schedule · 自定义排片</div>
          <h1>My Plan<span className="pv-zh">行程</span></h1>
          <p className="pv-lead">
            {entries.length === 0
              ? <>Add a film + theatre to any slot below. We don't have the official grid — <b>this calendar is yours to fill</b>.</>
              : <>{entries.length} {entries.length === 1 ? 'screening' : 'screenings'} across {dayCount} {dayCount === 1 ? 'day' : 'days'}{totalRuntime > 0 && <> · {hours > 0 && `${hours}h `}{mins}m of cinema</>}<span className="wl-note"> · saved on this device</span></>}
          </p>
        </div>
        <div className="cal-head-actions">
          <div className="cal-modes">
            <button className={mode === 'grid' ? 'on' : ''} onClick={() => setMode('grid')}>Grid</button>
            <button className={mode === 'agenda' ? 'on' : ''} onClick={() => setMode('agenda')}>Agenda</button>
          </div>
          <button className="cal-add-btn" onClick={() => onAddOpen()}><PlusIcon /> Add screening</button>
          {entries.length > 0 && <button className="wl-clear mono" onClick={onClear}>Clear ×</button>}
        </div>
      </div>

      {mode === 'grid' ? (
        <div className="cal-wrap">
          <div className="cal-grid" style={{ gridTemplateColumns: `78px repeat(${P_DATES.length}, minmax(148px, 1fr))` }}>
            <div className="cal-corner mono">SIFF</div>
            {P_DATES.map(d => (
              <div key={d.index} className={"cal-dayhead" + (d.weekend ? ' weekend' : '')}>
                <span className="cdh-dow mono">{d.dow}</span>
                <span className="cdh-d">{d.day}</span>
                <span className="cdh-mon mono">Jun</span>
              </div>
            ))}
            {P_SLOTS.map(s => (
              <React.Fragment key={s.index}>
                <div className="cal-slotlabel">
                  <span className="csl-time mono">{s.start}</span>
                  <span className="csl-time-end mono">{s.end}</span>
                  <span className="csl-label">{s.label}</span>
                </div>
                {P_DATES.map(d => {
                  const cell = byCell[d.index + '|' + s.index] || [];
                  return (
                    <div key={d.index} className={"cal-cell" + (cell.length ? ' filled' : '') + (d.weekend ? ' weekend' : '')}>
                      {cell.map(e => <EntryChip key={e.id} entry={e} onOpenFilm={onOpenFilm} onRemove={onRemove} />)}
                      <button className="cal-add" onClick={() => onAddSlot(d.index, s.index)}>
                        <PlusIcon /><span>{cell.length ? 'add' : ''}</span>
                      </button>
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
          <div className="cal-hint mono">Scroll sideways for all 10 days · click any ＋ to plan a screening</div>
        </div>
      ) : (
        entries.length === 0 ? (
          <div className="wl-empty">
            <div className="big">Your calendar is empty.</div>
            <p>Use <b>Add screening</b>, or open any film and add it to a slot. Your plan builds up here day by day.</p>
            <button className="wl-browse mono" onClick={() => onAddOpen()}><PlusIcon /> Add your first screening</button>
          </div>
        ) : (
          <div className="plan-days">
            {agendaDays.map(({ di, list }) => {
              const d = P_DATES[di];
              return (
                <div key={di} className="plan-day">
                  <div className="plan-day-head">
                    <span className="pd-dow mono">{d.dow}</span>
                    <span className="pd-date">June {d.day}</span>
                    <span className="pd-zh zh">周{d.dowZh}</span>
                    <span className="pd-count mono">{list.length} {list.length === 1 ? 'film' : 'films'}</span>
                  </div>
                  <div className="plan-rows">
                    {list.map(e => {
                      const f = P_FILM_BY_ID[e.filmId]; const t = P_THEATRE[e.theatreId];
                      const prog = P_PROG_BY_ID[f.program_id];
                      return (
                        <div key={e.id} className="plan-row">
                          <div className="pr-time mono"><span className="pr-range">{slotTime(e.slot)}</span></div>
                          <button className="pr-poster" onClick={() => onOpenFilm(f)} style={{ backgroundColor: f.color }}>
                            {f.poster_url && <img src={f.poster_url} alt="" loading="lazy" />}
                          </button>
                          <button className="pr-body" onClick={() => onOpenFilm(f)}>
                            <div className="pr-title">{f.title_en}</div>
                            <div className="pr-zh zh">{f.title_zh}</div>
                            <div className="pr-venue mono"><PinIcon /> {t ? t.nameEn : '—'} · {t ? t.region : ''}{t && t.city !== 'Shanghai' ? ' · ' + t.city : ''}</div>
                            <div className="pr-meta">{prog && <span className="pr-prog">{prog.short_en}</span>}{f.runtime != null && <span className="mono">{f.runtime}′</span>}</div>
                          </button>
                          <button className="pr-remove" title="Remove" onClick={() => onRemove(e.id)}>×</button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </section>
  );
}

/* ============ Entry picker (manual film + day/slot + theatre) ============ */
function EntryPicker({ preset, watchIds, onClose, onConfirm }) {
  const [filmId, setFilmId] = _useState(preset.film ? preset.film.id : null);
  const [dayIndex, setDayIndex] = _useState(preset.day != null ? preset.day : null);
  const [slot, setSlot] = _useState(preset.slot != null ? preset.slot : null);
  const [theatreId, setTheatreId] = _useState(null);
  const [filmQ, setFilmQ] = _useState('');
  const [theaQ, setTheaQ] = _useState('');
  const [region, setRegion] = _useState('');

  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  const filmResults = _useMemo(() => {
    const q = filmQ.trim().toLowerCase();
    if (q) {
      return P_FILMS_AZ.filter(f => [f.title_en, f.title_zh, f.director, f.country, P_PROG_BY_ID[f.program_id]?.short_en]
        .filter(Boolean).join(' ').toLowerCase().includes(q)).slice(0, 80);
    }
    const saved = P_FILMS_AZ.filter(f => watchIds.has(f.id));
    return (saved.length ? saved : P_FILMS_AZ).slice(0, 60);
  }, [filmQ, watchIds]);
  const showingSaved = !filmQ.trim() && P_FILMS_AZ.some(f => watchIds.has(f.id));

  const theatreResults = _useMemo(() => {
    const q = theaQ.trim().toLowerCase();
    return P_THEATRES.filter(t => {
      if (region && t.region !== region) return false;
      if (q && !`${t.nameEn} ${t.nameZh} ${t.region} ${t.city}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [theaQ, region]);

  const film = filmId ? P_FILM_BY_ID[filmId] : null;
  const ready = filmId && dayIndex != null && slot != null && theatreId;
  const confirm = () => { if (ready) onConfirm({ filmId, dayIndex, slot, theatreId }); };

  return (
    <div className="picker-scrim" onClick={onClose}>
      <div className="picker" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="Close">×</button>
        <div className="picker-head">
          <div className="pv-eyebrow mono">Plan a screening · 添加场次</div>
          <h2>{film ? film.title_en : 'New screening'}</h2>
          {film && <div className="picker-head-zh zh">{film.title_zh}</div>}
        </div>

        <div className="picker-body">
          <section className="pk-sec">
            <h3><span className="pk-n">1</span> Film <span className="pk-zh">影片</span>{film && <span className="pk-chosen mono">✓ {film.title_en}</span>}</h3>
            <div className="pk-search">
              <PSearch />
              <input value={filmQ} onChange={e => setFilmQ(e.target.value)} placeholder={`Search ${P_FILMS.length} films…  搜索影片`} />
            </div>
            {showingSaved && <div className="pk-listnote mono">From your list · 我的收藏</div>}
            <div className="pk-film-list">
              {filmResults.map(f => {
                const prog = P_PROG_BY_ID[f.program_id];
                return (
                  <button key={f.id} className={"pk-film" + (f.id === filmId ? ' on' : '')} onClick={() => setFilmId(f.id)}>
                    <span className="pk-film-poster" style={{ backgroundColor: f.color }}>
                      {f.poster_url && <img src={f.poster_url} alt="" loading="lazy" />}
                    </span>
                    <span className="pk-film-text">
                      <span className="pk-film-title">{f.title_en}</span>
                      <span className="pk-film-sub zh">{f.title_zh}{prog ? ' · ' + prog.short_en : ''}</span>
                    </span>
                    {f.id === filmId && <span className="pk-film-check"><CheckIcon /></span>}
                  </button>
                );
              })}
              {filmResults.length === 0 && <div className="pk-empty mono">No films match “{filmQ}”.</div>}
            </div>
          </section>

          <section className="pk-sec">
            <h3><span className="pk-n">2</span> Day &amp; time <span className="pk-zh">日期时间</span></h3>
            <div className="pk-days">
              {P_DATES.map(d => (
                <button key={d.index} className={"pk-day" + (d.index === dayIndex ? ' on' : '') + (d.weekend ? ' weekend' : '')} onClick={() => setDayIndex(d.index)}>
                  <span className="pk-day-dow mono">{d.dow}</span>
                  <span className="pk-day-d">{d.day}</span>
                </button>
              ))}
            </div>
            <div className="pk-slots">
              {P_SLOTS.map(s => (
                <button key={s.index} className={"pk-slot" + (s.index === slot ? ' on' : '')} onClick={() => setSlot(s.index)}>
                  <span className="pk-slot-time mono">{s.start}–{s.end}</span>
                  <span className="pk-slot-label">{s.label}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="pk-sec">
            <h3><span className="pk-n">3</span> Theatre <span className="pk-zh">场馆</span>{theatreId && <span className="pk-chosen mono">✓ {P_THEATRE[theatreId].nameEn}</span>}</h3>
            <div className="pk-thea-filters">
              <div className="select">
                <select value={region} onChange={e => setRegion(e.target.value)}>
                  <option value="">All districts / 全部区域</option>
                  {P_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="pk-search pk-search-sm">
                <PSearch />
                <input value={theaQ} onChange={e => setTheaQ(e.target.value)} placeholder="Search venues…  搜索场馆" />
              </div>
            </div>
            <div className="pk-thea-list">
              {theatreResults.map(t => (
                <button key={t.id} className={"pk-thea" + (t.id === theatreId ? ' on' : '')} onClick={() => setTheatreId(t.id)}>
                  <span className="pk-thea-text">
                    <span className="pk-thea-name">{t.nameEn}</span>
                    <span className="pk-thea-zh zh">{t.nameZh}</span>
                  </span>
                  <span className="pk-thea-tags">
                    <span className="pk-thea-region mono">{t.region}{t.city !== 'Shanghai' ? ' · ' + t.city : ''}</span>
                    {t.imax && <span className="pk-thea-flag">IMAX</span>}
                    {t.flagship && <span className="pk-thea-flag">FLAGSHIP</span>}
                  </span>
                  {t.id === theatreId && <span className="pk-thea-check"><CheckIcon /></span>}
                </button>
              ))}
              {theatreResults.length === 0 && <div className="pk-empty mono">No venues match.</div>}
            </div>
          </section>
        </div>

        <div className="picker-foot">
          <div className="pk-summary">
            {ready ? (
              <span className="mono">
                {film.title_en} · {P_DATES[dayIndex].dow} {P_DATES[dayIndex].day} · {slotTime(slot)} · {P_THEATRE[theatreId].nameEn}
              </span>
            ) : (
              <span className="pk-summary-todo mono">
                {[!filmId && 'film', dayIndex == null && 'day', slot == null && 'time', !theatreId && 'theatre'].filter(Boolean).join(' · ') || ''} still to choose
              </span>
            )}
          </div>
          <button className={"pk-confirm" + (ready ? '' : ' off')} disabled={!ready} onClick={confirm}>
            <TicketIcon filled /> Add to plan
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============ Per-film plan section (inside the film modal) ============ */
function FilmPlanSection({ film, entries, onRemove, onAdd }) {
  const mine = entries.filter(e => e.filmId === film.id).sort((a, b) => (a.dayIndex - b.dayIndex) || (a.slot - b.slot));
  return (
    <div className="fps">
      {mine.length > 0 && (
        <div className="fps-list">
          {mine.map(e => {
            const d = P_DATES[e.dayIndex]; const t = P_THEATRE[e.theatreId];
            return (
              <div key={e.id} className="fps-row">
                <span className="fps-when mono"><b>{d.dow}</b> {d.day} · {slotTime(e.slot)}</span>
                <span className="fps-venue"><PinIcon /> {t ? t.nameEn : '—'}</span>
                <button className="fps-x" title="Remove" onClick={() => onRemove(e.id)}>×</button>
              </div>
            );
          })}
        </div>
      )}
      <button className="fps-add" onClick={() => onAdd(film)}>
        <PlusIcon /> {mine.length ? 'Add another screening' : 'Add to my plan'}
      </button>
      {mine.length === 0 && <div className="fps-note mono">Pick a day, time &amp; theatre — you set the schedule.</div>}
    </div>
  );
}

Object.assign(window, { usePlan, CalendarView, EntryPicker, FilmPlanSection, TicketIcon });
