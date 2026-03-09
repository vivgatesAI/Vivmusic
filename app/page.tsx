'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type MusicModel = {
  id: string;
  name: string;
  description: string;
  supportsLyrics: boolean;
  lyricsRequired: boolean;
  supportsForceInstrumental: boolean;
  supportsSpeed: boolean;
  minSpeed: number | null;
  maxSpeed: number | null;
  voices: string[];
  defaultVoice: string | null;
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
  privacy: string;
};

type GenerationStatus = 'idle' | 'optimizing' | 'queued' | 'processing' | 'downloading' | 'completed' | 'failed';

type Track = {
  id: string;
  prompt: string;
  optimizedPrompt: string;
  modelId: string;
  modelName: string;
  format: string;
  audioBlobUrl: string;
  createdAt: string;
  duration: number;
  genre: string | null;
  mood: string | null;
};

const API_KEY_STORAGE = 'vivmusic.apiKey';
const HISTORY_KEY = 'vivmusic.tracks.v3';

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

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
  const [instrumental, setInstrumental] = useState(false);
  const [lyrics, setLyrics] = useState('');
  const [showLyrics, setShowLyrics] = useState(false);
  const [voice, setVoice] = useState('');
  const [speed, setSpeed] = useState(1);

  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [statusText, setStatusText] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);

  const cancelledRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const historyAudioRef = useRef<HTMLAudioElement | null>(null);

  const selectedModel = models.find(m => m.id === selectedModelId) || null;
  const durationOpts = selectedModel ? getDurationOptions(selectedModel) : [30, 60, 90, 120];
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
    const forStorage = tracks.slice(0, 5).map(t => ({ ...t, audioBlobUrl: '' }));
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(forStorage));
    } catch { /* storage full */ }
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
    if (!selectedModel) return;
    const opts = getDurationOptions(selectedModel);
    if (!opts.includes(duration)) setDuration(selectedModel.defaultDuration);
    if (!selectedModel.supportsLyrics) { setShowLyrics(false); setLyrics(''); }
    if (selectedModel.lyricsRequired) { setShowLyrics(true); setInstrumental(false); }
    if (!selectedModel.supportsForceInstrumental) { setInstrumental(false); }
    setVoice(selectedModel.defaultVoice || '');
    if (!selectedModel.supportsSpeed) setSpeed(1);
  }, [selectedModelId]); // eslint-disable-line react-hooks/exhaustive-deps

  const cancelGeneration = useCallback(() => {
    cancelledRef.current = true;
    setStatus('idle');
    setStatusText('');
    setProgress(0);
    setError('');
  }, []);

  async function generate() {
    if (!apiKey || !description.trim() || !selectedModel) return;
    if (selectedModel.lyricsRequired && !lyrics.trim()) {
      setError(`${selectedModel.name} requires lyrics. Please add them.`);
      return;
    }

    cancelledRef.current = false;
    setError('');
    setStatus('optimizing');
    setStatusText('AI is crafting the perfect prompt...');
    setProgress(5);
    setCurrentAudioUrl(null);
    setCurrentTrack(null);

    try {
      // Step 1: Optimize prompt
      const optRes = await fetch('/api/venice/producer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          description: description.trim(),
          genre,
          mood,
          duration,
          instrumental: selectedModel.supportsForceInstrumental && instrumental,
          lyrics: selectedModel.supportsLyrics && lyrics ? lyrics : undefined,
          modelName: selectedModel.name,
          promptLimit: selectedModel.promptCharacterLimit,
        }),
      });
      const optData = await optRes.json();
      if (!optRes.ok) throw new Error(optData?.error || 'Prompt optimization failed');
      if (cancelledRef.current) return;

      const optimizedPrompt = optData.optimizedPrompt;
      setProgress(15);
      setStatus('queued');
      setStatusText('Submitting to Venice...');

      // Step 2: Queue generation
      const queueRes = await fetch('/api/venice/audio/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          model: selectedModel.id,
          prompt: optimizedPrompt,
          durationSeconds: duration,
          forceInstrumental: selectedModel.supportsForceInstrumental && instrumental,
          lyricsPrompt: selectedModel.supportsLyrics && lyrics ? lyrics : undefined,
          voice: selectedModel.voices.length > 0 ? voice : undefined,
          speed: selectedModel.supportsSpeed && speed !== 1 ? speed : undefined,
        }),
      });
      const queueData = await queueRes.json();
      if (!queueRes.ok) throw new Error(queueData?.error || 'Queue failed');
      if (cancelledRef.current) return;

      const queueId = queueData.queueId;
      setProgress(25);
      setStatus('processing');
      setStatusText('Generating your music...');

      // Step 3: Poll for completion (like the video app pattern)
      await sleep(3000);

      const POLL_INTERVAL = 5000;
      const MAX_ATTEMPTS = 120;
      let consecutiveErrors = 0;

      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        if (cancelledRef.current) return;

        try {
          const statusRes = await fetch('/api/venice/audio/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey, model: selectedModel.id, queueId }),
          });

          if (!statusRes.ok) {
            consecutiveErrors++;
            if (statusRes.status === 404 && attempt < 5) {
              await sleep(5000);
              continue;
            }
            if (consecutiveErrors >= 5) {
              throw new Error(`Venice returned ${statusRes.status} (${consecutiveErrors} consecutive errors)`);
            }
            await sleep(POLL_INTERVAL);
            continue;
          }

          const statusData = await statusRes.json();
          consecutiveErrors = 0;

          if (statusData.status === 'COMPLETED') {
            setProgress(85);
            setStatus('downloading');
            setStatusText('Downloading your track...');

            // Step 4: Download audio via dedicated route
            const audioRes = await fetch('/api/venice/audio/download', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ apiKey, model: selectedModel.id, queueId }),
            });

            if (!audioRes.ok) {
              const errData = await audioRes.json().catch(() => ({}));
              throw new Error((errData as Record<string, string>).error || 'Audio download failed');
            }

            const ct = audioRes.headers.get('Content-Type') || '';
            if (!ct.includes('audio/') && !ct.includes('application/octet-stream')) {
              throw new Error('Unexpected response type from download');
            }

            const audioBlob = await audioRes.blob();
            const audioBlobUrl = URL.createObjectURL(audioBlob);
            if (cancelledRef.current) { URL.revokeObjectURL(audioBlobUrl); return; }

            setCurrentAudioUrl(audioBlobUrl);

            const track: Track = {
              id: `track-${Date.now()}`,
              prompt: description.trim(),
              optimizedPrompt,
              modelId: selectedModel.id,
              modelName: selectedModel.name,
              format: selectedModel.defaultFormat,
              audioBlobUrl,
              createdAt: new Date().toISOString(),
              duration,
              genre,
              mood,
            };
            setCurrentTrack(track);
            setTracks(prev => [track, ...prev].slice(0, 10));
            setStatus('completed');
            setStatusText('Your music is ready!');
            setProgress(100);

            // Step 5: Cleanup (fire-and-forget)
            fetch('/api/venice/audio/complete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ apiKey, model: selectedModel.id, queueId }),
            }).catch(() => {});

            return;
          }

          if (statusData.status === 'FAILED') {
            throw new Error('Venice audio generation failed. Please try again.');
          }

          // Still processing — update progress bar
          const avg = statusData.averageExecutionTime || 60000;
          const elapsed = statusData.executionDuration || 0;
          const pct = Math.min(80, 25 + (elapsed / avg) * 55);
          setProgress(pct);
          const remaining = Math.max(0, Math.ceil((avg - elapsed) / 1000));
          setStatusText(`Generating your music... ~${remaining}s remaining`);

        } catch (pollErr) {
          consecutiveErrors++;
          if (consecutiveErrors >= 5) {
            throw pollErr;
          }
        }

        await sleep(POLL_INTERVAL);
      }

      throw new Error('Generation timed out after 10 minutes. Please try again.');

    } catch (err) {
      if (cancelledRef.current) return;
      setStatus('failed');
      setStatusText('Something went wrong.');
      setError(err instanceof Error ? err.message : 'Unknown error');
      setProgress(0);
    }
  }

  function downloadAudio(blobUrl: string, name: string, format?: string) {
    const a = document.createElement('a');
    a.href = blobUrl;
    const ext = format || selectedModel?.defaultFormat || 'mp3';
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
      historyAudioRef.current.src = track.audioBlobUrl;
      historyAudioRef.current.play();
      setPlayingTrackId(track.id);
    }
  }

  const isGenerating = status === 'optimizing' || status === 'queued' || status === 'processing' || status === 'downloading';
  const canGenerate =
    apiKey &&
    description.trim().length >= (selectedModel?.minPromptLength || 10) &&
    selectedModel &&
    !isGenerating &&
    (!selectedModel.lyricsRequired || lyrics.trim().length > 0);

  return (
    <main className="app-shell">
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
          <span className={`key-dot ${apiKey ? 'connected' : ''}`} />
          {apiKey ? 'API Key Connected' : 'Connect Venice API Key'}
          <span className={`chevron ${showKey ? 'open' : ''}`} />
        </button>
        {showKey && (
          <form className="key-body" onSubmit={e => { e.preventDefault(); setShowKey(false); }}>
            <input
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="Paste your Venice API key (vn_...)"
            />
            <p className="hint">
              Get a free key at{' '}
              <a href="https://venice.ai/settings/api" target="_blank" rel="noopener noreferrer">venice.ai/settings/api</a>
            </p>
          </form>
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
                  {m.supportsLyrics && !m.lyricsRequired && <span className="mtag lyrics-tag">Lyrics OK</span>}
                  {m.lyricsRequired && <span className="mtag lyrics-req-tag">Lyrics Req</span>}
                  {m.supportsForceInstrumental && <span className="mtag inst-tag">Instrumental</span>}
                  {m.voices.length > 0 && <span className="mtag voice-tag">Voices</span>}
                  {m.supportsSpeed && <span className="mtag speed-tag">Speed</span>}
                  <span className="mtag format-tag">{m.defaultFormat.toUpperCase()}</span>
                  <span className="mtag privacy-tag">{m.privacy}</span>
                </div>
              </button>
            ))}
          </div>
          {modelsLoading && <p className="hint">Loading models...</p>}
        </section>
      )}

      {/* Model Parameters */}
      {selectedModel && (
        <section className="card params-card">
          <div className="section-label">{selectedModel.name} Settings</div>

          <div className="param-group">
            <div className="param-header">
              <span className="param-label">Music Description</span>
              <span className="param-counter">{description.length}/{selectedModel.promptCharacterLimit}</span>
            </div>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder='e.g. "Upbeat electronic track for a product launch, building energy with a massive drop"'
              rows={3}
              maxLength={selectedModel.promptCharacterLimit}
            />
            {description.length < selectedModel.minPromptLength && description.length > 0 && (
              <p className="param-hint warn">Minimum {selectedModel.minPromptLength} characters required</p>
            )}
          </div>

          <div className="chips-section">
            <span className="chips-label">Genre</span>
            <div className="chips">
              {genres.map(g => (
                <button key={g} type="button" className={`chip ${genre === g ? 'active' : ''}`} onClick={() => setGenre(genre === g ? null : g)}>{g}</button>
              ))}
            </div>
          </div>

          <div className="chips-section">
            <span className="chips-label">Mood</span>
            <div className="chips">
              {moods.map(m => (
                <button key={m} type="button" className={`chip ${mood === m ? 'active' : ''}`} onClick={() => setMood(mood === m ? null : m)}>{m}</button>
              ))}
            </div>
          </div>

          <div className="chips-section">
            <span className="chips-label">Duration</span>
            <div className="chips">
              {durationOpts.map(d => (
                <button key={d} type="button" className={`chip ${duration === d ? 'active' : ''}`} onClick={() => setDuration(d)}>{formatDuration(d)}</button>
              ))}
            </div>
          </div>

          {selectedModel.supportsForceInstrumental && (
            <div className="param-group">
              <span className="param-label">Vocal Mode</span>
              <div className="toggle-row">
                <button type="button" className={`toggle-btn ${instrumental ? 'active' : ''}`} onClick={() => { setInstrumental(true); setShowLyrics(false); setLyrics(''); }}>
                  Instrumental Only
                </button>
                <button type="button" className={`toggle-btn ${!instrumental ? 'active' : ''}`} onClick={() => setInstrumental(false)}>
                  With Vocals
                </button>
              </div>
            </div>
          )}

          {selectedModel.supportsLyrics && (
            <div className="param-group">
              <div className="param-header">
                <span className="param-label">
                  {selectedModel.lyricsRequired ? 'Lyrics (Required)' : 'Lyrics (Optional)'}
                </span>
                {(showLyrics || selectedModel.lyricsRequired) && selectedModel.lyricsCharacterLimit && (
                  <span className="param-counter">{lyrics.length}/{selectedModel.lyricsCharacterLimit}</span>
                )}
              </div>
              {!selectedModel.lyricsRequired && (
                <button type="button" className="lyrics-toggle" onClick={() => setShowLyrics(!showLyrics)}>
                  {showLyrics ? 'Remove lyrics' : '+ Add custom lyrics'}
                </button>
              )}
              {(showLyrics || selectedModel.lyricsRequired) && (
                <textarea
                  className="lyrics-textarea"
                  value={lyrics}
                  onChange={e => setLyrics(e.target.value)}
                  placeholder={selectedModel.lyricsRequired
                    ? '[Verse 1]\nYour lyrics here...\n\n[Chorus]\nHook goes here...'
                    : 'Verse 1: Walking through the city lights...'}
                  rows={6}
                  maxLength={selectedModel.lyricsCharacterLimit || 4096}
                />
              )}
              {selectedModel.lyricsRequired && !lyrics.trim() && (
                <p className="param-hint warn">This model requires lyrics to generate music.</p>
              )}
            </div>
          )}

          {selectedModel.voices.length > 0 && (
            <div className="param-group">
              <span className="param-label">Voice</span>
              <select value={voice} onChange={e => setVoice(e.target.value)} className="param-select">
                {selectedModel.voices.map(v => (
                  <option key={v} value={v}>
                    {v}{v === selectedModel.defaultVoice ? ' (default)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedModel.supportsSpeed && (
            <div className="param-group">
              <div className="param-header">
                <span className="param-label">Speed</span>
                <span className="param-value">{speed.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min={selectedModel.minSpeed ?? 0.25}
                max={selectedModel.maxSpeed ?? 4}
                step={0.05}
                value={speed}
                onChange={e => setSpeed(parseFloat(e.target.value))}
                className="param-slider"
              />
              <div className="slider-labels">
                <span>{selectedModel.minSpeed ?? 0.25}x</span>
                <span>Normal</span>
                <span>{selectedModel.maxSpeed ?? 4}x</span>
              </div>
            </div>
          )}

          <div className="param-info-row">
            <div className="param-info-item">
              <span className="param-info-label">Format</span>
              <span className="param-info-value">{selectedModel.supportedFormats.map(f => f.toUpperCase()).join(', ')}</span>
            </div>
            <div className="param-info-item">
              <span className="param-info-label">Privacy</span>
              <span className="param-info-value">{selectedModel.privacy}</span>
            </div>
            {priceEstimate && (
              <div className="param-info-item">
                <span className="param-info-label">Est. Cost</span>
                <span className="param-info-value price">{priceEstimate}</span>
              </div>
            )}
          </div>

          <div className="action-row">
            {isGenerating ? (
              <button type="button" className="btn-cancel" onClick={cancelGeneration}>
                Cancel
              </button>
            ) : null}
            <button type="button" className="btn-generate" onClick={generate} disabled={!canGenerate}>
              {isGenerating ? statusText : `Generate with ${selectedModel.name}`}
            </button>
          </div>

          {error && <p className="error-msg">{error}</p>}
        </section>
      )}

      {!modelsLoading && models.length === 0 && apiKey && (
        <section className="card">
          <p className="hint">No music models available. Check your API key or try again.</p>
        </section>
      )}

      {/* Progress */}
      {isGenerating && (
        <section className="card progress-card">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <p className="progress-text">{statusText}</p>
        </section>
      )}

      {/* Player + Generation Details */}
      {currentAudioUrl && status === 'completed' && currentTrack && (
        <section className="card player-card">
          <div className="player-header">
            <div>
              <h3>Your Track is Ready</h3>
              <p className="player-prompt">&ldquo;{currentTrack.prompt}&rdquo;</p>
            </div>
            <button type="button" className="btn-download" onClick={() => downloadAudio(currentAudioUrl, currentTrack.prompt.slice(0, 30).replace(/\s+/g, '-'), currentTrack.format)}>
              Download .{currentTrack.format}
            </button>
          </div>

          <audio ref={audioRef} src={currentAudioUrl} controls className="audio-player" />

          {/* Generation details */}
          <div className="generation-details">
            <div className="gen-detail-row">
              <span className="gen-detail-label">Model</span>
              <span className="gen-detail-value">{currentTrack.modelName}</span>
            </div>
            <div className="gen-detail-row">
              <span className="gen-detail-label">Duration</span>
              <span className="gen-detail-value">{formatDuration(currentTrack.duration)}</span>
            </div>
            <div className="gen-detail-row">
              <span className="gen-detail-label">Format</span>
              <span className="gen-detail-value">{currentTrack.format.toUpperCase()}</span>
            </div>
            {currentTrack.genre && (
              <div className="gen-detail-row">
                <span className="gen-detail-label">Genre</span>
                <span className="gen-detail-value">{currentTrack.genre}</span>
              </div>
            )}
            {currentTrack.mood && (
              <div className="gen-detail-row">
                <span className="gen-detail-label">Mood</span>
                <span className="gen-detail-value">{currentTrack.mood}</span>
              </div>
            )}
          </div>

          <details className="prompt-details">
            <summary>View optimized prompt sent to AI</summary>
            <div className="prompt-compare">
              <div className="prompt-box">
                <span className="prompt-box-label">Your input</span>
                <p>{currentTrack.prompt}</p>
              </div>
              <div className="prompt-box optimized">
                <span className="prompt-box-label">AI-optimized prompt</span>
                <p>{currentTrack.optimizedPrompt}</p>
              </div>
            </div>
          </details>
        </section>
      )}

      {/* History */}
      {tracks.length > 0 && (
        <section className="card history-card">
          <div className="section-label">Recent Tracks</div>
          <audio ref={historyAudioRef} onEnded={() => setPlayingTrackId(null)} style={{ display: 'none' }} />
          <div className="history-list">
            {tracks.map(track => {
              const hasAudio = !!track.audioBlobUrl;
              return (
                <div key={track.id} className="history-item">
                  <button type="button" className={`history-play ${!hasAudio ? 'disabled' : ''}`} onClick={() => hasAudio && playHistoryTrack(track)} disabled={!hasAudio}>
                    {playingTrackId === track.id ? '||' : '\u25B6'}
                  </button>
                  <div className="history-info">
                    <span className="history-prompt">{track.prompt}</span>
                    <span className="history-meta">
                      {track.modelName} &middot; {formatDuration(track.duration)} &middot; {track.format.toUpperCase()} &middot; {new Date(track.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {hasAudio && (
                    <button type="button" className="history-download" onClick={() => downloadAudio(track.audioBlobUrl, track.prompt.slice(0, 20).replace(/\s+/g, '-'), track.format)}>
                      Save
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <footer className="app-footer">
        <p>Powered by <a href="https://venice.ai" target="_blank" rel="noopener noreferrer">Venice AI</a></p>
      </footer>
    </main>
  );
}
