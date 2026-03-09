'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type MusicModel = {
  id: string;
  name: string;
  description: string;
  supportsLyrics: boolean;
  lyricsRequired: boolean;
  supportsForceInstrumental: boolean;
  durationOptions: number[] | null;
  minDuration: number | null;
  maxDuration: number | null;
  defaultDuration: number;
  supportedFormats: string[];
  defaultFormat: string;
  promptCharacterLimit: number;
  lyricsCharacterLimit: number | null;
  minPromptLength: number;
  pricing: Record<string, unknown>;
};

type GenerationStatus = 'idle' | 'optimizing' | 'queued' | 'processing' | 'completed' | 'failed';

type Track = {
  id: string;
  prompt: string;
  optimizedPrompt: string;
  modelName: string;
  audioDataUrl: string;
  createdAt: string;
  duration: number;
};

const API_KEY_STORAGE = 'vivmusic.apiKey';
const HISTORY_KEY = 'vivmusic.tracks.v2';

const genres = ['Cinematic', 'Lo-fi', 'Electronic', 'Ambient', 'Pop', 'Hip-Hop', 'Rock', 'Jazz'] as const;
const moods = ['Uplifting', 'Chill', 'Dark', 'Energetic', 'Emotional', 'Futuristic', 'Dreamy', 'Intense'] as const;

function getDurationOptions(model: MusicModel): number[] {
  if (model.durationOptions) return model.durationOptions;
  if (model.minDuration != null && model.maxDuration != null) {
    const options: number[] = [];
    for (let d = model.minDuration; d <= model.maxDuration; d += 30) {
      options.push(d);
    }
    if (!options.includes(model.maxDuration)) options.push(model.maxDuration);
    return options.slice(0, 8);
  }
  return [30, 60, 90, 120];
}

function formatDuration(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem ? `${m}m ${rem}s` : `${m}m`;
}

function formatPrice(model: MusicModel, duration: number): string {
  const p = model.pricing as Record<string, unknown>;
  if (p.durations) {
    const durations = p.durations as Record<string, Record<string, number>>;
    const d = durations[String(duration)];
    if (d?.usd != null) return `$${d.usd.toFixed(2)}`;
  }
  if (p.generation) {
    const g = p.generation as Record<string, number>;
    if (g.usd != null) return `$${g.usd.toFixed(2)}`;
  }
  if (p.per_second) {
    const ps = p.per_second as Record<string, number>;
    if (ps.usd != null) return `$${(ps.usd * duration).toFixed(2)}`;
  }
  return '';
}

export default function HomePage() {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  const [models, setModels] = useState<MusicModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState('');

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
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const historyAudioRef = useRef<HTMLAudioElement | null>(null);

  const selectedModel = models.find(m => m.id === selectedModelId) || null;
  const durationOpts = selectedModel ? getDurationOptions(selectedModel) : [30, 60, 90, 120];
  const canHaveLyrics = selectedModel?.supportsLyrics || false;
  const lyricsRequired = selectedModel?.lyricsRequired || false;
  const canForceInstrumental = selectedModel?.supportsForceInstrumental || false;
  const priceEstimate = selectedModel ? formatPrice(selectedModel, duration) : '';

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

  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;
    setModelsLoading(true);
    fetch('/api/venice/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey }),
    })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const list: MusicModel[] = data.models || [];
        setModels(list);
        if (list.length && !selectedModelId) {
          setSelectedModelId(list[0].id);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setModelsLoading(false); });
    return () => { cancelled = true; };
  }, [apiKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedModel) {
      const opts = getDurationOptions(selectedModel);
      if (!opts.includes(duration)) setDuration(selectedModel.defaultDuration);
      if (!selectedModel.supportsLyrics) {
        setShowLyrics(false);
        setLyrics('');
      }
      if (selectedModel.lyricsRequired) {
        setShowLyrics(true);
        setInstrumental(false);
      }
      if (!selectedModel.supportsForceInstrumental) {
        setInstrumental(false);
      }
    }
  }, [selectedModelId]); // eslint-disable-line react-hooks/exhaustive-deps

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  async function generate() {
    if (!apiKey || !description.trim() || !selectedModel) return;
    if (lyricsRequired && !lyrics.trim()) {
      setError(`${selectedModel.name} requires lyrics. Please add them below.`);
      return;
    }

    setError('');
    setStatus('optimizing');
    setStatusText('AI is crafting the perfect prompt...');
    setProgress(5);
    setCurrentAudioUrl(null);

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
          instrumental: canForceInstrumental && instrumental,
          lyrics: canHaveLyrics && lyrics ? lyrics : undefined,
          modelName: selectedModel.name,
          promptLimit: selectedModel.promptCharacterLimit,
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
          model: selectedModel.id,
          prompt: optimizedPrompt,
          durationSeconds: duration,
          forceInstrumental: canForceInstrumental && instrumental,
          lyricsPrompt: canHaveLyrics && lyrics ? lyrics : undefined,
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
            body: JSON.stringify({ apiKey, model: selectedModel.id, queueId }),
          });
          const statusData = await statusRes.json();

          if (statusData.status === 'COMPLETED') {
            stopPolling();
            const ct = statusData.contentType || 'audio/mpeg';
            const audioDataUrl = `data:${ct};base64,${statusData.audio}`;
            setCurrentAudioUrl(audioDataUrl);
            setStatus('completed');
            setStatusText('Your music is ready!');
            setProgress(100);

            const track: Track = {
              id: `track-${Date.now()}`,
              prompt: description.trim(),
              optimizedPrompt,
              modelName: selectedModel.name,
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
        } catch { /* keep polling on transient errors */ }
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
    const ext = selectedModel?.defaultFormat || 'mp3';
    a.download = `${name}.${ext}`;
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
  const canGenerate = apiKey && description.trim().length >= (selectedModel?.minPromptLength || 10) && selectedModel && !isGenerating;

  return (
    <main className="app-shell">
      {/* Decorative elements */}
      <div className="deco-ring deco-ring-1" />
      <div className="deco-ring deco-ring-2" />
      <div className="scanlines" />

      <header className="app-header">
        <div className="brand">
          <div className="brand-eye" />
          <div>
            <h1>VivMusic</h1>
            <p className="tagline">Yesterday&apos;s tomorrow, today.</p>
          </div>
        </div>
      </header>

      {/* API Key */}
      <section className="card key-card">
        <button type="button" className="key-toggle" onClick={() => setShowKey(!showKey)}>
          <span className="key-dot" />
          {apiKey ? 'API Key Connected' : 'Connect Venice API Key'}
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
              </a>
            </p>
          </div>
        )}
      </section>

      {/* Model Selector */}
      {models.length > 0 && (
        <section className="card model-card">
          <div className="section-label">Select AI Model</div>
          <div className="model-grid">
            {models.map(m => (
              <button
                key={m.id}
                type="button"
                className={`model-option ${selectedModelId === m.id ? 'active' : ''}`}
                onClick={() => setSelectedModelId(m.id)}
              >
                <strong>{m.name}</strong>
                <span className="model-desc">{m.description}</span>
                <div className="model-tags">
                  {m.supportsLyrics && <span className="mtag lyrics-tag">Lyrics</span>}
                  {m.supportsForceInstrumental && <span className="mtag inst-tag">Instrumental</span>}
                  <span className="mtag format-tag">{m.defaultFormat.toUpperCase()}</span>
                </div>
              </button>
            ))}
          </div>
          {modelsLoading && <p className="hint">Loading models...</p>}
        </section>
      )}

      {/* Create Card */}
      <section className="card create-card">
        <div className="section-label">Describe Your Sound</div>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder='e.g. "Upbeat electronic track for a product launch, building energy with a massive drop"'
          rows={3}
          maxLength={selectedModel?.promptCharacterLimit || 500}
        />
        {selectedModel && (
          <div className="char-count">
            {description.length}/{selectedModel.promptCharacterLimit}
          </div>
        )}

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
            {durationOpts.map(d => (
              <button
                key={d}
                type="button"
                className={`chip ${duration === d ? 'active' : ''}`}
                onClick={() => setDuration(d)}
              >
                {formatDuration(d)}
              </button>
            ))}
          </div>
        </div>

        {/* Instrumental toggle — only if model supports it */}
        {canForceInstrumental && (
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
        )}

        {/* Lyrics — if model supports or requires them */}
        {canHaveLyrics && (
          <div className="lyrics-section">
            {!lyricsRequired && (
              <button
                type="button"
                className="lyrics-toggle"
                onClick={() => setShowLyrics(!showLyrics)}
              >
                {showLyrics ? 'Hide lyrics' : '+ Add custom lyrics'}
              </button>
            )}
            {(showLyrics || lyricsRequired) && (
              <>
                <textarea
                  value={lyrics}
                  onChange={e => setLyrics(e.target.value)}
                  placeholder={lyricsRequired
                    ? 'Lyrics are required for this model. Add verse/chorus structure...'
                    : 'Verse 1: Walking through the city lights...'}
                  rows={5}
                  maxLength={selectedModel?.lyricsCharacterLimit || 4096}
                />
                {lyricsRequired && !lyrics.trim() && (
                  <p className="lyrics-required-hint">This model requires lyrics to generate.</p>
                )}
              </>
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
          {priceEstimate && (
            <div className="price-badge">
              {priceEstimate}
            </div>
          )}
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
              <h3>Your Track is Ready</h3>
              <p className="player-prompt">{description}</p>
              {selectedModel && <span className="player-model">{selectedModel.name}</span>}
            </div>
            <button
              type="button"
              className="btn-download"
              onClick={() => downloadAudio(currentAudioUrl, description.slice(0, 30).replace(/\s+/g, '-'))}
            >
              Download
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
          <div className="section-label">Recent Tracks</div>
          <audio ref={historyAudioRef} onEnded={() => setPlayingTrackId(null)} style={{ display: 'none' }} />
          <div className="history-list">
            {tracks.map(track => (
              <div key={track.id} className="history-item">
                <button
                  type="button"
                  className="history-play"
                  onClick={() => playHistoryTrack(track)}
                >
                  {playingTrackId === track.id ? '||' : '\u25B6'}
                </button>
                <div className="history-info">
                  <span className="history-prompt">{track.prompt}</span>
                  <span className="history-meta">
                    {track.modelName} &middot; {formatDuration(track.duration)} &middot; {new Date(track.createdAt).toLocaleDateString()}
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
