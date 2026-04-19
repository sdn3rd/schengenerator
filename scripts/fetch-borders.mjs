/**
 * Builds two pre-computed feature arrays used directly by schengen.js at runtime.
 * Pre-computing bboxes here means zero startup CPU cost in the Worker.
 *
 * Outputs:
 *   worker/schengen-features.json  — 26 Schengen countries, 1:50m, European territory only
 *   worker/world-features.json     — remaining world countries, 1:110m
 *
 * Each entry: { code, name, bbox: [minLat,maxLat,minLon,maxLon], rings: [[[lon,lat],...]] }
 */

import { writeFileSync } from 'fs';

const SCHENGEN = new Set(['AT','BE','CZ','DK','EE','FI','FR','DE','GR','HU','IS','IT','LV','LI','LT','LU','MT','NL','NO','PL','PT','SK','SI','ES','SE','CH']);
const SCHENGEN_NAME_FIX = { 'France': 'FR', 'Norway': 'NO' };

// European bounding box — strips overseas territories (French Guiana, Antilles, etc.)
const EU_LAT_MIN = 27, EU_LAT_MAX = 72, EU_LON_MIN = -26, EU_LON_MAX = 45;

function truncate3(n) { return Math.round(n * 1e3) / 1e3; }
function truncRing(r) { return r.map(([x, y]) => [truncate3(x), truncate3(y)]); }
function truncGeom(g) {
  if (g.type === 'Polygon') return { type: 'Polygon', coordinates: g.coordinates.map(truncRing) };
  if (g.type === 'MultiPolygon') return { type: 'MultiPolygon', coordinates: g.coordinates.map(p => p.map(truncRing)) };
  return g;
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

function isEuropean(bbox) {
  const [minLat, maxLat, minLon, maxLon] = bbox;
  // Polygon centroid must fall inside the European box
  const midLat = (minLat + maxLat) / 2;
  const midLon = (minLon + maxLon) / 2;
  return midLat >= EU_LAT_MIN && midLat <= EU_LAT_MAX && midLon >= EU_LON_MIN && midLon <= EU_LON_MAX;
}

function geomToEntries(code, name, geometry) {
  const rings = geometry.type === 'Polygon'
    ? [geometry.coordinates]
    : geometry.coordinates; // array of ring-sets
  const entries = [];
  for (const r of rings) {
    const bbox = ringBbox(r[0]);
    entries.push({ code, name, bbox, rings: r });
  }
  return entries;
}

// ── Fetch Schengen (1:50m) ───────────────────────────────────────────────────
const r1 = await fetch('https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson');
const raw1 = await r1.json();

const schengenFeatures = [];
for (const f of raw1.features) {
  const iso = f.properties['ISO3166-1-Alpha-2'];
  const name = f.properties.name ?? '';
  const code = SCHENGEN.has(iso) ? iso : (SCHENGEN_NAME_FIX[name] ?? null);
  if (!code || !SCHENGEN.has(code)) continue;
  const geom = truncGeom(f.geometry);
  for (const entry of geomToEntries(code, name, geom)) {
    if (isEuropean(entry.bbox)) schengenFeatures.push(entry);
  }
}

// ── Fetch World (1:110m) ─────────────────────────────────────────────────────
const WORLD_NAME_FIX = { 'France': 'FR', 'Norway': 'NO', 'Kosovo': 'XK' };
const SKIP_NAMES = new Set(['N. Cyprus', 'Somaliland']);

const r2 = await fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson');
const raw2 = await r2.json();

const worldFeatures = [];
for (const f of raw2.features) {
  const name = f.properties.NAME ?? f.properties.name ?? '';
  if (SKIP_NAMES.has(name)) continue;
  let code = f.properties.ISO_A2;
  if (!code || code === '-99') code = WORLD_NAME_FIX[name] ?? null;
  if (!code) continue;
  if (SCHENGEN.has(code)) continue; // covered by high-res Schengen data
  const geom = truncGeom(f.geometry);
  for (const entry of geomToEntries(code, name, geom)) {
    worldFeatures.push(entry);
  }
}

// ── Write ────────────────────────────────────────────────────────────────────
const sf = JSON.stringify(schengenFeatures);
const wf = JSON.stringify(worldFeatures);
writeFileSync(new URL('../worker/schengen-features.json', import.meta.url), sf);
writeFileSync(new URL('../worker/world-features.json', import.meta.url), wf);

console.log(`schengen-features.json: ${schengenFeatures.length} polygons, ${(sf.length/1024).toFixed(1)} KB`);
console.log(`world-features.json:    ${worldFeatures.length} polygons, ${(wf.length/1024).toFixed(1)} KB`);
