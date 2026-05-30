// SIFF 2026 — calendar primitives for the personal planner.
// We do NOT have the real festival grid (which film plays which theatre at which
// slot), so nothing is generated. The user builds their own plan: dates × slots,
// and they choose the film + theatre for each entry themselves.
(function () {
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const DOW_ZH = ['日', '一', '二', '三', '四', '五', '六'];

  // Festival run: Jun 12–21, 2026
  const DATES = [];
  for (let d = 12; d <= 21; d++) {
    const dt = new Date(2026, 5, d);
    DATES.push({
      index: DATES.length,
      day: d,
      iso: `2026-06-${String(d).padStart(2, '0')}`,
      dow: DOW[dt.getDay()],
      dowZh: DOW_ZH[dt.getDay()],
      weekend: dt.getDay() === 0 || dt.getDay() === 6,
    });
  }

  // Five fixed screening slots
  const SLOTS = [
    { index: 0, start: '09:00', end: '12:00', label: 'Morning',    labelZh: '上午' },
    { index: 1, start: '12:00', end: '15:00', label: 'Midday',     labelZh: '午间' },
    { index: 2, start: '15:00', end: '18:00', label: 'Afternoon',  labelZh: '下午' },
    { index: 3, start: '18:00', end: '21:00', label: 'Prime',      labelZh: '黄金场' },
    { index: 4, start: '21:00', end: '24:00', label: 'Late Night', labelZh: '午夜场' },
  ];

  window.SIFF_DATES = DATES;
  window.SIFF_SLOTS = SLOTS;
  window.SIFF_THEATRE_BY_ID = Object.fromEntries(window.SIFF_THEATRES.map(t => [t.id, t]));
})();
