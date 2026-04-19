import BORDERS from './world-borders.json' assert { type: 'json' };

export const SCHENGEN_COUNTRIES = new Set([
  'AT', 'BE', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU',
  'IS', 'IT', 'LV', 'LI', 'LT', 'LU', 'MT', 'NL', 'NO', 'PL',
  'PT', 'SK', 'SI', 'ES', 'SE', 'CH',
]);

// Build country names map from the bundled borders data.
export const COUNTRY_NAMES = Object.fromEntries(
  BORDERS.features.map(f => [f.properties.code, f.properties.name])
);

// Ray-casting point-in-polygon for a single ring.
function pointInRing(lat, lon, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInPolygon(lat, lon, rings) {
  if (!pointInRing(lat, lon, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) {
    if (pointInRing(lat, lon, rings[i])) return false;
  }
  return true;
}

function ringBbox(ring) {
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const [lon, lat] of ring) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
  }
  return [minLat, maxLat, minLon, maxLon];
}

const FEATURES = BORDERS.features.flatMap(f => {
  const { code } = f.properties;
  const { type, coordinates } = f.geometry;
  const toEntry = rings => ({ code, rings, bbox: ringBbox(rings[0]) });
  if (type === 'Polygon') return [toEntry(coordinates)];
  if (type === 'MultiPolygon') return coordinates.map(toEntry);
  return [];
});

export function coordToCountry(lat, lon) {
  for (const { code, rings, bbox } of FEATURES) {
    if (lat < bbox[0] || lat > bbox[1] || lon < bbox[2] || lon > bbox[3]) continue;
    if (pointInPolygon(lat, lon, rings)) return code;
  }
  return null;
}

function parseLatLng(str) {
  if (!str) return [NaN, NaN];
  const parts = str.split(',');
  return [parseFloat(parts[0]), parseFloat(parts[1])];
}

function parseMs(val) {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  const n = Number(val);
  return isNaN(n) ? new Date(val).getTime() : n;
}

function toDateStr(ms) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function parseTimelineJson(raw) {
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const cutoff = now - 730 * DAY;

  const MIN_PINGS = 2;
  const pingCounts = {};

  function recordGpsDay(ts, lat, lon) {
    if (ts < cutoff || isNaN(lat) || isNaN(lon)) return;
    const country = coordToCountry(lat, lon);
    if (!country) return;
    const dateStr = toDateStr(ts);
    if (!pingCounts[dateStr]) pingCounts[dateStr] = {};
    pingCounts[dateStr][country] = (pingCounts[dateStr][country] ?? 0) + 1;
  }

  function processLocations(locations) {
    for (const loc of locations) {
      const ts = parseMs(loc.timestampMs ?? loc.timestamp ?? 0);
      const lat = typeof loc.latitudeE7 === 'number'
        ? loc.latitudeE7 / 1e7
        : parseFloat(loc.latitude ?? NaN);
      const lon = typeof loc.longitudeE7 === 'number'
        ? loc.longitudeE7 / 1e7
        : parseFloat(loc.longitude ?? NaN);
      recordGpsDay(ts, lat, lon);
    }
  }

  if (Array.isArray(raw)) {
    if (raw[0]?.latitudeE7 !== undefined || raw[0]?.latitude !== undefined) {
      processLocations(raw);
    }
  } else if (raw.locations) {
    processLocations(raw.locations);
  } else if (raw.semanticSegments) {
    for (const seg of raw.semanticSegments) {
      if (!seg.timelinePath) continue;
      for (const pt of seg.timelinePath) {
        const ts = parseMs(pt.time);
        const [lat, lon] = parseLatLng(pt.point);
        recordGpsDay(ts, lat, lon);
      }
    }
  } else if (raw.timelineObjects) {
    for (const obj of raw.timelineObjects) {
      const seg = obj.activitySegment;
      if (!seg) continue;
      const rawPath = seg.simplifiedRawPath ?? seg.waypointPath;
      if (!rawPath) continue;
      const pts = rawPath.points ?? rawPath.waypoints ?? [];
      for (const pt of pts) {
        const ts = parseMs(pt.timestampMs ?? pt.timestamp ?? 0);
        const lat = typeof pt.latE7 === 'number' ? pt.latE7 / 1e7
          : typeof pt.latitudeE7 === 'number' ? pt.latitudeE7 / 1e7 : NaN;
        const lon = typeof pt.lngE7 === 'number' ? pt.lngE7 / 1e7
          : typeof pt.longitudeE7 === 'number' ? pt.longitudeE7 / 1e7 : NaN;
        recordGpsDay(ts, lat, lon);
      }
    }
  }

  const days = [];
  for (let i = 729; i >= 0; i--) {
    const ts = now - i * DAY;
    const dateStr = toDateStr(ts);
    const counts = pingCounts[dateStr] ?? {};
    const countries = Object.entries(counts)
      .filter(([, n]) => n >= MIN_PINGS)
      .map(([c]) => c);
    days.push({ date: dateStr, countries });
  }

  // Summary over most recent 180 days — Schengen only
  const recent = days.slice(days.length - 180);
  const schengenTotals = {};
  for (const { countries } of recent) {
    for (const c of countries) {
      if (SCHENGEN_COUNTRIES.has(c)) schengenTotals[c] = (schengenTotals[c] ?? 0) + 1;
    }
  }
  const totalSchengenDays = recent.filter(d => d.countries.some(c => SCHENGEN_COUNTRIES.has(c))).length;

  return { days, countryTotals: schengenTotals, totalSchengenDays };
}
