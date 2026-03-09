'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type GenerationStatus = 'idle' | 'optimizing' | 'queued' | 'processing' | 'completed' | 'failed';

type Track = {
  id: string;
  prompt: string;
  optimizedPrompt: string;
  audioDataUrl: string;
  createdAt: string;
  duration: number;
};

const API_KEY_STORAGE = 'vivmusic.apiKey';
const HISTORY_KEY = 'vivmusic.tracks';

const genres = ['Cinematic', 'Lo-fi', 'Electronic', 'Ambient', 'Pop', 'Hip-Hop'] as const;
const moods = ['Uplifting', 'Chill', 'Dark', 'Energetic', 'Emotional', 'Futuristic'] as const;
const durations = [
  { label: '30s', value: 30 },
  { label: '60s', value: 60 },
  { label: '90s', value: 90 },
  { label: '2 min', value: 120 },
] as const;

export default function HomePage() {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState<string | null>(null);
  const [mood, setMood] = useState<string | null>(null);
  const [duration, setDuration] = useState(60);
  const [instrumental, setInstrumental] = useState(true);
  const [showLyrics, setShowLyrics] = useState(false);
  const [lyrics, setLyrics] = useState('');
  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [statusText, setStatusText] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [quote, setQuote] = useState<number | null>(null);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const historyAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    try {
      const key = localStorage.getItem(API_KEY_STORAGE);
      if (key) setApiKey(key);
      const saved = localStorage.getItem(HISTORY_KEY);
      if (saved) setTracks(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (apiKey) localStorage.setItem(API_KEY_STORAGE, apiKey);
    else localStorage.removeItem(API_KEY_STORAGE);
  }, [apiKey]);

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(tracks.slice(0, 5)));
  }, [tracks]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  async function getQuote() {
    setError('');
    try {
      const res = await fetch('/api/venice/audio/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, durationSeconds: duration }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Quote failed');
      setQuote(data.quote);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Quote failed');
    }
  }

  async function generate() {
    if (!apiKey || !description.trim()) return;

    setError('');
    setStatus('optimizing');
    setStatusText('AI is crafting the perfect prompt...');
    setProgress(5);
    setCurrentAudioUrl(null);
    setQuote(null);

    try {
      const optRes = await fetch('/api/venice/producer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          description: description.trim(),
          genre,
          mood,
          duration,
          instrumental,
          lyrics: showLyrics ? lyrics : undefined,
        }),
      });
      const optData = await optRes.json();
      if (!optRes.ok) throw new Error(optData?.error || 'Prompt optimization failed');

      const optimizedPrompt = optData.optimizedPrompt;
      setCurrentPrompt(optimizedPrompt);
      setProgress(15);
      setStatus('queued');
      setStatusText('Submitting to Venice...');

      const queueRes = await fetch('/api/venice/audio/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          prompt: optimizedPrompt,
          durationSeconds: duration,
          forceInstrumental: instrumental,
          lyricsPrompt: showLyrics && lyrics ? lyrics : undefined,
        }),
      });
      const queueData = await queueRes.json();
      if (!queueRes.ok) throw new Error(queueData?.error || 'Queue failed');

      const queueId = queueData.queueId;
      setProgress(25);
      setStatus('processing');
      setStatusText('Generating your music...');

      pollRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch('/api/venice/audio/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey, queueId }),
          });
          const statusData = await statusRes.json();

          if (statusData.status === 'COMPLETED') {
            stopPolling();
            const audioDataUrl = `data:${statusData.contentType || 'audio/mpeg'};base64,${statusData.audio}`;
            setCurrentAudioUrl(audioDataUrl);
            setStatus('completed');
            setStatusText('Your music is ready!');
            setProgress(100);

            const track: Track = {
              id: `track-${Date.now()}`,
              prompt: description.trim(),
              optimizedPrompt,
              audioDataUrl,
              createdAt: new Date().toISOString(),
              duration,
            };
            setTracks(prev => [track, ...prev].slice(0, 5));
          } else if (statusData.status === 'FAILED') {
            stopPolling();
            setStatus('failed');
            setStatusText('Generation failed. Please try again.');
            setError('Venice audio generation failed.');
            setProgress(0);
          } else {
            const avg = statusData.averageExecutionTime || 30000;
            const elapsed = statusData.executionDuration || 0;
            const pct = Math.min(95, 25 + (elapsed / avg) * 70);
            setProgress(pct);

            const remaining = Math.max(0, Math.ceil((avg - elapsed) / 1000));
            setStatusText(`Generating your music... ~${remaining}s remaining`);
          }
        } catch {
          // keep polling on transient errors
        }
      }, 4000);
    } catch (err) {
      stopPolling();
      setStatus('failed');
      setStatusText('Something went wrong.');
      setError(err instanceof Error ? err.message : 'Unknown error');
      setProgress(0);
    }
  }

  function downloadAudio(dataUrl: string, name: string) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${name}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function playHistoryTrack(track: Track) {
    if (playingTrackId === track.id) {
      historyAudioRef.current?.pause();
      setPlayingTrackId(null);
      return;
    }
    if (historyAudioRef.current) {
      historyAudioRef.current.src = track.audioDataUrl;
      historyAudioRef.current.play();
      setPlayingTrackId(track.id);
    }
  }

  const isGenerating = status === 'optimizing' || status === 'queued' || status === 'processing';
  const canGenerate = apiKey && description.trim() && !isGenerating;

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand">
          <div className="brand-dot" />
          <h1>VivMusic</h1>
        </div>
        <p className="tagline">Studio-quality music from a single sentence</p>
      </header>

      {/* API Key */}
      <section className="card key-card">
        <button type="button" className="key-toggle" onClick={() => setShowKey(!showKey)}>
          {apiKey ? 'API Key Saved' : 'Add Venice API Key'}
          <span className={`chevron ${showKey ? 'open' : ''}`} />
        </button>
        {showKey && (
          <div className="key-body">
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="Paste your Venice API key (vn_...)"
            />
            <p className="hint">
              Get a free key at{' '}
              <a href="https://venice.ai/settings/api" target="_blank" rel="noopener noreferrer">
                venice.ai/settings/api
              </a>. Stored only in your browser.
            </p>
          </div>
        )}
      </section>

      {/* Main Create Card */}
      <section className="card create-card">
        <label className="field-label" htmlFor="description">
          Describe the music you want
        </label>
        <textarea
          id="description"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder='e.g. "Upbeat electronic track for a product launch video, building energy with a big drop"'
          rows={3}
        />

        <div className="chips-section">
          <span className="chips-label">Genre</span>
          <div className="chips">
            {genres.map(g => (
              <button
                key={g}
                type="button"
                className={`chip ${genre === g ? 'active' : ''}`}
                onClick={() => setGenre(genre === g ? null : g)}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <div className="chips-section">
          <span className="chips-label">Mood</span>
          <div className="chips">
            {moods.map(m => (
              <button
                key={m}
                type="button"
                className={`chip ${mood === m ? 'active' : ''}`}
                onClick={() => setMood(mood === m ? null : m)}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="chips-section">
          <span className="chips-label">Duration</span>
          <div className="chips">
            {durations.map(d => (
              <button
                key={d.value}
                type="button"
                className={`chip ${duration === d.value ? 'active' : ''}`}
                onClick={() => setDuration(d.value)}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="toggle-row">
          <button
            type="button"
            className={`toggle-btn ${instrumental ? 'active' : ''}`}
            onClick={() => { setInstrumental(true); setShowLyrics(false); }}
          >
            Instrumental
          </button>
          <button
            type="button"
            className={`toggle-btn ${!instrumental ? 'active' : ''}`}
            onClick={() => setInstrumental(false)}
          >
            With Vocals
          </button>
        </div>

        {!instrumental && (
          <div className="lyrics-section">
            <button
              type="button"
              className="lyrics-toggle"
              onClick={() => setShowLyrics(!showLyrics)}
            >
              {showLyrics ? 'Hide lyrics' : 'Add custom lyrics (optional)'}
            </button>
            {showLyrics && (
              <textarea
                value={lyrics}
                onChange={e => setLyrics(e.target.value)}
                placeholder="Verse 1: Walking through the city lights..."
                rows={4}
              />
            )}
          </div>
        )}

        <div className="action-row">
          <button
            type="button"
            className="btn-generate"
            onClick={generate}
            disabled={!canGenerate}
          >
            {isGenerating ? statusText : 'Generate Music'}
          </button>
          <button
            type="button"
            className="btn-quote"
            onClick={getQuote}
            disabled={!apiKey}
          >
            {quote !== null ? `~$${quote.toFixed(2)}` : 'Estimate Cost'}
          </button>
        </div>

        {error && <p className="error-msg">{error}</p>}
      </section>

      {/* Progress */}
      {isGenerating && (
        <section className="card progress-card">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <p className="progress-text">{statusText}</p>
        </section>
      )}

      {/* Player */}
      {currentAudioUrl && status === 'completed' && (
        <section className="card player-card">
          <div className="player-header">
            <div>
              <h3>Your Track</h3>
              <p className="player-prompt">{description}</p>
            </div>
            <button
              type="button"
              className="btn-download"
              onClick={() => downloadAudio(currentAudioUrl, description.slice(0, 30).replace(/\s+/g, '-'))}
            >
              Download MP3
            </button>
          </div>
          <audio ref={audioRef} src={currentAudioUrl} controls className="audio-player" />
          {currentPrompt && (
            <details className="prompt-details">
              <summary>View optimized prompt</summary>
              <p>{currentPrompt}</p>
            </details>
          )}
        </section>
      )}

      {/* History */}
      {tracks.length > 0 && (
        <section className="card history-card">
          <h3>Recent Tracks</h3>
          <audio ref={historyAudioRef} onEnded={() => setPlayingTrackId(null)} style={{ display: 'none' }} />
          <div className="history-list">
            {tracks.map(track => (
              <div key={track.id} className="history-item">
                <button
                  type="button"
                  className="history-play"
                  onClick={() => playHistoryTrack(track)}
                >
                  {playingTrackId === track.id ? '⏸' : '▶'}
                </button>
                <div className="history-info">
                  <span className="history-prompt">{track.prompt}</span>
                  <span className="history-meta">
                    {track.duration}s &middot; {new Date(track.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <button
                  type="button"
                  className="history-download"
                  onClick={() => downloadAudio(track.audioDataUrl, track.prompt.slice(0, 20).replace(/\s+/g, '-'))}
                >
                  Save
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <footer className="app-footer">
        <p>Powered by <a href="https://venice.ai" target="_blank" rel="noopener noreferrer">Venice AI</a></p>
      </footer>
    </main>
  );
}
