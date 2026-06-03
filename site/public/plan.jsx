/* SIFF 2026 — schedule browser + conflict-aware personal plan.
   Driven by the real festival grid (window.SIFF_SCREENINGS). The plan stores
   real screening ids; overlaps are detected from runtimes. Persists on-device. */

const { useState: _useState, useMemo: _useMemo, useCallback: _useCallback, useEffect: _useEffect, useRef: _useRef } = React;

const P_FILMS = window.SIFF_DATA.films;
const P_PROGS = window.SIFF_DATA.programs;
const P_FILM_BY_ID = Object.fromEntries(P_FILMS.map(f => [f.id, f]));
const P_PROG_BY_ID = Object.fromEntries(P_PROGS.map(p => [p.id, p]));
const P_DATES = window.SIFF_DATES;
const P_SLOTS = window.SIFF_SLOTS;
const P_THEATRE = window.SIFF_THEATRE_BY_ID;
const P_SCREENINGS = window.SIFF_SCREENINGS || [];
const P_SCR_BY_ID = Object.fromEntries(P_SCREENINGS.map(s => [s.id, s]));
const P_SCR_BY_FILM = window.SIFF_SCREENINGS_BY_FILM || {};

const P_SCR_BY_DAY = (() => {
  const m = {};
  P_SCREENINGS.forEach(s => { (m[s.di] = m[s.di] || []).push(s); });
  Object.values(m).forEach(l => l.sort((a, b) => a.m - b.m));
  return m;
})();
const P_DAY_COUNT = P_DATES.map(d => (P_SCR_BY_DAY[d.index] || []).length);

const P_REGIONS = (() => {
  const order = [];
  P_SCREENINGS.forEach(s => {
    const t = P_THEATRE[s.th];
    if (t && !order.includes(t.region)) order.push(t.region);
  });
  return order.sort((a, b) => a.localeCompare(b));
})();

const FMT_OPTS = (() => {
  const set = new Set();
  P_SCREENINGS.forEach(s => { if (s.fmt) set.add(s.fmt); });
  return [...set].sort();
})();

const runtimeOf = (filmId) => {
  const f = P_FILM_BY_ID[filmId];
  return (f && f.runtime) ? f.runtime : 120;
};
const endMin = (s) => s.m + runtimeOf(s.f);
const fmtMin = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const bandOf = (m) => (m < 12 * 60 ? 0 : m < 15 * 60 ? 1 : m < 18 * 60 ? 2 : m < 21 * 60 ? 3 : 4);
const overlaps = (a, b) => a.di === b.di && a.m < endMin(b) && b.m < endMin(a);

/* set of screening ids in `ids` that clash with at least one other in `ids` */
function clashSet(ids) {
  const list = ids.map(id => P_SCR_BY_ID[id]).filter(Boolean);
  const bad = new Set();
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      if (overlaps(list[i], list[j])) { bad.add(list[i].id); bad.add(list[j].id); }
    }
  }
  return bad;
}

const titleEnOf = (f) => f.title_en || f.title_zh || '';
const titleZhOf = (f) => f.title_zh || '';
const shortProg = (p) => p.short_en || p.title_en || '';

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
const CheckIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 8.5l3.2 3L13 5"/></svg>
);
const WarnIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M8 2l6 11H2z" strokeLinejoin="round"/><path d="M8 6.5v3M8 11.3v.1"/></svg>
);
const PSearchIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="7" cy="7" r="5"/><path d="M11 11l4 4"/></svg>
);

/* ---------- Persisted plan (array of screening ids) ---------- */
function usePlan() {
  const KEY = 'siff2026-plan-v3';
  const [ids, setIds] = _useState(() => {
    try {
      const a = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(a) ? a.filter(id => P_SCR_BY_ID[id]) : [];
    } catch (e) { return []; }
  });
  const save = (next) => { try { localStorage.setItem(KEY, JSON.stringify(next)); } catch (e) {} };
  const toggle = _useCallback((sid) => {
    setIds(prev => {
      const next = prev.includes(sid) ? prev.filter(x => x !== sid) : [...prev, sid];
      save(next);
      return next;
    });
  }, []);
  const remove = _useCallback((sid) => {
    setIds(prev => { const next = prev.filter(x => x !== sid); save(next); return next; });
  }, []);
  const clear = _useCallback(() => { setIds([]); save([]); }, []);
  const has = _useCallback((sid) => ids.includes(sid), [ids]);
  return { ids, toggle, remove, clear, has };
}

/* ============ Showtime list inside the film modal ============ */
function FilmShowtimes({ film, planIds, onToggle, lang }) {
  const list = (P_SCR_BY_FILM[film.id] || []).map(id => P_SCR_BY_ID[id]).filter(Boolean);
  const planScr = planIds.map(id => P_SCR_BY_ID[id]).filter(Boolean);
  const isZh = lang === 'zh';
  if (list.length === 0) {
    return (
      <div className="fps-note mono" style={{ marginTop: 4 }}>
        {isZh ? '暂无公开场次' : 'No public showtimes listed yet · 暂无公开场次'}
      </div>
    );
  }
  return (
    <div className="sc-picks">
      {list.map(s => {
        const d = P_DATES[s.di];
        const t = P_THEATRE[s.th];
        const inPlan = planIds.includes(s.id);
        const clash = !inPlan && planScr.some(p => p.f !== s.f && overlaps(p, s));
        const clashWith = clash ? planScr.find(p => p.f !== s.f && overlaps(p, s)) : null;
        const clashFilm = clashWith ? P_FILM_BY_ID[clashWith.f] : null;
        return (
          <div key={s.id} className={"sc-pick" + (inPlan ? ' in' : '')}>
            <div className="sc-pick-when">
              <span className="sc-date"><b>{d.dow}</b> {d.day}<span className="sc-jun">Jun</span></span>
              <span className="sc-time mono">{s.t}–{fmtMin(endMin(s))}</span>
            </div>
            <div className="sc-pick-act">
              {clash && (
                <span className="sc-clash" title={'Overlaps ' + (clashFilm ? titleEnOf(clashFilm) : '')}>
                  <WarnIcon /> {isZh ? '冲突' : 'clash'}
                </span>
              )}
              <button className={"sc-add" + (inPlan ? ' on' : '')} onClick={() => onToggle(s.id)}>
                {inPlan
                  ? <><CheckIcon /> {isZh ? '已加入' : 'In plan'}</>
                  : <><PlusIcon /> {isZh ? '加入' : 'Add'}</>}
              </button>
            </div>
            <div className="sc-pick-mid">
              <span className="sc-venue">
                <PinIcon />
                <span className="sc-venue-name">{t ? t.nameEn : '—'}</span>
                <span className="sc-venue-region">{t ? t.region + (t.city !== 'Shanghai' ? ' · ' + t.city : '') : ''}</span>
              </span>
              {s.fmt && <span className="sc-fmt">{s.fmt}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ============ A single card in the schedule browser ============ */
function ScheduleCard({ scr, inPlan, clash, onOpenFilm, onToggle }) {
  const f = P_FILM_BY_ID[scr.f];
  if (!f) return null;
  const t = P_THEATRE[scr.th];
  const prog = P_PROG_BY_ID[f.program_id];
  const showImg = !!f.poster_url;
  return (
    <div className={"sc-card" + (inPlan ? ' in' : '') + (clash ? ' clash' : '')}>
      <button className="sc-card-main" onClick={() => onOpenFilm(f)}>
        <span className="sc-card-poster" style={{ backgroundColor: f.color }}>
          {showImg && <img src={f.poster_url} alt="" loading="lazy" />}
        </span>
        <span className="sc-card-text">
          <span className="sc-card-time mono">
            {scr.t}
            <span className="sct-end">→{fmtMin(endMin(scr))}</span>
            {scr.fmt && <span className="sc-fmt">{scr.fmt}</span>}
          </span>
          <span className="sc-card-title">{titleEnOf(f)}</span>
          <span className="sc-card-zh zh">{titleZhOf(f)}</span>
          <span className="sc-card-venue"><PinIcon /> {t ? t.nameEn : '—'}</span>
          <span className="sc-card-tags">
            <span className="sc-card-region">{t ? t.region : ''}</span>
            {prog && <span className="sc-card-prog">{shortProg(prog)}</span>}
          </span>
        </span>
      </button>
      <button
        className={"sc-card-add" + (inPlan ? ' on' : '')}
        title={inPlan ? 'Remove from plan' : (clash ? 'Add (overlaps a planned film)' : 'Add to plan')}
        onClick={() => onToggle(scr.id)}
      >
        {inPlan ? <CheckIcon /> : <PlusIcon />}
      </button>
    </div>
  );
}

/* ============ Today's-clash banner ============ */
function TodaysClashBanner({ clashIds, dObj, isZh }) {
  if (!clashIds || clashIds.size === 0) return null;
  const n = Math.max(1, Math.ceil(clashIds.size / 2));
  return (
    <div className="plan-conflict-banner" style={{ margin: '0 var(--pad)' }}>
      <WarnIcon />
      <span>
        <b>{n}</b>{' '}
        {isZh
          ? <>个时间冲突 · {dObj.dow} {dObj.day}</>
          : <>overlap{n === 1 ? '' : 's'} in your plan on {dObj.dow} {dObj.day}</>}
      </span>
      {!isZh && <span className="pcb-zh zh">该日行程有时间冲突</span>}
    </div>
  );
}

/* ============ Schedule browser (browse by day) ============ */
function ScheduleView({ lang, planIds, onToggle, onOpenFilm }) {
  const isZh = lang === 'zh';
  const [day, setDay] = _useState(() => {
    const firstWith = P_DATES.find(d => (P_SCR_BY_DAY[d.index] || []).length);
    return firstWith ? firstWith.index : 0;
  });
  const [region, setRegion] = _useState('');
  const [fmt, setFmt] = _useState('');
  const [listOnly, setListOnly] = _useState(false);
  const [q, setQ] = _useState('');
  const railRef = _useRef(null);

  const planScr = _useMemo(() => planIds.map(id => P_SCR_BY_ID[id]).filter(Boolean), [planIds]);
  const planByDay = _useMemo(() => {
    const m = {};
    planScr.forEach(s => { (m[s.di] = m[s.di] || []).push(s); });
    return m;
  }, [planScr]);

  const dayScr = P_SCR_BY_DAY[day] || [];
  const filtered = _useMemo(() => {
    const query = q.trim().toLowerCase();
    return dayScr.filter(s => {
      const t = P_THEATRE[s.th];
      const f = P_FILM_BY_ID[s.f];
      if (!f) return false;
      if (region && (!t || t.region !== region)) return false;
      if (fmt && s.fmt !== fmt) return false;
      if (listOnly && !planIds.includes(s.id)) return false;
      if (query) {
        const prog = P_PROG_BY_ID[f.program_id];
        const hay = [
          f.title_en, f.title_zh, f.director, f.director_zh,
          t && t.nameEn, t && t.nameZh,
          prog && shortProg(prog),
        ].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [dayScr, region, fmt, listOnly, q, planIds]);

  const bands = _useMemo(() => {
    const b = P_SLOTS.map(s => ({ slot: s, list: [] }));
    filtered.forEach(s => b[bandOf(s.m)].list.push(s));
    b.forEach(x => x.list.sort((a, c) => a.m - c.m || titleEnOf(P_FILM_BY_ID[a.f]).localeCompare(titleEnOf(P_FILM_BY_ID[c.f]))));
    return b;
  }, [filtered]);

  const dObj = P_DATES[day];
  const todaysPlanClash = _useMemo(
    () => clashSet((planByDay[day] || []).map(s => s.id)),
    [planByDay, day],
  );
  const cardClash = (s) => !planIds.includes(s.id) && (planByDay[day] || []).some(p => p.f !== s.f && overlaps(p, s));

  const anyFilter = region || fmt || listOnly || q.trim();

  const totalFilms = Object.keys(P_SCR_BY_FILM).length;

  return (
    <section className="sched-view">
      <div className="sched-intro">
        <div className="pv-eyebrow mono">{isZh ? '全部场次 · 排片表' : 'The festival grid · 全部场次'}</div>
        <h1>Schedule<span className="pv-zh">排片表</span></h1>
        <p className="pv-lead">
          {isZh
            ? <>{P_SCREENINGS.length.toLocaleString()} 场放映 · {totalFilms} 部影片 · 共 {P_DATES.length} 天。选择日期，点击 ＋ 加入排片。冲突会自动标记。</>
            : <>{P_SCREENINGS.length.toLocaleString()} screenings of {totalFilms} films across {P_DATES.length} days. Browse a day, then tap ＋ to build your plan — overlaps are flagged automatically.</>}
        </p>
      </div>

      {/* Day rail */}
      <div className="day-pills" ref={railRef}>
        {P_DATES.map(d => {
          const planned = (planByDay[d.index] || []).length;
          return (
            <button
              key={d.index}
              className={"day-pill" + (d.index === day ? ' on' : '')}
              onClick={() => setDay(d.index)}
            >
              <span className="dp-dow">{d.dow}</span>
              <span className="dp-d">{d.day}</span>
              <span className="dp-n">{P_DAY_COUNT[d.index]}{planned ? ' · ★' + planned : ''}</span>
            </button>
          );
        })}
      </div>

      {/* Sticky filters */}
      <div className="sched-filters">
        <div className="sched-day-label">
          <span className="sdl-dow mono">{dObj.dow}</span>
          <span className="sdl-d">{isZh ? `6月${dObj.day}日` : `June ${dObj.day}`}</span>
          <span className="sdl-n">
            {isZh
              ? <>{filtered.length} / {dayScr.length} 场</>
              : <>{filtered.length} of {dayScr.length} screenings</>}
          </span>
        </div>
        <div className="sched-filter-controls">
          <div className="search sched-search">
            <PSearchIcon />
            <input
              value={q} onChange={e => setQ(e.target.value)}
              placeholder={isZh ? '搜索影片、导演、影院…' : 'Film, director, venue…  搜索'}
            />
          </div>
          <div className="select">
            <select value={region} onChange={e => setRegion(e.target.value)}>
              <option value="">{isZh ? '全部区域' : 'All districts / 全部区域'}</option>
              {P_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="select">
            <select value={fmt} onChange={e => setFmt(e.target.value)}>
              <option value="">{isZh ? '全部格式' : 'Any format / 全部格式'}</option>
              {FMT_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <button className={"sched-toggle" + (listOnly ? ' on' : '')} onClick={() => setListOnly(v => !v)}>
            <TicketIcon filled={listOnly} /> {isZh ? '只看排片' : 'In my plan'}
          </button>
          {anyFilter && (
            <button className="clear" onClick={() => { setRegion(''); setFmt(''); setListOnly(false); setQ(''); }}>
              {isZh ? '清除 ×' : 'Clear ×'}
            </button>
          )}
        </div>
      </div>

      <TodaysClashBanner clashIds={todaysPlanClash} dObj={dObj} isZh={isZh} />

      {filtered.length === 0 ? (
        <div className="sched-empty">
          <div className="big">{isZh ? '今日无匹配。' : 'Nothing here.'}</div>
          <div className="mono">
            {listOnly
              ? (isZh ? '该日尚未加入排片 · 无匹配场次' : 'No planned films on this day · 无匹配场次')
              : (isZh ? '无匹配场次 · No screenings match your filters' : 'No screenings match your filters · 无匹配场次')}
          </div>
        </div>
      ) : (
        bands.map(b => (
          <div key={b.slot.index} className={"slot-band" + (b.list.length ? '' : ' empty')}>
            <div className="slot-band-head">
              <span className="sb-time mono">{b.slot.start}–{b.slot.end}</span>
              <span className="sb-label">
                {isZh ? b.slot.labelZh : <>{b.slot.label} <span className="zh">{b.slot.labelZh}</span></>}
              </span>
              <span className="sb-count mono">{b.list.length}</span>
            </div>
            {b.list.length === 0 ? (
              <div className="slot-band-empty mono">— · —</div>
            ) : (
              <div className="sc-grid">
                {b.list.map(s => (
                  <ScheduleCard
                    key={s.id} scr={s}
                    inPlan={planIds.includes(s.id)}
                    clash={cardClash(s)}
                    onOpenFilm={onOpenFilm} onToggle={onToggle}
                  />
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </section>
  );
}

/* ============ My Plan (agenda, conflict-aware) ============ */
function PlanView({ lang, planIds, onRemove, onClear, onOpenFilm, onBrowse }) {
  const isZh = lang === 'zh';
  const scr = _useMemo(() => planIds.map(id => P_SCR_BY_ID[id]).filter(Boolean), [planIds]);
  const clash = _useMemo(() => clashSet(planIds), [planIds]);
  const totalRuntime = scr.reduce((s, x) => s + runtimeOf(x.f), 0);
  const hours = Math.floor(totalRuntime / 60), mins = totalRuntime % 60;
  const dayCount = new Set(scr.map(s => s.di)).size;
  const conflictPairs = Math.ceil(clash.size / 2);

  const days = _useMemo(() => {
    const m = {};
    scr.forEach(s => { (m[s.di] = m[s.di] || []).push(s); });
    return Object.keys(m).map(Number).sort((a, b) => a - b)
      .map(di => ({ di, list: m[di].slice().sort((a, b) => a.m - b.m) }));
  }, [scr]);

  return (
    <section className="plan-view">
      <div className="wl-head">
        <div className="wl-head-left">
          <div className="pv-eyebrow mono">{isZh ? '我的排片 · 行程' : 'Your festival schedule · 我的排片'}</div>
          <h1>My Plan<span className="pv-zh">行程</span></h1>
          <p className="pv-lead">
            {scr.length === 0
              ? (isZh
                  ? <>打开 <b>排片表</b>，点击任意场次旁的 ＋ 加入你的行程。</>
                  : <>Browse the <b>Schedule</b> and tap ＋ on any showtime to build your festival here.</>)
              : (isZh
                  ? <>{scr.length} 场 · 共 {dayCount} 天{totalRuntime > 0 && <> · 影院中 {hours > 0 && `${hours}小时`}{mins}分钟</>}<span className="wl-note"> · 仅保存在本设备</span></>
                  : <>{scr.length} {scr.length === 1 ? 'screening' : 'screenings'} across {dayCount} {dayCount === 1 ? 'day' : 'days'}{totalRuntime > 0 && <> · {hours > 0 && `${hours}h `}{mins}m in the dark</>}<span className="wl-note"> · saved on this device</span></>)}
          </p>
        </div>
        <div className="cal-head-actions">
          <button className="cal-add-btn" onClick={onBrowse}><PlusIcon /> {isZh ? '浏览排片表' : 'Browse schedule'}</button>
          {scr.length > 0 && <button className="wl-clear mono" onClick={onClear}>{isZh ? '清空 ×' : 'Clear ×'}</button>}
        </div>
      </div>

      {conflictPairs > 0 && (
        <div className="plan-conflict-banner">
          <WarnIcon />
          <span>
            <b>{conflictPairs}</b>{' '}
            {isZh
              ? <>处时间冲突 · 行程内场次时间重叠，移除其一即可解决。</>
              : <>time {conflictPairs === 1 ? 'conflict' : 'conflicts'} — two films overlap. Drop one to resolve.</>}
          </span>
          {!isZh && <span className="pcb-zh zh">行程存在时间冲突</span>}
        </div>
      )}

      {scr.length === 0 ? (
        <div className="wl-empty">
          <div className="big">{isZh ? '行程还是空的。' : 'Your plan is empty.'}</div>
          <p>
            {isZh
              ? <>打开 <b>排片表</b> 浏览十天的所有场次，或直接在影片页加入。</>
              : <>Open the <b>Schedule</b> to see every showtime across the ten days, or add screenings straight from any film.</>}
          </p>
          <div className="plan-empty-actions">
            <button className="wl-browse mono" onClick={onBrowse}><PlusIcon /> {isZh ? '打开排片表' : 'Open the schedule'}</button>
          </div>
        </div>
      ) : (
        <div className="plan-days">
          {days.map(({ di, list }) => {
            const d = P_DATES[di];
            return (
              <div key={di} className="plan-day">
                <div className="plan-day-head">
                  <span className="pd-dow mono">{d.dow}</span>
                  <span className="pd-date">{isZh ? `6月${d.day}日` : `June ${d.day}`}</span>
                  <span className="pd-zh zh">周{d.dowZh}</span>
                  <span className="pd-count mono">
                    {isZh ? `${list.length} 部` : `${list.length} ${list.length === 1 ? 'film' : 'films'}`}
                  </span>
                </div>
                <div className="plan-rows">
                  {list.map(s => {
                    const f = P_FILM_BY_ID[s.f];
                    const t = P_THEATRE[s.th];
                    const prog = P_PROG_BY_ID[f.program_id];
                    const isClash = clash.has(s.id);
                    const showImg = !!f.poster_url;
                    return (
                      <div key={s.id} className={"plan-row" + (isClash ? ' conflict' : '')}>
                        <div className="pr-time">
                          <span className="pr-range mono">{s.t}–{fmtMin(endMin(s))}</span>
                          {isClash && <span className="pr-clash"><WarnIcon /> {isZh ? '冲突' : 'overlap'}</span>}
                        </div>
                        <button className="pr-poster" onClick={() => onOpenFilm(f)} style={{ backgroundColor: f.color }}>
                          {showImg && <img src={f.poster_url} alt="" loading="lazy" />}
                        </button>
                        <button className="pr-body" onClick={() => onOpenFilm(f)}>
                          <div className="pr-title">{titleEnOf(f)}</div>
                          <div className="pr-zh zh">{titleZhOf(f)}</div>
                          <div className="pr-venue mono">
                            <PinIcon /> {t ? t.nameEn : '—'} · {t ? t.region : ''}{t && t.city !== 'Shanghai' ? ' · ' + t.city : ''}
                          </div>
                          <div className="pr-meta">
                            {prog && <span className="pr-prog">{shortProg(prog)}</span>}
                            {s.fmt && <span className="sc-fmt">{s.fmt}</span>}
                            {f.runtime != null && <span className="mono">{f.runtime}′</span>}
                          </div>
                        </button>
                        <button className="pr-remove" title={isZh ? '移除' : 'Remove'} onClick={() => onRemove(s.id)}>×</button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

Object.assign(window, { usePlan, ScheduleView, PlanView, FilmShowtimes, TicketIcon });
