import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
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
const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
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

function PhysicsTimeline({ startIdx, endIdx, extendedDays, sliderMax, onStartChange, onEndChange, overallPressure }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);

  // Bars are day-offsets from the view center (pos).
  // Spinning changes pos but NOT lbOff/rbOff → bars stay on screen always.
  const phRef = useRef(null);
  if (phRef.current === null) {
    const center = (startIdx + endIdx) / 2;
    phRef.current = {
      pos: center,               // date index at canvas center (float)
      posVel: 0,
      lbOff: startIdx - center,  // left bar offset from pos in days (≤ 0)
      rbOff: endIdx   - center,  // right bar offset from pos in days (≥ 0)
      lbVel: 0,
      rbVel: 0,
      dragTarget: null,          // 'spin' | 'left' | 'right'
      dragStartX: 0,
      dragStartPos: 0,
      dragStartLb: 0,
      dragStartRb: 0,
      lastX: 0,
      lastT: 0,
      lastVelPx: 0,
      dragPxDay: 1,
      lastStart: startIdx,
      lastEnd:   endIdx,
    };
  }

  const lockRef    = useRef({ left: false, right: true });
  const cbRef      = useRef({ onStartChange, onEndChange });
  const pressureRef = useRef(overallPressure);
  const colRef     = useRef({ ar: 79, ag: 140, ab: 255 });

  useEffect(() => { cbRef.current = { onStartChange, onEndChange }; }, [onStartChange, onEndChange]);
  useEffect(() => { pressureRef.current = overallPressure; }, [overallPressure]);

  // Sync when preset fires a large jump from outside
  useEffect(() => {
    const ph = phRef.current;
    const curStart = Math.round(ph.pos + ph.lbOff);
    const curEnd   = Math.round(ph.pos + ph.rbOff);
    if (Math.abs(curStart - startIdx) > 3 || Math.abs(curEnd - endIdx) > 3) {
      const center  = (startIdx + endIdx) / 2;
      ph.pos    = center;
      ph.lbOff  = startIdx - center;
      ph.rbOff  = endIdx   - center;
      ph.posVel = ph.lbVel = ph.rbVel = 0;
    }
  }, [startIdx, endIdx]);

  useEffect(() => {
    try {
      const v = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
      if (/^#[0-9a-f]{6}/i.test(v)) {
        colRef.current = { ar: parseInt(v.slice(1,3),16), ag: parseInt(v.slice(3,5),16), ab: parseInt(v.slice(5,7),16) };
      }
    } catch {}
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const H_CSS = 170;
    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const w = wrap.getBoundingClientRect().width;
      canvas.width  = Math.round(w * dpr);
      canvas.height = Math.round(H_CSS * dpr);
      canvas.style.width  = `${w}px`;
      canvas.style.height = `${H_CSS}px`;
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    let rafId;
    let lastTime = performance.now();
    const MIN_GAP_DAYS = 1;

    const colorStops = [
      { r: 38,  g: 122, b: 66 },
      { r: 180, g: 111, b: 9  },
      { r: 196, g: 35,  b: 68 },
    ];
    function lerpCol(t) {
      const n = colorStops.length - 1;
      const seg = t * n;
      const i = Math.min(Math.floor(seg), n - 1);
      const f = seg - i;
      const a = colorStops[i], b = colorStops[i + 1];
      return [Math.round(a.r+(b.r-a.r)*f), Math.round(a.g+(b.g-a.g)*f), Math.round(a.b+(b.b-a.b)*f)];
    }

    function loop(now) {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      const ph  = phRef.current;
      const lk  = lockRef.current;
      const dpr = window.devicePixelRatio || 1;
      const { ar, ag, ab } = colRef.current;
      // Slow 2-second pulse for over-limit ticks (0 → 1 → 0)
      const pulse = 0.5 + 0.5 * Math.sin(now / 1000 * Math.PI);

      // Spin physics
      if (ph.dragTarget !== 'spin') {
        ph.posVel *= Math.exp(-6 * dt);
        ph.posVel += (Math.round(ph.pos) - ph.pos) * 160 * dt;
        ph.pos += ph.posVel * dt;
      }

      // Bar spring physics — snap each to nearest integer day offset
      if (ph.dragTarget !== 'left') {
        ph.lbVel *= Math.exp(-7 * dt);
        ph.lbVel += (Math.round(ph.lbOff) - ph.lbOff) * 220 * dt;
        ph.lbOff += ph.lbVel * dt;
      }
      if (ph.dragTarget !== 'right') {
        ph.rbVel *= Math.exp(-7 * dt);
        ph.rbVel += (Math.round(ph.rbOff) - ph.rbOff) * 220 * dt;
        ph.rbOff += ph.rbVel * dt;
      }

      // Elastic bounce when bars collide
      if (ph.rbOff - ph.lbOff < MIN_GAP_DAYS) {
        const mid = (ph.lbOff + ph.rbOff) / 2;
        ph.lbOff = mid - MIN_GAP_DAYS / 2;
        ph.rbOff = mid + MIN_GAP_DAYS / 2;
        // Equal-mass elastic collision (e=0.85)
        const vl = ph.lbVel, vr = ph.rbVel;
        ph.lbVel = vl * 0.075 + vr * 0.925;
        ph.rbVel = vr * 0.075 + vl * 0.925;
        // Additional push-apart impulse so they don't stick
        ph.lbVel -= 2; ph.rbVel += 2;
      }

      // Clamp pos so startIdx ≥ 0 and endIdx ≤ sliderMax
      ph.pos = Math.max(-ph.lbOff, Math.min(sliderMax - ph.rbOff, ph.pos));

      // Notify parent when rounded values change
      const ns = Math.round(ph.pos + ph.lbOff);
      const ne = Math.round(ph.pos + ph.rbOff);
      if ((ns !== ph.lastStart || ne !== ph.lastEnd) && ns < ne && ns >= 0 && ne <= sliderMax) {
        ph.lastStart = ns; ph.lastEnd = ne;
        cbRef.current.onStartChange(ns);
        cbRef.current.onEndChange(ne);
      }

      // ── Draw ──
      const ctx = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      const centerX = W / 2;
      const baseline = H * 0.55;
      // Dynamic scale: bars always span ~80% of canvas regardless of window size.
      // W is in physical pixels (already includes dpr).
      const windowDays = Math.max(2, ph.rbOff - ph.lbOff);
      const pxDay = (W * 0.80) / windowDays;

      const lbX = centerX + ph.lbOff * pxDay;
      const rbX = centerX + ph.rbOff * pxDay;

      // Faint baseline
      ctx.strokeStyle = `rgba(${ar},${ag},${ab},0.1)`;
      ctx.lineWidth = dpr;
      ctx.beginPath(); ctx.moveTo(0, baseline); ctx.lineTo(W, baseline); ctx.stroke();

      // Window band
      if (lbX < rbX) {
        ctx.fillStyle = `rgba(${ar},${ag},${ab},0.07)`;
        ctx.fillRect(lbX, 0, rbX - lbX, baseline);
      }

      // Uniform tick color based on overall Schengen pressure for the window
      const p = pressureRef.current;
      let tr, tg, tb, pulseAlphaScale = 1;
      if (p > 1) {
        // Over the 90-day limit — all ticks pulse red
        tr = 196; tg = 35; tb = 68;
        pulseAlphaScale = 0.3 + 0.7 * pulse;
      } else if (p > 0.05) {
        [tr, tg, tb] = lerpCol(p); // green → amber → red gradient
      } else {
        tr = ar; tg = ag; tb = ab; // accent (default blue)
      }

      const visRange = Math.min(Math.ceil(W / pxDay) + 4, 800);
      const d0 = Math.floor(ph.pos - visRange / 2);
      const d1 = Math.ceil(ph.pos + visRange / 2);

      for (let day = d0; day <= d1; day++) {
        if (day < 0 || day >= extendedDays.length) continue;
        const x  = centerX + (day - ph.pos) * pxDay;
        const ds = extendedDays[day].date;
        const mo = parseInt(ds.slice(5, 7));
        const d  = parseInt(ds.slice(8, 10));
        const isMonth = d === 1;
        const isYear  = isMonth && mo === 1;
        const isWeek  = d % 7 === 1;

        // Magnetic stretch: peaks at each bar
        const magRadius = Math.max(40, (rbX - lbX) * 0.45);
        const minDist = Math.min(Math.abs(x - lbX), Math.abs(x - rbX));
        const t   = Math.max(0, 1 - minDist / magRadius);
        const mag = t * t * t;

        const baseH = isYear ? 32 : isMonth ? 18 : isWeek ? 7 : 3;
        const tickH = (baseH + mag * 65) * dpr;
        const alpha = (isMonth ? 0.22 + mag * 0.78 : 0.07 + mag * 0.55) * pulseAlphaScale;
        const lw    = (p > 1 ? (isYear ? 3 : isMonth ? 2.2 : 1.1) : (isYear ? 2.5 : isMonth ? 1.8 : 0.8)) * dpr;

        ctx.strokeStyle = `rgba(${tr},${tg},${tb},${alpha})`;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(x, baseline);
        ctx.lineTo(x, baseline - tickH);
        ctx.stroke();

        if (isMonth && tickH > 12 * dpr) {
          const ta = Math.min(1, (tickH / dpr - 8) / 16) * (0.3 + mag * 0.7) * pulseAlphaScale;
          if (ta > 0.05) {
            ctx.fillStyle = `rgba(${tr},${tg},${tb},${ta})`;
            ctx.font = `${isYear ? '700' : '500'} ${(isYear ? 12 : 10) * dpr}px system-ui,sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(isYear ? ds.slice(0,4) : MONTH_ABBR[mo-1], x, baseline + 5*dpr);
          }
        }
      }

      // Draw vertical bar + LOCK/FREE label
      function drawBar(bx, isLocked) {
        const br = isLocked ? 255 : ar;
        const bg = isLocked ? 180 : ag;
        const bb = isLocked ? 50  : ab;
        ctx.strokeStyle = `rgba(${br},${bg},${bb},0.9)`;
        ctx.lineWidth = 2.5 * dpr;
        ctx.beginPath(); ctx.moveTo(bx, 0); ctx.lineTo(bx, baseline); ctx.stroke();
        ctx.fillStyle = `rgba(${br},${bg},${bb},1)`;
        ctx.beginPath(); ctx.arc(bx, baseline, 5 * dpr, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(${br},${bg},${bb},0.55)`;
        ctx.font = `700 ${8 * dpr}px system-ui,sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(isLocked ? 'LOCK' : 'FREE', bx, baseline + 10 * dpr);
      }

      drawBar(lbX, lk.left);
      drawBar(rbX, lk.right);

      rafId = requestAnimationFrame(loop);
    }

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [extendedDays, sliderMax]);

  const handlePointerDown = useCallback((e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    const ph  = phRef.current;
    const lk  = lockRef.current;

    const rect   = canvas.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) * dpr; // canvas physical px
    const W      = canvas.width;
    // Same dynamic scale as RAF loop
    const pxDay  = (W * 0.80) / Math.max(2, ph.rbOff - ph.lbOff);
    const lbX    = W / 2 + ph.lbOff * pxDay;
    const rbX    = W / 2 + ph.rbOff * pxDay;

    const dL  = Math.abs(clickX - lbX);
    const dR  = Math.abs(clickX - rbX);
    const HIT = 28 * dpr; // slightly generous hit zone

    let target = 'spin';
    if (dL < HIT && dL <= dR) target = 'left';
    else if (dR < HIT)         target = 'right';

    ph.dragTarget   = target;
    ph.dragStartX   = e.clientX;
    ph.dragStartPos = ph.pos;
    ph.dragStartLb  = ph.lbOff;
    ph.dragStartRb  = ph.rbOff;
    ph.dragPxDay    = pxDay; // capture scale at drag start
    ph.lastX   = e.clientX;
    ph.lastT   = performance.now();
    ph.lastVelPx = 0;
    if (target === 'spin')  ph.posVel = 0;
    if (target === 'left')  ph.lbVel  = 0;
    if (target === 'right') ph.rbVel  = 0;

    let dragged = false;

    const onMove = (ev) => {
      if (Math.abs(ev.clientX - ph.dragStartX) > 3) dragged = true;
      if (!dragged) return;
      const x      = ev.clientX;
      const now    = performance.now();
      const moveDt = Math.max(0.001, (now - ph.lastT) / 1000);
      // velocity in canvas physical px/s
      ph.lastVelPx = (x - ph.lastX) * dpr / moveDt;
      const dx_days = (x - ph.dragStartX) * dpr / ph.dragPxDay; // CSS px → days

      if (target === 'spin') {
        ph.pos = ph.dragStartPos - dx_days;
      } else if (target === 'left' && !lk.left) {
        ph.lbOff = Math.min(ph.dragStartLb + dx_days, ph.rbOff - 1);
      } else if (target === 'right' && !lk.right) {
        ph.rbOff = Math.max(ph.dragStartRb + dx_days, ph.lbOff + 1);
      }

      ph.lastX = x; ph.lastT = now;
    };

    const onUp = () => {
      if (!dragged) {
        if (target === 'left')  lockRef.current = { ...lockRef.current, left:  !lockRef.current.left  };
        if (target === 'right') lockRef.current = { ...lockRef.current, right: !lockRef.current.right };
      } else {
        const velDays = ph.lastVelPx / ph.dragPxDay; // days/s
        if (target === 'spin')                       ph.posVel = -velDays * 0.6;
        if (target === 'left'  && !lk.left)          ph.lbVel  =  velDays * 0.35;
        if (target === 'right' && !lk.right)         ph.rbVel  =  velDays * 0.35;
      }
      ph.dragTarget = null;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }, [sliderMax]);

  return (
    <div ref={wrapRef} className="physics-timeline-wrap">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        style={{ touchAction: 'none', cursor: 'grab', display: 'block' }}
      />
    </div>
  );
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

  function applyPreset(n) {
    const ns = Math.max(0, endIdx - n + 1);
    setStartIdx(ns);
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
  const todayIdx = days.length - 1;
  const windowSize = endIdx - startIdx + 1;

  // Single pressure value for the whole timeline: count in rolling 180-day window / 90
  // >1 means over the limit
  const overallPressure = schengenProjection.count / 90;

  const handleStartChange = useCallback((newIdx) => { setStartIdx(newIdx); }, []);
  const handleEndChange   = useCallback((newIdx) => { setEndIdx(newIdx); }, []);

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
            {/* Date endpoints */}
            <div className="timeline-date-row">
              <div className="timeline-date-block">
                <span className="bridge-md">{formatBridgeDate(extendedDays[startIdx]?.date).md}</span>
                <span className="bridge-yr">{formatBridgeDate(extendedDays[startIdx]?.date).y}</span>
              </div>
              <span className="slider-window-size">{windowSize}d</span>
              <div className="timeline-date-block timeline-date-right">
                <span className="bridge-md">{formatBridgeDate(extendedDays[endIdx]?.date).md}</span>
                <span className="bridge-yr">{formatBridgeDate(extendedDays[endIdx]?.date).y}</span>
              </div>
            </div>
            {/* Physics spinnable timeline */}
            <PhysicsTimeline
              startIdx={startIdx}
              endIdx={endIdx}
              extendedDays={extendedDays}
              sliderMax={sliderMax}
              onStartChange={handleStartChange}
              onEndChange={handleEndChange}
              overallPressure={overallPressure}
            />
            <div className="range-hint">spin to scroll · presets change range width</div>
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
