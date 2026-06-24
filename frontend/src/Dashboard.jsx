import { useState, useMemo, useRef } from 'react';
import { ArrowLeftIcon, ChevronDownIcon } from './icons';
import PrintReport from './PrintReport';
import './Dashboard.css';

const SCHENGEN_COUNTRIES = new Set([
  'AT','BE','CZ','DK','EE','FI','FR','DE','GR','HU',
  'IS','IT','LV','LI','LT','LU','MT','NL','NO','PL',
  'PT','SK','SI','ES','SE','CH',
]);

const PALETTE = [
  '#c42344', // crimson
  '#cc5214', // orange-red
  '#b46f09', // amber
  '#7a8a10', // olive
  '#267a42', // forest green
  '#0e7060', // dark teal
  '#0b6e99', // ocean
  '#2a5ad4', // blue
  '#4b42d6', // indigo
  '#7034d4', // violet
  '#9420b0', // purple
  '#b52079', // pink
  '#0b6b62', // teal
  '#4d8a28', // green
  '#1e7a4d', // emerald
  '#0f6ba0', // steel blue
  '#a35a1a', // brown-orange
  '#748a0f', // yellow-green
  '#c21048', // rose
  '#7030a8', // deep violet
];

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DOW = ['Mo','Tu','We','Th','Fr','Sa','Su'];

const DEFAULT_OPEN = { dateRange: true, countries: true, calendar: true };

function addDaysToStr(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const obj = new Date(Date.UTC(y, m - 1, d));
  obj.setUTCDate(obj.getUTCDate() + n);
  return `${obj.getUTCFullYear()}-${String(obj.getUTCMonth() + 1).padStart(2, '0')}-${String(obj.getUTCDate()).padStart(2, '0')}`;
}

function daysBetweenStr(a, b) {
  if (!a || !b) return 0;
  const pa = a.split('-').map(Number);
  const pb = b.split('-').map(Number);
  const da = new Date(Date.UTC(pa[0], pa[1] - 1, pa[2]));
  const db = new Date(Date.UTC(pb[0], pb[1] - 1, pb[2]));
  return Math.max(0, Math.round((db - da) / 86400000));
}

function formatBridgeDate(dateStr) {
  if (!dateStr) return { md: '', y: '' };
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return {
    md: dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    y: String(y),
  };
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function StatusBar({ total, windowSize, projection, asOf, isHistorical }) {
  const pct = Math.min((total / 90) * 100, 100);
  const color = total >= 90 ? '#c42344' : total >= 75 ? '#cc5214' : 'var(--text2)';
  const limitLabel = total >= 90
    ? 'Limit reached'
    : total >= 75
    ? `${90 - total} days left — caution`
    : `${90 - total} days remaining`;
  const label = windowSize === 180 ? limitLabel : `in ${windowSize}-day window`;
  return (
    <div className="status-bar-wrap">
      <div className="status-bar-track">
        <div className="status-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="status-bar-labels">
        <span style={{ color }}>{total} / 90 Schengen days used</span>
        <span className="status-bar-remain" style={{ color }}>{label}</span>
      </div>
      {isHistorical && (
        <div className="asof-tag">as of {formatDate(asOf)}</div>
      )}
      {projection && projection.count > 0 && (
        <div className="proj-sub">
          {projection.earliestReentryDate && (
            <div className="proj-row">
              <strong>Earliest re-entry:</strong>{' '}
              {formatDate(projection.earliestReentryDate)}{' '}
              <span className="proj-days">({projection.earliestReentryDays}d)</span>
            </div>
          )}
          <div className="proj-row">
            <strong>Full 90-day allowance restored:</strong>{' '}
            {formatDate(projection.fullResetDate)}{' '}
            <span className="proj-days">({projection.fullResetDays}d)</span>
          </div>
          <div className="proj-note">
            <strong>90/180 rule:</strong> max 90 days in any rolling 180-day window.
            Projections assume you leave the Schengen Area today and don't return.
          </div>
        </div>
      )}
    </div>
  );
}

function FeieStatusBar({ stats, asOf }) {
  const { usaCount, nonUsaCount, qualifies, qualifyingDate, daysUntilQualifying, windowLen, startDateStr } = stats;
  const pct = Math.min((nonUsaCount / 330) * 100, 100);
  const color = qualifies
    ? '#267a42'
    : pct >= 75
    ? '#b46f09'
    : 'var(--text2)';
  return (
    <div className="status-bar-wrap feie-bar">
      <div className="status-bar-track">
        <div className="status-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="status-bar-labels">
        <span style={{ color }}>{nonUsaCount} / 330 outside-USA days</span>
        <span className="status-bar-remain" style={{ color }}>
          {qualifies ? 'Qualifies ✓' : `${daysUntilQualifying} more needed`}
        </span>
      </div>
      <div className="asof-tag">
        Period: {formatDate(startDateStr)} → {formatDate(asOf)} ({windowLen}d, {usaCount} in US)
      </div>
      <div className="proj-sub">
        <div className="proj-row">
          <strong>{qualifies ? 'Hit 330 outside-USA days on:' : 'Projected qualification:'}</strong>{' '}
          {formatDate(qualifyingDate)}
          {!qualifies && (
            <> <span className="proj-days">({daysUntilQualifying}d from {formatDate(asOf)})</span></>
          )}
        </div>
        <div className="proj-note">
          <strong>FEIE Physical Presence Test:</strong> 330+ days outside the USA in any
          365-day window. Tally counts outside-USA days from your selected start date
          ({formatDate(startDateStr)}); projection assumes continuous absence from the USA
          after {formatDate(asOf)}. Adjust the slider to set period start and evaluation date.
        </div>
      </div>
    </div>
  );
}

function ProjectionCard({ title, date, daysAway, color, qualified, qualifiedLabel, note }) {
  const accent = color ?? '#267a42';
  if (qualified) {
    return (
      <div className="projection-card qualified" style={{ '--proj-accent': accent }}>
        <div className="proj-card-title">{title}</div>
        <div className="proj-card-status">{qualifiedLabel ?? '✓ Currently qualifying'}</div>
        {note && <div className="proj-card-note">{note}</div>}
      </div>
    );
  }
  if (!date) return null;
  return (
    <div className="projection-card" style={{ '--proj-accent': accent }}>
      <div className="proj-card-title">{title}</div>
      <div className="proj-card-date">{formatDate(date)}</div>
      {daysAway != null && (
        <div className="proj-card-countdown">
          <span className="proj-card-num">{daysAway}</span>
          <span className="proj-card-unit">{daysAway === 1 ? 'day away' : 'days away'}</span>
        </div>
      )}
      {note && <div className="proj-card-note">{note}</div>}
    </div>
  );
}

function SectionHeader({ title, open, onToggle, note }) {
  return (
    <button className={`section-header${open ? ' open' : ''}`} onClick={onToggle} aria-expanded={open}>
      <span className="section-title">
        {title}
        {note && <span className="section-note">{note}</span>}
      </span>
      <ChevronDownIcon size={18} className={`section-chevron${open ? ' open' : ''}`} />
    </button>
  );
}

export default function Dashboard({ data, onReset }) {
  const { days, countryNames = {} } = data;
  const [tab, setTab] = useState('schengen');

  const defaultStart = Math.max(0, days.length - 180);
  const [startIdx, setStartIdx] = useState(defaultStart);
  const [endIdx, setEndIdx] = useState(days.length - 1);
  // null=free, 'start'=left pinned, 'end'=right pinned, 'both'=drag fill to slide
  const [lockedThumb, setLockedThumb] = useState(null);
  const sliderRef = useRef(null);

  // Extend the days array 366 days into the future with empty entries so the
  // slider can project forward past the last recorded travel date.
  const extendedDays = useMemo(() => {
    if (!days.length) return days;
    const lastDate = days[days.length - 1].date;
    const future = [];
    for (let i = 1; i <= 366; i++) {
      future.push({ date: addDaysToStr(lastDate, i), countries: [] });
    }
    return [...days, ...future];
  }, [days]);

  const sliderMax = extendedDays.length - 1;

  function handleStartLockToggle() {
    setLockedThumb(prev => {
      if (prev === 'start') return null;
      if (prev === 'both') return 'end';
      if (prev === 'end') return 'both';
      return 'start';
    });
  }
  function handleEndLockToggle() {
    setLockedThumb(prev => {
      if (prev === 'end') return null;
      if (prev === 'both') return 'start';
      if (prev === 'start') return 'both';
      return 'end';
    });
  }

  // Body drag: scroll dates without moving the bar (windowSize stays constant → barLeftPct stays constant)
  const handleBarMouseDown = (e) => {
    e.preventDefault();
    const rect = sliderRef.current.getBoundingClientRect();
    const wLen = endIdx - startIdx;
    const startX = e.clientX;
    const startStart = startIdx;
    const handlers = {};
    const cleanup = () => {
      document.removeEventListener('mousemove', handlers.move);
      document.removeEventListener('mouseup', cleanup);
    };
    handlers.move = (ev) => {
      const raw = startStart + Math.round(((ev.clientX - startX) / rect.width) * sliderMax);
      const clamped = Math.max(0, Math.min(raw, sliderMax - wLen));
      setStartIdx(clamped);
      setEndIdx(clamped + wLen);
      if (raw <= 0 || raw + wLen >= sliderMax) cleanup();
    };
    document.addEventListener('mousemove', handlers.move);
    document.addEventListener('mouseup', cleanup);
  };

  const handleBarTouchStart = (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = sliderRef.current.getBoundingClientRect();
    const wLen = endIdx - startIdx;
    const startX = touch.clientX;
    const startStart = startIdx;
    const handlers = {};
    const cleanup = () => {
      document.removeEventListener('touchmove', handlers.move);
      document.removeEventListener('touchend', cleanup);
    };
    handlers.move = (ev) => {
      ev.preventDefault();
      const raw = startStart + Math.round(((ev.touches[0].clientX - startX) / rect.width) * sliderMax);
      const clamped = Math.max(0, Math.min(raw, sliderMax - wLen));
      setStartIdx(clamped);
      setEndIdx(clamped + wLen);
      if (raw <= 0 || raw + wLen >= sliderMax) cleanup();
    };
    document.addEventListener('touchmove', handlers.move, { passive: false });
    document.addEventListener('touchend', cleanup);
  };

  // Triangle drag: symmetric resize from center. Tap (no drag) toggles lock.
  const handleTriangleMouseDown = (side, e) => {
    e.preventDefault();
    const startX = e.clientX;
    const rect = sliderRef.current.getBoundingClientRect();
    const centerAtStart = Math.round((startIdx + endIdx) / 2);
    const halfAtStart = Math.round((endIdx - startIdx) / 2);
    let dragged = false;
    const handlers = {};
    const cleanup = () => {
      document.removeEventListener('mousemove', handlers.move);
      document.removeEventListener('mouseup', handlers.up);
    };
    handlers.move = (ev) => {
      if (Math.abs(ev.clientX - startX) > 4) dragged = true;
      if (!dragged) return;
      const delta = Math.round(((ev.clientX - startX) / rect.width) * sliderMax);
      const newHalf = Math.max(1, side === 'start' ? halfAtStart - delta : halfAtStart + delta);
      setStartIdx(Math.max(0, centerAtStart - newHalf));
      setEndIdx(Math.min(sliderMax, centerAtStart + newHalf));
    };
    handlers.up = () => {
      if (!dragged) {
        if (side === 'start') handleStartLockToggle();
        else handleEndLockToggle();
      }
      cleanup();
    };
    document.addEventListener('mousemove', handlers.move);
    document.addEventListener('mouseup', handlers.up);
  };

  const handleTriangleTouchStart = (side, e) => {
    e.preventDefault();
    const startX = e.touches[0].clientX;
    const rect = sliderRef.current.getBoundingClientRect();
    const centerAtStart = Math.round((startIdx + endIdx) / 2);
    const halfAtStart = Math.round((endIdx - startIdx) / 2);
    let dragged = false;
    const handlers = {};
    const cleanup = () => {
      document.removeEventListener('touchmove', handlers.move);
      document.removeEventListener('touchend', handlers.up);
    };
    handlers.move = (ev) => {
      ev.preventDefault();
      if (Math.abs(ev.touches[0].clientX - startX) > 4) dragged = true;
      if (!dragged) return;
      const delta = Math.round(((ev.touches[0].clientX - startX) / rect.width) * sliderMax);
      const newHalf = Math.max(1, side === 'start' ? halfAtStart - delta : halfAtStart + delta);
      setStartIdx(Math.max(0, centerAtStart - newHalf));
      setEndIdx(Math.min(sliderMax, centerAtStart + newHalf));
    };
    handlers.up = () => {
      if (!dragged) {
        if (side === 'start') handleStartLockToggle();
        else handleEndLockToggle();
      }
      cleanup();
    };
    document.addEventListener('touchmove', handlers.move, { passive: false });
    document.addEventListener('touchend', handlers.up);
  };

  function applyPreset(n) {
    const currentCenter = Math.round((startIdx + endIdx) / 2);
    const half = Math.floor(n / 2);
    const ns = Math.max(0, currentCenter - half);
    const ne = Math.min(sliderMax, ns + n - 1);
    setStartIdx(ns);
    setEndIdx(ne);
  }

  // Collapsible sections
  const [sectionOpen, setSectionOpen] = useState({ ...DEFAULT_OPEN });
  const [snapshot, setSnapshot] = useState(null);
  const [snapshotDirty, setSnapshotDirty] = useState(false);
  const [showPrint, setShowPrint] = useState(false);

  const allClosed = Object.values(sectionOpen).every(v => !v);

  function masterToggle() {
    if (allClosed) {
      if (snapshot && !snapshotDirty) setSectionOpen(snapshot);
      else setSectionOpen({ ...DEFAULT_OPEN });
      setSnapshot(null);
      setSnapshotDirty(false);
    } else {
      setSnapshot({ ...sectionOpen });
      setSnapshotDirty(false);
      setSectionOpen({ dateRange: false, countries: false, calendar: false });
    }
  }

  function toggleSection(id) {
    setSectionOpen(prev => ({ ...prev, [id]: !prev[id] }));
    if (snapshot !== null) setSnapshotDirty(true);
  }

  const visibleDays = useMemo(
    () => extendedDays.slice(startIdx, endIdx + 1),
    [extendedDays, startIdx, endIdx]
  );
  const windowSize = endIdx - startIdx + 1;
  const barWidthPct = (windowSize / (sliderMax + 1)) * 100;
  const barLeftPct = (100 - barWidthPct) / 2;

  // SVG suspension bridge constants (viewBox 0 0 1000 150)
  const B_LX = barLeftPct * 10;
  const B_RX = (100 - barLeftPct) * 10;
  const B_TY = 18;   // tower top y
  const B_DY = 92;   // deck y
  const B_CY = 118;  // cable bezier control point y (below deck → dramatic sag)

  const bridgeHangers = useMemo(() => {
    const n = 14;
    const result = [];
    for (let i = 1; i <= n; i++) {
      const t = i / (n + 1);
      const x = B_LX + t * (B_RX - B_LX);
      const cy = (1-t)*(1-t)*B_TY + 2*(1-t)*t*B_CY + t*t*B_TY;
      if (cy < B_DY) result.push({ x, cy });
    }
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barLeftPct]);

  const bridgeTicks = useMemo(() => {
    const start = extendedDays[startIdx]?.date;
    const end = extendedDays[endIdx]?.date;
    if (!start || !end) return [];
    const startMs = new Date(start + 'T00:00:00Z').getTime();
    const endMs = new Date(end + 'T00:00:00Z').getTime();
    const totalMs = endMs - startMs;
    if (totalMs <= 0) return [];
    const MA = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const result = [];
    const cur = new Date(startMs);
    cur.setUTCDate(1);
    if (new Date(startMs).getUTCDate() !== 1) cur.setUTCMonth(cur.getUTCMonth() + 1);
    while (cur.getTime() <= endMs) {
      const frac = (cur.getTime() - startMs) / totalMs;
      const x = B_LX + frac * (B_RX - B_LX);
      const m = cur.getUTCMonth();
      const y = cur.getUTCFullYear();
      result.push({ x, label: m === 0 ? String(y) : MA[m], major: m === 0 });
      cur.setUTCMonth(cur.getUTCMonth() + 1);
    }
    // thin out if too many ticks
    if (result.length > 24) return result.filter(t => t.major);
    if (result.length > 12) return result.filter((t, i) => t.major || i % 3 === 0);
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extendedDays, startIdx, endIdx, barLeftPct]);

  const tabDays = useMemo(() => {
    if (tab === 'schengen') {
      return visibleDays.map(d => ({ ...d, countries: d.countries.filter(c => SCHENGEN_COUNTRIES.has(c)) }));
    }
    if (tab === 'feie') {
      return visibleDays.map(d => ({ ...d, countries: d.countries.filter(c => c === 'US') }));
    }
    return visibleDays;
  }, [visibleDays, tab]);

  const totalSchengenDays = useMemo(
    () => visibleDays.filter(d => d.countries.some(c => SCHENGEN_COUNTRIES.has(c))).length,
    [visibleDays]
  );

  const countryTotals = useMemo(() => {
    const totals = {};
    for (const { countries } of tabDays)
      for (const c of countries) totals[c] = (totals[c] ?? 0) + 1;
    return totals;
  }, [tabDays]);

  const colorMap = useMemo(() => {
    const sorted = Object.entries(countryTotals).sort((a, b) => b[1] - a[1]);
    const map = {};
    sorted.forEach(([code], i) => { map[code] = PALETTE[i % PALETTE.length]; });
    return map;
  }, [countryTotals]);

  const legendEntries = useMemo(() =>
    Object.entries(countryTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([code, count]) => ({
        code,
        name: countryNames[code] ?? code,
        count,
        color: colorMap[code] ?? PALETTE[0],
      })),
    [countryTotals, colorMap, countryNames]
  );

  const dayColorMap = useMemo(() => {
    const map = {};
    for (const day of tabDays) {
      const primary = day.countries[0];
      map[day.date] = primary ? (colorMap[primary] ?? PALETTE[0]) : '';
    }
    return map;
  }, [tabDays, colorMap]);

  const months = useMemo(() => {
    if (!visibleDays.length) return [];
    const startDate = new Date(visibleDays[0].date + 'T00:00:00Z');
    const endDate = new Date(visibleDays[visibleDays.length - 1].date + 'T00:00:00Z');
    const result = [];
    let year = startDate.getUTCFullYear();
    let month = startDate.getUTCMonth();
    while (
      year < endDate.getUTCFullYear() ||
      (year === endDate.getUTCFullYear() && month <= endDate.getUTCMonth())
    ) {
      const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      const firstDow = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
      const cells = [];
      for (let i = 0; i < firstDow; i++) cells.push(null);
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const inWindow = Object.prototype.hasOwnProperty.call(dayColorMap, dateStr);
        cells.push({ day: d, dateStr, inWindow, color: dayColorMap[dateStr] ?? null });
      }
      result.push({ year, month, cells });
      month++;
      if (month > 11) { month = 0; year++; }
    }
    return result;
  }, [visibleDays, dayColorMap]);

  const totalWorldDays = useMemo(
    () => visibleDays.filter(d => d.countries.length > 0).length,
    [visibleDays]
  );

  const realTodayStr = days[days.length - 1]?.date;
  const evalDateStr = extendedDays[endIdx]?.date;
  const isHistorical = evalDateStr && realTodayStr && evalDateStr !== realTodayStr;

  const feieStats = useMemo(() => {
    const periodWindow = extendedDays.slice(startIdx, endIdx + 1);
    const windowLen = periodWindow.length;
    const outsideDates = periodWindow.filter(d => !d.countries.includes('US')).map(d => d.date);
    const usaCount = windowLen - outsideDates.length;
    const nonUsaCount = outsideDates.length;
    const qualifies = nonUsaCount >= 330;
    const startDateStr = extendedDays[startIdx]?.date;

    let qualifyingDate = null;
    let daysUntilQualifying = 0;

    if (qualifies) {
      const sortedOutside = [...outsideDates].sort();
      qualifyingDate = sortedOutside[329];
      daysUntilQualifying = 0;
    } else {
      const remaining = 330 - nonUsaCount;
      qualifyingDate = addDaysToStr(evalDateStr, remaining);
      daysUntilQualifying = remaining;
    }

    return {
      usaCount, nonUsaCount, qualifies,
      qualifyingDate, daysUntilQualifying,
      windowLen, startDateStr,
    };
  }, [extendedDays, startIdx, endIdx, evalDateStr]);

  const schengenProjection = useMemo(() => {
    const startEval = Math.max(0, endIdx - 179);
    const sWindow = extendedDays.slice(startEval, endIdx + 1);
    const schengenDates = sWindow
      .filter(d => d.countries.some(c => SCHENGEN_COUNTRIES.has(c)))
      .map(d => d.date);
    const count = schengenDates.length;
    if (count === 0) {
      return { count: 0, fullResetDate: null, fullResetDays: 0, earliestReentryDate: null, earliestReentryDays: 0 };
    }
    const sorted = [...schengenDates].sort();
    const fullResetDate = addDaysToStr(sorted[count - 1], 180);
    const fullResetDays = daysBetweenStr(evalDateStr, fullResetDate);
    let earliestReentryDate = null;
    let earliestReentryDays = 0;
    if (count >= 90) {
      const targetDay = sorted[count - 90];
      earliestReentryDate = addDaysToStr(targetDay, 180);
      earliestReentryDays = daysBetweenStr(evalDateStr, earliestReentryDate);
    }
    return { count, fullResetDate, fullResetDays, earliestReentryDate, earliestReentryDays };
  }, [extendedDays, endIdx, evalDateStr]);

  if (showPrint) return <PrintReport data={data} onClose={() => setShowPrint(false)} />;

  return (
    <div className="dashboard">
      <div className="dash-header">
        <div>
          <h2 className="dash-title">Travel Activity</h2>
          <p className="dash-sub">{windowSize} days selected</p>
        </div>
        <div className="dash-actions">
          <button className="collapse-btn" onClick={masterToggle}>
            {allClosed ? 'Expand all' : 'Collapse all'}
          </button>
          <button className="print-report-btn" onClick={() => setShowPrint(true)}>
            Print / Save PDF
          </button>
          <button className="reset-btn" onClick={onReset}>
            <ArrowLeftIcon size={14} /> Upload new file
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab-btn${tab === 'schengen' ? ' active' : ''}`} onClick={() => setTab('schengen')}>
          Schengen
        </button>
        <button className={`tab-btn${tab === 'feie' ? ' active' : ''}`} onClick={() => setTab('feie')}>
          FEIE (US)
        </button>
        <button className={`tab-btn${tab === 'world' ? ' active' : ''}`} onClick={() => setTab('world')}>
          World
        </button>
      </div>

      {/* Status bar — always visible */}
      {tab === 'schengen' && (
        <>
          <StatusBar
            total={totalSchengenDays}
            windowSize={windowSize}
            projection={schengenProjection}
            asOf={evalDateStr}
            isHistorical={isHistorical}
          />
          {schengenProjection.count > 0 && (
            schengenProjection.earliestReentryDate ? (
              <ProjectionCard
                title={`Projected earliest Schengen re-entry${isHistorical ? ` (as of ${formatDate(evalDateStr)})` : ''}`}
                date={schengenProjection.earliestReentryDate}
                daysAway={schengenProjection.earliestReentryDays}
                color="#c42344"
                note={`First date the rolling 180-day window drops back below the 90-day limit, assuming you leave Schengen ${isHistorical ? 'on ' + formatDate(evalDateStr) : 'today'} and don't return.`}
              />
            ) : (
              <ProjectionCard
                title={`Full 90-day Schengen allowance restored${isHistorical ? ` (as of ${formatDate(evalDateStr)})` : ''}`}
                date={schengenProjection.fullResetDate}
                daysAway={schengenProjection.fullResetDays}
                color="#267a42"
                note={`Date the rolling 180-day window contains zero Schengen days again, assuming you leave ${isHistorical ? formatDate(evalDateStr) : 'today'} and don't return.`}
              />
            )
          )}
        </>
      )}
      {tab === 'feie' && (
        <>
          <FeieStatusBar stats={feieStats} asOf={evalDateStr} isHistorical={isHistorical} />
          <ProjectionCard
            title={feieStats.qualifies ? 'FEIE qualified — 330 days reached' : 'Projected FEIE qualification date'}
            date={feieStats.qualifyingDate}
            daysAway={feieStats.qualifies ? null : feieStats.daysUntilQualifying}
            color={feieStats.qualifies ? '#267a42' : '#cc5214'}
            note={`Counting outside-USA days from ${formatDate(feieStats.startDateStr)}. ${
              feieStats.qualifies
                ? `You hit 330 outside-USA days on this date.`
                : `Need ${330 - feieStats.nonUsaCount} more outside-USA days, assuming continuous absence from the USA after ${formatDate(evalDateStr)}.`
            }`}
          />
        </>
      )}
      {tab === 'world' && (
        <div className="status-bar-wrap">
          <div className="status-bar-labels">
            <span style={{ color: 'var(--accent2)' }}>{totalWorldDays} days abroad</span>
            <span className="status-bar-remain">{legendEntries.length} {legendEntries.length === 1 ? 'country' : 'countries'} visited</span>
          </div>
        </div>
      )}


      {/* Slider range — collapsible */}
      <div className="section-wrap">
        <SectionHeader title="Slider Range" open={sectionOpen.dateRange} onToggle={() => toggleSection('dateRange')} />
        {sectionOpen.dateRange && (
          <div className="date-range-wrap">
            <div className="range-preset-row">
              {[30, 90, 180].map(n => (
                <button key={n} className="range-preset-btn" onClick={() => applyPreset(n)}>
                  {n}d
                </button>
              ))}
            </div>
            <div className="bridge-wrap" ref={sliderRef}>
              {/* Big date labels — slide through values as bar scrolls */}
              <div className="bridge-date-label" style={{ left: `${barLeftPct}%` }}>
                <span className={`bridge-md${lockedThumb === 'start' || lockedThumb === 'both' ? ' locked' : ''}`}>
                  {formatBridgeDate(extendedDays[startIdx]?.date).md}
                </span>
                <span className="bridge-yr">
                  {formatBridgeDate(extendedDays[startIdx]?.date).y}
                </span>
              </div>
              <div className="bridge-date-label" style={{ left: `${100 - barLeftPct}%` }}>
                <span className={`bridge-md${lockedThumb === 'end' || lockedThumb === 'both' ? ' locked' : ''}`}>
                  {formatBridgeDate(extendedDays[endIdx]?.date).md}
                </span>
                <span className="bridge-yr">
                  {formatBridgeDate(extendedDays[endIdx]?.date).y}
                </span>
              </div>

              {/* SVG suspension bridge */}
              <svg
                className="bridge-svg"
                viewBox="0 0 1000 150"
                preserveAspectRatio="none"
                width="100%"
                height="150"
              >
                <defs>
                  <filter id="bridge-glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>

                {/* Full-width ruler track */}
                <line x1={0} y1={B_DY} x2={1000} y2={B_DY}
                  stroke="var(--surface2)" strokeWidth={2} />

                {/* Left tower */}
                <line x1={B_LX} y1={B_TY} x2={B_LX} y2={B_DY + 4}
                  stroke="var(--accent)" strokeWidth={5} strokeLinecap="round"
                  filter="url(#bridge-glow)" />
                {/* Right tower */}
                <line x1={B_RX} y1={B_TY} x2={B_RX} y2={B_DY + 4}
                  stroke="var(--accent)" strokeWidth={5} strokeLinecap="round"
                  filter="url(#bridge-glow)" />

                {/* Main suspension cable */}
                <path
                  d={`M ${B_LX},${B_TY} Q ${(B_LX + B_RX) / 2},${B_CY} ${B_RX},${B_TY}`}
                  stroke="var(--accent)" strokeWidth={3} fill="none" opacity={0.85}
                  filter="url(#bridge-glow)"
                />

                {/* Vertical hangers */}
                {bridgeHangers.map(({ x, cy }, i) => (
                  <line key={i} x1={x} y1={cy} x2={x} y2={B_DY}
                    stroke="var(--accent)" strokeWidth={1.5} opacity={0.35} />
                ))}

                {/* Road deck (draggable) */}
                <rect
                  x={B_LX} y={B_DY - 3} width={Math.max(0, B_RX - B_LX)} height={10}
                  rx={5} fill="var(--accent)"
                  className="bridge-deck"
                  onMouseDown={handleBarMouseDown}
                  onTouchStart={handleBarTouchStart}
                  filter="url(#bridge-glow)"
                />

                {/* Tower caps — drag to resize, tap to lock */}
                <circle
                  cx={B_LX} cy={B_TY} r={9}
                  fill={lockedThumb === 'start' || lockedThumb === 'both' ? 'var(--accent)' : 'var(--surface)'}
                  stroke="var(--accent)" strokeWidth={2.5}
                  className="bridge-cap"
                  onMouseDown={(e) => handleTriangleMouseDown('start', e)}
                  onTouchStart={(e) => handleTriangleTouchStart('start', e)}
                  filter={lockedThumb === 'start' || lockedThumb === 'both' ? 'url(#bridge-glow)' : undefined}
                />
                <circle
                  cx={B_RX} cy={B_TY} r={9}
                  fill={lockedThumb === 'end' || lockedThumb === 'both' ? 'var(--accent)' : 'var(--surface)'}
                  stroke="var(--accent)" strokeWidth={2.5}
                  className="bridge-cap"
                  onMouseDown={(e) => handleTriangleMouseDown('end', e)}
                  onTouchStart={(e) => handleTriangleTouchStart('end', e)}
                  filter={lockedThumb === 'end' || lockedThumb === 'both' ? 'url(#bridge-glow)' : undefined}
                />

                {/* Ruler ticks + month labels */}
                {bridgeTicks.map(({ x, label, major }, i) => (
                  <g key={i}>
                    <line
                      x1={x} y1={B_DY + 10} x2={x} y2={B_DY + (major ? 26 : 18)}
                      stroke="var(--text-muted)" strokeWidth={major ? 2 : 1} opacity={0.5}
                    />
                    <text
                      x={x} y={B_DY + (major ? 44 : 36)}
                      textAnchor="middle"
                      style={{
                        fontSize: major ? '12px' : '10px',
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                        fontWeight: major ? 700 : 500,
                        fill: 'var(--text-muted)',
                        opacity: major ? 0.7 : 0.45,
                      }}
                    >
                      {label}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
            <div className="slider-bottom-labels">
              <span>{formatDate(extendedDays[startIdx]?.date)}</span>
              <span className="slider-window-size">{windowSize}d</span>
              <span>{formatDate(extendedDays[endIdx]?.date)}</span>
            </div>
            <div className="range-hint">drag deck to scroll · drag ● to resize · tap ● to lock</div>
          </div>
        )}
      </div>

      {/* Countries — collapsible, compact cards above calendar */}
      {legendEntries.length > 0 && (
        <div className="section-wrap">
          <SectionHeader
            title="Countries"
            open={sectionOpen.countries}
            onToggle={() => toggleSection('countries')}
            note=" — days overlap when multiple countries visited same day"
          />
          {sectionOpen.countries && (
            <div className="breakdown-grid breakdown-compact">
              {legendEntries.map(({ code, name, count, color }) => (
                <div key={code} className="breakdown-card" style={{ borderLeftColor: color }}>
                  <div className="bc-code" style={{ borderColor: color, borderWidth: 2, borderStyle: 'solid' }}>{code}</div>
                  <div className="bc-info">
                    <div className="bc-name">{name}</div>
                    <div className="bc-days" style={{ color }}>{count}d</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Calendar — collapsible */}
      <div className="section-wrap">
        <SectionHeader title="Calendar" open={sectionOpen.calendar} onToggle={() => toggleSection('calendar')} />
        {sectionOpen.calendar && (
          <div className="cal-wrap">
            {months.map(({ year, month, cells }) => (
              <div key={`${year}-${month}`} className="month-block">
                <div className="month-header">{MONTH_NAMES[month]} {year}</div>
                <div className="month-dow">{DOW.map(d => <span key={d}>{d}</span>)}</div>
                <div className="month-grid">
                  {cells.map((cell, i) =>
                    cell === null ? (
                      <div key={i} className="cal-empty" />
                    ) : (
                      <div
                        key={cell.dateStr}
                        className={`cal-day${cell.color ? ' active' : cell.inWindow ? ' in-window' : ' out-window'}`}
                        style={cell.color ? { background: cell.color } : {}}
                        title={formatDate(cell.dateStr)}
                      >
                        {cell.day}
                      </div>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {legendEntries.length === 0 && (
        <div className="no-data">
          No {tab === 'schengen' ? 'Schengen Area' : tab === 'feie' ? 'USA' : 'international'} visits detected in the selected period.
          <br />
          <small>Adjust the date range or check that your Timeline JSON contains GPS path data.</small>
        </div>
      )}
    </div>
  );
}
