import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { parseTimelineJson, COUNTRY_NAMES, SCHENGEN_COUNTRIES } from './schengen.js';

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });

app.use(cors({ origin: true }));
app.use(express.json({ limit: '500mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/schengen-countries', (_req, res) => {
  const list = [...SCHENGEN_COUNTRIES].map(code => ({ code, name: COUNTRY_NAMES[code] ?? code }));
  res.json(list);
});

app.post('/api/analyze', upload.single('timeline'), (req, res) => {
  try {
    let raw;
    if (req.file) {
      raw = JSON.parse(req.file.buffer.toString('utf8'));
    } else if (req.body && Object.keys(req.body).length > 0) {
      raw = req.body;
    } else {
      return res.status(400).json({ error: 'No timeline data provided.' });
    }
    res.json(parseTimelineJson(raw));
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Failed to parse timeline JSON: ' + err.message });
  }
});

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => console.log(`SchengenShuffler backend :${PORT}`));
