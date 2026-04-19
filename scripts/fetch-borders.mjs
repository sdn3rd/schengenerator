import { writeFileSync } from 'fs';

const SCHENGEN_A2 = new Set(['AT','BE','CZ','DK','EE','FI','FR','DE','GR','HU','IS','IT','LV','LI','LT','LU','MT','NL','NO','PL','PT','SK','SI','ES','SE','CH']);
const NAME_FIX = { 'France': 'FR', 'Norway': 'NO' };

// Truncate coordinate precision to 4 decimal places (~11m accuracy).
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

const res = await fetch('https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson');
const raw = await res.json();

const features = [];
for (const f of raw.features) {
  const iso = f.properties['ISO3166-1-Alpha-2'];
  const name = f.properties.name ?? '';
  const code = SCHENGEN_A2.has(iso) ? iso : (NAME_FIX[name] ?? null);
  if (!code) continue;
  features.push({ type: 'Feature', properties: { code }, geometry: truncateCoords(f.geometry) });
}

const out = JSON.stringify({ type: 'FeatureCollection', features });
writeFileSync(new URL('../worker/schengen-borders.json', import.meta.url), out);
console.log(`wrote ${features.length} countries, ${(out.length / 1024).toFixed(1)} KB`);
