import { writeFileSync } from 'fs';

const NAME_TO_ISO = {
  'France': 'FR',
  'Norway': 'NO',
  'Kosovo': 'XK',
};
const SKIP_NAMES = new Set(['N. Cyprus', 'Somaliland']);

function truncateCoords(geometry) {
  function t(n) { return Math.round(n * 1e3) / 1e3; }
  function ring(r) { return r.map(([x, y]) => [t(x), t(y)]); }
  if (geometry.type === 'Polygon') {
    return { type: 'Polygon', coordinates: geometry.coordinates.map(ring) };
  }
  if (geometry.type === 'MultiPolygon') {
    return { type: 'MultiPolygon', coordinates: geometry.coordinates.map(poly => poly.map(ring)) };
  }
  return geometry;
}

const res = await fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson');
const raw = await res.json();

const features = [];
for (const f of raw.features) {
  const name = f.properties.NAME ?? f.properties.name ?? '';
  if (SKIP_NAMES.has(name)) continue;
  let code = f.properties.ISO_A2;
  if (!code || code === '-99') code = NAME_TO_ISO[name] ?? null;
  if (!code) continue;
  features.push({
    type: 'Feature',
    properties: { code, name },
    geometry: truncateCoords(f.geometry),
  });
}

const out = JSON.stringify({ type: 'FeatureCollection', features });
writeFileSync(new URL('../worker/world-borders.json', import.meta.url), out);
console.log(`wrote ${features.length} countries, ${(out.length / 1024).toFixed(1)} KB`);
