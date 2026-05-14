import './PrintReport.css';

const SCHENGEN_COUNTRIES = new Set([
  'AT','BE','CZ','DK','EE','FI','FR','DE','GR','HU',
  'IS','IT','LV','LI','LT','LU','MT','NL','NO','PL',
  'PT','SK','SI','ES','SE','CH',
]);

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function Seal() {
  return (
    <svg className="report-seal" viewBox="0 0 140 140" width="140" height="140" aria-hidden="true">
      <circle cx="70" cy="70" r="66" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="70" cy="70" r="59" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="5 3.5" />
      {/* compass points */}
      <polygon points="70,18 73.5,62 70,66 66.5,62" fill="currentColor" />
      <polygon points="70,122 73.5,78 70,74 66.5,78" fill="currentColor" />
      <polygon points="18,70 62,73.5 66,70 62,66.5" fill="currentColor" />
      <polygon points="122,70 78,73.5 74,70 78,66.5" fill="currentColor" />
      {/* diagonal points */}
      <polygon points="35,35 58,57 56,61 52,58" fill="currentColor" opacity="0.65" />
      <polygon points="105,105 82,83 84,79 88,82" fill="currentColor" opacity="0.65" />
      <polygon points="105,35 83,58 79,56 82,52" fill="currentColor" opacity="0.65" />
      <polygon points="35,105 57,82 61,84 58,88" fill="currentColor" opacity="0.65" />
      {/* center */}
      <circle cx="70" cy="70" r="9" fill="currentColor" />
      <circle cx="70" cy="70" r="5" fill="white" />
      {/* arc text top */}
      <path id="sealTop" d="M 14,70 A 56,56 0 0,1 126,70" fill="none" />
      <text fontSize="9.5" fontWeight="700" fill="currentColor" letterSpacing="2.5">
        <textPath href="#sealTop" startOffset="8%">SCHENGEN TRAVEL RECORD</textPath>
      </text>
      {/* arc text bottom */}
      <path id="sealBot" d="M 17,76 A 56,56 0 0,0 123,76" fill="none" />
      <text fontSize="8.5" fontWeight="600" fill="currentColor" letterSpacing="1.8">
        <textPath href="#sealBot" startOffset="14%">SCHENGENERATOR.APP</textPath>
      </text>
    </svg>
  );
}

export default function PrintReport({ data, onClose }) {
  const { days, countryNames = {}, locations = {} } = data;

  const last180 = days.slice(-180);
  const countryTotals = {};
  for (const { countries } of last180)
    for (const c of countries)
      if (SCHENGEN_COUNTRIES.has(c)) countryTotals[c] = (countryTotals[c] ?? 0) + 1;

  const total = last180.filter(d => d.countries.some(c => SCHENGEN_COUNTRIES.has(c))).length;
  const sortedCountries = Object.entries(countryTotals).sort((a, b) => b[1] - a[1]);

  const allSchengenDays = days.filter(d => d.countries.some(c => SCHENGEN_COUNTRIES.has(c)));

  const generatedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const pct = Math.min((total / 90) * 100, 100);
  const statusColor = total >= 90 ? '#c0392b' : total >= 75 ? '#cc5214' : '#267a42';

  return (
    <div className="print-overlay">
      <div className="print-toolbar no-print">
        <button className="print-action-btn primary" onClick={() => window.print()}>
          Print / Save PDF
        </button>
        <button className="print-action-btn" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="print-document">
        {/* Header */}
        <div className="report-header">
          <Seal />
          <div className="report-title-block">
            <h1 className="report-title">Schengen Area Travel Record</h1>
            <p className="report-meta">Generated: {generatedDate}</p>
            <p className="report-meta">Source: Google Maps Timeline (user export)</p>
          </div>
        </div>

        <hr className="report-rule" />

        {/* Summary */}
        <section className="report-section">
          <h2 className="report-section-title">Summary — Last 180 Days</h2>
          <div className="report-summary-row">
            <div className="report-day-count" style={{ color: statusColor }}>
              <span className="report-num">{total}</span>
              <span className="report-denom"> / 90 days</span>
            </div>
            <div className="report-progress-wrap">
              <div className="report-progress-track">
                <div className="report-progress-fill" style={{ width: `${pct}%`, background: statusColor }} />
              </div>
              <p className="report-progress-label" style={{ color: statusColor }}>
                {total >= 90 ? 'Limit reached' : total >= 75 ? `${90 - total} days remaining — caution` : `${90 - total} days remaining`}
              </p>
            </div>
          </div>

          {sortedCountries.length > 0 && (
            <table className="report-table">
              <thead>
                <tr><th>Country</th><th>Days in period</th></tr>
              </thead>
              <tbody>
                {sortedCountries.map(([code, count]) => (
                  <tr key={code}>
                    <td>{countryNames[code] ?? code} <span className="report-code">({code})</span></td>
                    <td>{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <hr className="report-rule" />

        {/* Travel log */}
        <section className="report-section">
          <h2 className="report-section-title">
            Schengen Entry Log
            <span className="report-section-note"> — all dates in dataset with confirmed Schengen GPS activity</span>
          </h2>

          {allSchengenDays.length === 0 ? (
            <p className="report-empty">No Schengen days found in dataset.</p>
          ) : (
            <table className="report-table report-log">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Country</th>
                  <th>Location (from Google Maps)</th>
                </tr>
              </thead>
              <tbody>
                {allSchengenDays.map(({ date, countries }) => {
                  const schengen = countries.filter(c => SCHENGEN_COUNTRIES.has(c));
                  const locs = locations[date] ?? [];
                  return (
                    <tr key={date}>
                      <td className="report-date-cell">{formatDate(date)}</td>
                      <td>{schengen.map(c => countryNames[c] ?? c).join(' / ')}</td>
                      <td className="report-loc-cell">{locs.length > 0 ? locs.join(', ') : <span className="report-no-loc">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <hr className="report-rule" />

        {/* Disclaimer */}
        <div className="report-disclaimer">
          <strong>Data Disclaimer:</strong> All GPS location data in this report was exported directly
          from <strong>Google Maps Timeline</strong> by the user and is attributed to Google, not to
          Schengenerator.app. Country determinations are made by matching GPS coordinates against
          published country boundary polygons. This document is generated for personal reference only
          and is not an official government or legal record. Schengenerator.app makes no warranty
          as to the accuracy or completeness of this data.
        </div>
      </div>
    </div>
  );
}
