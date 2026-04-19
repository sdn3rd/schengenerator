import { useState, useMemo } from 'react';
import { ArrowLeftIcon } from './icons';
import './Dashboard.css';

const COUNTRY_NAMES = {
  AT: 'Austria', BE: 'Belgium', CZ: 'Czech Republic', DK: 'Denmark',
  EE: 'Estonia', FI: 'Finland', FR: 'France', DE: 'Germany',
  GR: 'Greece', HU: 'Hungary', IS: 'Iceland', IT: 'Italy',
  LV: 'Latvia', LI: 'Liechtenstein', LT: 'Lithuania', LU: 'Luxembourg',
  MT: 'Malta', NL: 'Netherlands', NO: 'Norway', PL: 'Poland',
  PT: 'Portugal', SK: 'Slovakia', SI: 'Slovenia', ES: 'Spain',
  SE: 'Sweden', CH: 'Switzerland',
};

const PALETTE = [
  '#7a1500', '#a02000', '#c23000', '#c84a00',
  '#d85a00', '#e06000', '#e87820', '#f07820',
  '#c87030', '#a05820',
];

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DOW = ['Mo','Tu','We','Th','Fr','Sa','Su'];

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function StatusBar({ total, windowSize }) {
  const pct = Math.min((total / 90) * 100, 100);
  const color = total >= 90 ? '#7a1500' : total >= 75 ? '#c84a00' : '#888888';
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

export default function Dashboard({ data, onReset }) {
  const { days } = data;

  const defaultStart = Math.max(0, days.length - 180);
  const [startIdx, setStartIdx] = useState(defaultStart);
  const [endIdx, setEndIdx] = useState(days.length - 1);

  const visibleDays = useMemo(
    () => days.slice(startIdx, endIdx + 1),
    [days, startIdx, endIdx]
  );

  const windowSize = endIdx - startIdx + 1;

  const countryTotals = useMemo(() => {
    const totals = {};
    for (const { countries } of visibleDays) {
      for (const c of countries) totals[c] = (totals[c] ?? 0) + 1;
    }
    return totals;
  }, [visibleDays]);

  const colorMap = useMemo(() => {
    const sorted = Object.entries(countryTotals).sort((a, b) => b[1] - a[1]);
    const map = {};
    sorted.forEach(([code], i) => { map[code] = PALETTE[i % PALETTE.length]; });
    return map;
  }, [countryTotals]);

  const totalSchengenDays = useMemo(
    () => visibleDays.filter(d => d.countries.length > 0).length,
    [visibleDays]
  );

  const legendEntries = useMemo(
    () =>
      Object.entries(countryTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([code, count]) => ({
          code,
          name: COUNTRY_NAMES[code] ?? code,
          count,
          color: colorMap[code] ?? '#c84a00',
        })),
    [countryTotals, colorMap]
  );

  // Build per-day color lookup for the calendar
  const dayColorMap = useMemo(() => {
    const map = {};
    for (const day of visibleDays) {
      const primary = day.countries[0];
      map[day.date] = primary ? (colorMap[primary] ?? '#c84a00') : '';
    }
    return map;
  }, [visibleDays, colorMap]);

  // Group into calendar months
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
        const color = dayColorMap[dateStr] ?? null;
        cells.push({ day: d, dateStr, inWindow, color });
      }

      result.push({ year, month, cells });
      month++;
      if (month > 11) { month = 0; year++; }
    }
    return result;
  }, [visibleDays, dayColorMap]);

  const sliderMax = days.length - 1;
  const pctOf = (idx) => `${(idx / sliderMax) * 100}%`;

  const handleStartChange = (e) => {
    const v = Number(e.target.value);
    setStartIdx(Math.min(v, endIdx - 29));
  };
  const handleEndChange = (e) => {
    const v = Number(e.target.value);
    setEndIdx(Math.max(v, startIdx + 29));
  };

  return (
    <div className="dashboard">
      <div className="dash-header">
        <div>
          <h2 className="dash-title">Schengen Activity</h2>
          <p className="dash-sub">
            {formatDate(visibleDays[0]?.date)} — {formatDate(visibleDays[visibleDays.length - 1]?.date)}
            {' '}· {windowSize} days
          </p>
        </div>
        <button className="reset-btn" onClick={onReset}>
          <ArrowLeftIcon size={14} /> Upload new file
        </button>
      </div>

      {/* Date range slider */}
      <div className="date-range-wrap">
        <div className="date-range-labels">
          <span>{formatDate(days[startIdx]?.date)}</span>
          <span>{formatDate(days[endIdx]?.date)}</span>
        </div>
        <div className="dual-slider">
          <div className="dual-slider-track" />
          <div
            className="dual-slider-fill"
            style={{ left: pctOf(startIdx), right: `${100 - (endIdx / sliderMax) * 100}%` }}
          />
          <input
            type="range" min={0} max={sliderMax} value={startIdx}
            onChange={handleStartChange}
            className="slider-thumb"
          />
          <input
            type="range" min={0} max={sliderMax} value={endIdx}
            onChange={handleEndChange}
            className="slider-thumb"
          />
        </div>
      </div>

      <StatusBar total={totalSchengenDays} windowSize={windowSize} />

      {legendEntries.length > 0 && (
        <div className="legend">
          {legendEntries.map(({ code, name, count, color }) => (
            <div key={code} className="legend-item">
              <span className="legend-swatch" style={{ background: color }} />
              <span className="legend-name">{name}</span>
              <span className="legend-count">{count}d</span>
            </div>
          ))}
        </div>
      )}

      {/* Month-by-month calendar */}
      <div className="cal-wrap">
        {months.map(({ year, month, cells }) => (
          <div key={`${year}-${month}`} className="month-block">
            <div className="month-header">{MONTH_NAMES[month]} {year}</div>
            <div className="month-dow">
              {DOW.map(d => <span key={d}>{d}</span>)}
            </div>
            <div className="month-grid">
              {cells.map((cell, i) =>
                cell === null ? (
                  <div key={i} className="cal-empty" />
                ) : (
                  <div
                    key={cell.dateStr}
                    className={`cal-day${cell.color ? ' active' : cell.inWindow ? ' in-window' : ' out-window'}`}
                    style={cell.color ? { background: cell.color } : {}}
                    title={`${formatDate(cell.dateStr)}${cell.color ? ': Schengen' : ''}`}
                  >
                    {cell.day}
                  </div>
                )
              )}
            </div>
          </div>
        ))}
      </div>

      {legendEntries.length > 0 && (
        <div className="breakdown">
          <h3 className="breakdown-title">
            Country Breakdown
            <span className="breakdown-note"> — days overlap when multiple countries visited same day</span>
          </h3>
          <div className="breakdown-grid">
            {legendEntries.map(({ code, name, count, color }) => (
              <div key={code} className="breakdown-card" style={{ borderLeftColor: color }}>
                <div className="bc-code" style={{ borderColor: color, borderWidth: 2, borderStyle: 'solid' }}>
                  {code}
                </div>
                <div className="bc-info">
                  <div className="bc-name">{name}</div>
                  <div className="bc-days" style={{ color }}>{count} day{count !== 1 ? 's' : ''}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {legendEntries.length === 0 && (
        <div className="no-data">
          No Schengen Area visits detected in the selected period.
          <br />
          <small>
            Country detection uses GPS bounding boxes. Overflight and border-area GPS drift
            may create false matches — adjust the date range to investigate.
          </small>
        </div>
      )}
    </div>
  );
}
