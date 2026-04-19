import { parseTimelineJson, COUNTRY_NAMES } from './schengen.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      return Response.json({ ok: true });
    }

    if (request.method === 'POST' && url.pathname === '/api/analyze') {
      try {
        const ct = request.headers.get('content-type') ?? '';
        let raw;
        if (ct.includes('multipart/form-data')) {
          const fd = await request.formData();
          const file = fd.get('timeline');
          if (!file) return Response.json({ error: 'No file provided.' }, { status: 400 });
          const text = typeof file === 'string' ? file : await file.text();
          raw = JSON.parse(text);
        } else {
          raw = await request.json();
        }
        return Response.json({ ...parseTimelineJson(raw), countryNames: COUNTRY_NAMES });
      } catch (e) {
        return Response.json({ error: 'Failed to parse timeline JSON: ' + e.message }, { status: 400 });
      }
    }

    return env.ASSETS.fetch(request);
  },
};
