import { useState, useMemo } from 'react';
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

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function StatusBar({ total, windowSize }) {
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
    </div>
  );
}

function FeieStatusBar({ stats }) {
  const { usaCount, nonUsaCount, qualifies, eligibilityDate, daysUntilEligible } = stats;
  const pct = Math.min((usaCount / 35) * 100, 100);
  const color = qualifies
    ? '#267a42'
    : usaCount <= 50
    ? '#cc5214'
    : '#c42344';
  return (
    <div className="status-bar-wrap feie-bar">
      <div className="status-bar-track">
        <div className="status-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="status-bar-labels">
        <span style={{ color }}>{usaCount} / 35 US days used (last 365)</span>
        <span className="status-bar-remain" style={{ color }}>
          {qualifies
            ? 'Qualifies for FEIE ✓'
            : eligibilityDate
            ? `Eligible ${formatDate(eligibilityDate)} (${daysUntilEligible}d)`
            : 'Does not qualify'}
        </span>
      </div>
      <div className="feie-sub">
        <strong>FEIE Physical Presence Test:</strong> need 330+ days outside the USA in any
        365-day window. Currently <strong>{nonUsaCount}</strong> day{nonUsaCount === 1 ? '' : 's'} outside.
        {!qualifies && eligibilityDate && (
          <> Assuming no further US travel, you qualify on <strong>{formatDate(eligibilityDate)}</strong>.</>
        )}
      </div>
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
    () => days.slice(startIdx, endIdx + 1),
    [days, startIdx, endIdx]
  );
  const windowSize = endIdx - startIdx + 1;

  const tabDays = useMemo(() =>
    tab === 'schengen'
      ? visibleDays.map(d => ({ ...d, countries: d.countries.filter(c => SCHENGEN_COUNTRIES.has(c)) }))
      : visibleDays,
    [visibleDays, tab]
  );

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

  const sliderMax = days.length - 1;
  const pctOf = idx => `${(idx / sliderMax) * 100}%`;
  const handleStartChange = e => setStartIdx(Math.min(Number(e.target.value), endIdx - 29));
  const handleEndChange = e => setEndIdx(Math.max(Number(e.target.value), startIdx + 29));

  const totalWorldDays = useMemo(
    () => visibleDays.filter(d => d.countries.length > 0).length,
    [visibleDays]
  );

  const feieStats = useMemo(() => {
    const last365 = days.slice(-365);
    const usaDates = last365.filter(d => d.countries.includes('US')).map(d => d.date);
    const usaCount = usaDates.length;
    const nonUsaCount = 365 - usaCount;
    const qualifies = usaCount <= 35;

    let eligibilityDate = null;
    let daysUntilEligible = 0;

    if (!qualifies) {
      const sorted = [...usaDates].sort();
      const targetDay = sorted[usaCount - 36];
      const [y, m, d] = targetDay.split('-').map(Number);
      const dateObj = new Date(Date.UTC(y, m - 1, d));
      dateObj.setUTCDate(dateObj.getUTCDate() + 365);
      eligibilityDate = `${dateObj.getUTCFullYear()}-${String(dateObj.getUTCMonth() + 1).padStart(2, '0')}-${String(dateObj.getUTCDate()).padStart(2, '0')}`;

      const todayStr = days[days.length - 1]?.date;
      if (todayStr) {
        const [ty, tm, td] = todayStr.split('-').map(Number);
        const todayObj = new Date(Date.UTC(ty, tm - 1, td));
        daysUntilEligible = Math.max(0, Math.round((dateObj - todayObj) / 86400000));
      }
    }

    return { usaCount, nonUsaCount, qualifies, eligibilityDate, daysUntilEligible };
  }, [days]);

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
        <button className={`tab-btn${tab === 'world' ? ' active' : ''}`} onClick={() => setTab('world')}>
          World
        </button>
      </div>

      {/* Status bar — always visible */}
      {tab === 'schengen' && <StatusBar total={totalSchengenDays} windowSize={windowSize} />}
      {tab === 'world' && (
        <div className="status-bar-wrap">
          <div className="status-bar-labels">
            <span style={{ color: 'var(--accent2)' }}>{totalWorldDays} days abroad</span>
            <span className="status-bar-remain">{legendEntries.length} {legendEntries.length === 1 ? 'country' : 'countries'} visited</span>
          </div>
        </div>
      )}

      <FeieStatusBar stats={feieStats} />


      {/* Date range — collapsible */}
      <div className="section-wrap">
        <SectionHeader title="Date Range" open={sectionOpen.dateRange} onToggle={() => toggleSection('dateRange')} />
        {sectionOpen.dateRange && (
          <div className="date-range-wrap">
            <div className="date-range-labels">
              <span>{formatDate(days[startIdx]?.date)}</span>
              <span>{formatDate(days[endIdx]?.date)}</span>
            </div>
            <div className="dual-slider">
              <div className="dual-slider-track" />
              <div className="dual-slider-fill" style={{ left: pctOf(startIdx), right: `${100 - (endIdx / sliderMax) * 100}%` }} />
              <input type="range" min={0} max={sliderMax} value={startIdx} onChange={handleStartChange} className="slider-thumb" />
              <input type="range" min={0} max={sliderMax} value={endIdx} onChange={handleEndChange} className="slider-thumb" />
            </div>
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
          No {tab === 'schengen' ? 'Schengen Area' : 'international'} visits detected in the selected period.
          <br />
          <small>Adjust the date range or check that your Timeline JSON contains GPS path data.</small>
        </div>
      )}
    </div>
  );
}
