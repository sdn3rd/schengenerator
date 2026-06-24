import SCHENGEN_FEATURES from './schengen-features.json';
import WORLD_FEATURES from './world-features.json';

const SCHENGEN_COUNTRIES = new Set([
  'AT','BE','CZ','DK','EE','FI','FR','DE','GR','HU',
  'IS','IT','LV','LI','LT','LU','MT','NL','NO','PL',
  'PT','SK','SI','ES','SE','CH',
]);

export const COUNTRY_NAMES = Object.fromEntries(
  [...WORLD_FEATURES, ...SCHENGEN_FEATURES].map(f => [f.code, f.name])
);

function pointInRing(lat, lon, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi))
      inside = !inside;
  }
  return inside;
}

function pointInPolygon(lat, lon, rings) {
  if (!pointInRing(lat, lon, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) if (pointInRing(lat, lon, rings[i])) return false;
  return true;
}

function lookup(lat, lon, features) {
  for (const { code, bbox, rings } of features) {
    if (lat < bbox[0] || lat > bbox[1] || lon < bbox[2] || lon > bbox[3]) continue;
    if (pointInPolygon(lat, lon, rings)) return code;
  }
  return null;
}

function coordToCountry(lat, lon) {
  return lookup(lat, lon, SCHENGEN_FEATURES) ?? lookup(lat, lon, WORLD_FEATURES);
}

function parseLatLng(str) {
  if (!str) return [NaN, NaN];
  const p = str.split(',');
  return [parseFloat(p[0]), parseFloat(p[1])];
}

function parseMs(val) {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  const n = Number(val);
  return isNaN(n) ? new Date(val).getTime() : n;
}

function toDateStr(ms) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

function parseTimelineJson(raw, onProgress) {
  const now = Date.now();
  const DAY = 86400000;
  const MAX_HISTORY_DAYS = 1825; // 5 years
  const cutoff = now - MAX_HISTORY_DAYS * DAY;
  const MIN_PINGS = 2;
  const pingCounts = {};
  const placeGrid  = {};  // 0.5° grid clusters for visitedPlaces
  const locationMap = {};

  function recordGpsDay(ts, lat, lon) {
    if (ts < cutoff || isNaN(lat) || isNaN(lon)) return;
    const country = coordToCountry(lat, lon);
    if (!country) return;
    const d = toDateStr(ts);
    if (!pingCounts[d]) pingCounts[d] = {};
    pingCounts[d][country] = (pingCounts[d][country] ?? 0) + 1;
    // 0.5° grid cell clustering
    const cellLat = Math.round(lat * 2) / 2;
    const cellLon = Math.round(lon * 2) / 2;
    const key = `${cellLat},${cellLon}`;
    if (!placeGrid[key]) placeGrid[key] = { lat: cellLat, lon: cellLon, datePings: {} };
    placeGrid[key].datePings[d] = (placeGrid[key].datePings[d] ?? 0) + 1;
  }

  function recordLocation(ts, name) {
    if (!name || ts < cutoff) return;
    const d = toDateStr(ts);
    if (!locationMap[d]) locationMap[d] = new Set();
    locationMap[d].add(name);
  }

  // Collect all records into a flat list for progress reporting
  let records = [];
  if (Array.isArray(raw)) {
    if (raw[0]?.latitudeE7 !== undefined || raw[0]?.latitude !== undefined) records = raw;
  } else if (raw.locations) {
    records = raw.locations;
  } else if (raw.semanticSegments) {
    records = raw.semanticSegments;
  } else if (raw.timelineObjects) {
    records = raw.timelineObjects;
  }

  const total = Math.max(1, records.length);

  function processLocationRecord(loc) {
    const ts = parseMs(loc.timestampMs ?? loc.timestamp ?? 0);
    const lat = typeof loc.latitudeE7 === 'number' ? loc.latitudeE7 / 1e7 : parseFloat(loc.latitude ?? NaN);
    const lon = typeof loc.longitudeE7 === 'number' ? loc.longitudeE7 / 1e7 : parseFloat(loc.longitude ?? NaN);
    recordGpsDay(ts, lat, lon);
  }

  // Process with chunked progress reporting (every 5000 records)
  const CHUNK = 5000;
  for (let i = 0; i < records.length; i++) {
    const item = records[i];

    if (Array.isArray(raw) || raw.locations) {
      processLocationRecord(item);
    } else if (raw.semanticSegments) {
      if (item.timelinePath) {
        for (const pt of item.timelinePath) {
          recordGpsDay(parseMs(pt.time), ...parseLatLng(pt.point));
        }
      }
      if (item.visit?.topCandidate?.placeLocation?.latLng) {
        recordGpsDay(parseMs(item.startTime), ...parseLatLng(item.visit.topCandidate.placeLocation.latLng));
      }
    } else if (raw.timelineObjects) {
      if (item.placeVisit) {
        const pv = item.placeVisit;
        const ts = parseMs(pv.duration?.startTimestampMs ?? pv.duration?.startTimestamp ?? 0);
        const lat = typeof pv.location?.latitudeE7 === 'number' ? pv.location.latitudeE7 / 1e7 : NaN;
        const lon = typeof pv.location?.longitudeE7 === 'number' ? pv.location.longitudeE7 / 1e7 : NaN;
        recordGpsDay(ts, lat, lon);
        if (pv.location?.name) recordLocation(ts, pv.location.name);
      }
      const seg = item.activitySegment;
      if (seg) {
        const rawPath = seg.simplifiedRawPath ?? seg.waypointPath;
        if (rawPath) {
          for (const pt of rawPath.points ?? rawPath.waypoints ?? []) {
            const ts = parseMs(pt.timestampMs ?? pt.timestamp ?? 0);
            const lat = typeof pt.latE7 === 'number' ? pt.latE7 / 1e7 : typeof pt.latitudeE7 === 'number' ? pt.latitudeE7 / 1e7 : NaN;
            const lon = typeof pt.lngE7 === 'number' ? pt.lngE7 / 1e7 : typeof pt.longitudeE7 === 'number' ? pt.longitudeE7 / 1e7 : NaN;
            recordGpsDay(ts, lat, lon);
          }
        }
      }
    }

    if (onProgress && (i + 1) % CHUNK === 0) {
      onProgress((i + 1) / total);
    }
  }

  // Build days[] from earliest GPS date in data to today
  const allDates = Object.keys(pingCounts).sort();
  const earliestDate = allDates.length > 0 ? allDates[0] : toDateStr(now - MAX_HISTORY_DAYS * DAY);
  const earliestTs = new Date(earliestDate + 'T00:00:00Z').getTime();
  const totalDays = Math.round((now - earliestTs) / DAY) + 1;

  const days = [];
  for (let i = 0; i < totalDays; i++) {
    const ts = earliestTs + i * DAY;
    const d = toDateStr(ts);
    const counts = pingCounts[d] ?? {};
    days.push({ date: d, countries: Object.entries(counts).filter(([,n]) => n >= MIN_PINGS).map(([c]) => c) });
  }

  const locations = {};
  for (const [d, names] of Object.entries(locationMap)) {
    locations[d] = [...names];
  }

  // visitedPlaces: grid cells with ≥2 pings on a given day (~1 hour)
  const visitedPlaces = Object.values(placeGrid)
    .map(({ lat, lon, datePings }) => ({
      lat,
      lon,
      dates: Object.entries(datePings).filter(([,n]) => n >= MIN_PINGS).map(([d]) => d),
    }))
    .filter(p => p.dates.length > 0);

  const recent = days.slice(-180);
  const countryTotals = {};
  for (const { countries } of recent)
    for (const c of countries)
      if (SCHENGEN_COUNTRIES.has(c)) countryTotals[c] = (countryTotals[c] ?? 0) + 1;
  const totalSchengenDays = recent.filter(d => d.countries.some(c => SCHENGEN_COUNTRIES.has(c))).length;

  return { days, countryTotals, totalSchengenDays, countryNames: COUNTRY_NAMES, locations, visitedPlaces };
}

self.onmessage = ({ data: text }) => {
  try {
    self.postMessage({ progress: 0.05, status: 'Parsing JSON…' });
    const raw = JSON.parse(text);

    self.postMessage({ progress: 0.15, status: 'Processing GPS records…' });
    const result = parseTimelineJson(raw, (p) => {
      self.postMessage({ progress: 0.15 + p * 0.75, status: `Processing… ${Math.round(p * 100)}%` });
    });

    self.postMessage({ progress: 0.95, status: 'Building timeline…' });
    self.postMessage({ ok: true, result });
  } catch (e) {
    self.postMessage({ ok: false, error: e.message });
  }
};
