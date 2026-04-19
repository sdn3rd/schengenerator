import { useState, useCallback, useRef } from 'react';
import { Bolt } from './DiceLogo';
import Dashboard from './Dashboard';
import LavaLamp from './LavaLamp';
import { SunIcon, MoonIcon, FileJsonIcon, AlertIcon } from './icons';
import './App.css';

export default function App() {
  const [theme, setTheme] = useState(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  );
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef();

  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'));

  const analyze = useCallback(async (file) => {
    setError(null);
    setLoading(true);
    try {
      const text = await file.text();
      const worker = new Worker(new URL('./timelineWorker.js', import.meta.url), { type: 'module' });
      worker.onmessage = ({ data }) => {
        setLoading(false);
        if (data.ok) setResult(data.result);
        else setError(data.error);
        worker.terminate();
      };
      worker.onerror = (e) => { setLoading(false); setError(e.message); worker.terminate(); };
      worker.postMessage(text);
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  }, []);

  return (
    <div data-theme={theme} className="app">
      <LavaLamp />

      <header className="header">
        <div className="header-left">
          <Bolt size={16} className="title-bolt" />
          <span className="app-title">Schengenerator</span>
        </div>
        <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === 'dark' ? <SunIcon size={18} /> : <MoonIcon size={18} />}
        </button>
      </header>

      <main className="main">
        {!result && (
          <section className="hero">
            <p className="catchphrase">Know your count.</p>

            <div
              className={`dropzone${dragging ? ' dragging' : ''}`}
              onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) analyze(f); }}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onClick={() => fileRef.current.click()}
            >
              <FileJsonIcon size={24} className="dropzone-icon" />
              <div>
                <p className="dropzone-text">Drop your <strong>Timeline JSON</strong> here or click to browse</p>
                <p className="dropzone-hint">
                  Google Maps → profile photo → Your Timeline → ⋮ → Export timeline data
                </p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) analyze(f); }}
              />
            </div>

            {loading && (
              <div className="loading-msg">
                <div className="spinner" />
                Analyzing your timeline...
              </div>
            )}
            {error && (
              <div className="error-msg">
                <AlertIcon size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                {error}
              </div>
            )}
          </section>
        )}

        {result && (
          <Dashboard
            data={result}
            onReset={() => { setResult(null); setError(null); }}
          />
        )}
      </main>

      <footer className="app-footer">
        <a className="footer-privacy" href="/privacy.html">Privacy</a>
        <span className="footer-version">v{__APP_VERSION__}</span>
        <a
          className="footer-github"
          href="https://github.com/sdn3rd/schengenerator"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.167 6.839 9.49.5.092.682-.217.682-.482 0-.237-.009-.868-.014-1.703-2.782.604-3.369-1.34-3.369-1.34-.454-1.154-1.11-1.461-1.11-1.461-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
          </svg>
        </a>
      </footer>
    </div>
  );
}
