'use client';

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';

type ProducerPlan = {
  optimizedPrompt: string;
  arrangement: string[];
  instrumentation: string[];
  lyricsDirection: string[];
  producerNotes: string[];
  nextRefinements: string[];
};

type LyricsDraft = {
  title: string;
  hook: string;
  sections: string[];
  performanceNotes: string[];
};

type ProjectSnapshot = {
  id: string;
  label: string;
  createdAt: string;
  plan: ProducerPlan;
  lyricNotes: string;
  lyricsDraft: LyricsDraft;
  brief: string;
};

type SavedProject = {
  id: string;
  title: string;
  brief: string;
  useCase: string;
  mode: string;
  lyricNotes: string;
  imageUrl: string;
  plan: ProducerPlan;
  lyricsDraft: LyricsDraft;
  snapshots: ProjectSnapshot[];
  savedAt: string;
};

const STORAGE_KEY = 'vivmusic.projects.v1';
const API_KEY_STORAGE = 'vivmusic.veniceApiKey';

const quickModes = [
  {
    name: 'Simple Create',
    summary: 'Choose a vibe and get polished musical direction instantly.'
  },
  {
    name: 'Guided Pro',
    summary: 'Use dashboard controls for structure, mood, arrangement, and producer logic.'
  },
  {
    name: 'Advanced Studio',
    summary: 'Expose more options only when you want deeper control.'
  }
] as const;

const useCaseOptions = [
  'Launch film / brand soundtrack',
  'Podcast intro',
  'Product trailer',
  'Meditation / ambient bed',
  'Game cinematic cue',
  'Ad music / social clip'
] as const;

const genreOptions = [
  'Cinematic Electronic',
  'Ambient',
  'Orchestral',
  'Lo-fi',
  'Indie Pop',
  'Trailer Score'
] as const;

const moodOptions = [
  'Focused',
  'Uplifting',
  'Premium',
  'Emotional',
  'Dark',
  'Futuristic'
] as const;

const energyOptions = ['Low', 'Medium', 'High'] as const;
const vocalOptions = ['Instrumental', 'Optional Vocals', 'Vocal Forward'] as const;
const lengthOptions = ['30 sec', '45 sec', '60 sec', '90 sec'] as const;
const structureOptions = [
  'Intro → Lift → Resolve',
  'Build → Chorus → Outro',
  'Loopable Ambient Flow',
  'Trailer Rise → Impact → Tail'
] as const;
const quickRefinementOptions = [
  'More emotional',
  'Cleaner intro',
  'Bigger lift',
  'Less clutter',
  'More premium',
  'More futuristic'
] as const;

const workspaceCards = [
  {
    title: 'Dashboard-first',
    text: 'Use presets, chips, and guided selectors instead of writing long prompts from scratch.'
  },
  {
    title: 'Prompt Intelligence',
    text: 'Venice converts your selections into stronger musical direction automatically.'
  },
  {
    title: 'Browser-Local Projects',
    text: 'Save, reload, export, and import projects right in the browser with no auth required.'
  }
];

const producerSuggestions = [
  'Start with less instrumentation in the intro so the lift feels earned.',
  'Use contrast between sections instead of constant maximum intensity.',
  'For premium brand music, simplify percussion and widen the harmonic bed.',
  'If vocals feel vague, Venice can suggest hook language and lyrical framing.'
];

const apiSteps = [
  'Create a Venice account and open your API settings.',
  'Generate a Venice API key for your own use.',
  'Paste that key into the secure field in the app. In this MVP it is stored in your browser on your machine.',
  'Use Venice Producer to turn your dashboard selections into pro-grade music direction, lyrics guidance, and refinement ideas.'
];

const emptyPlan: ProducerPlan = {
  optimizedPrompt: '',
  arrangement: [],
  instrumentation: [],
  lyricsDirection: [],
  producerNotes: [],
  nextRefinements: []
};

const emptyLyrics: LyricsDraft = {
  title: '',
  hook: '',
  sections: [],
  performanceNotes: []
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'project';
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function normalizeProject(value: Partial<SavedProject>): SavedProject {
  return {
    id: value.id || `${slugify(value.title || 'project')}-${Date.now()}`,
    title: value.title || 'Untitled Project',
    brief: value.brief || '',
    useCase: value.useCase || 'Launch film / brand soundtrack',
    mode: value.mode || 'Guided Pro',
    lyricNotes: value.lyricNotes || '',
    imageUrl: value.imageUrl || '/generated/moodboard-minimal.webp',
    plan: value.plan || emptyPlan,
    lyricsDraft: value.lyricsDraft || emptyLyrics,
    snapshots: Array.isArray(value.snapshots) ? value.snapshots : [],
    savedAt: value.savedAt || new Date().toISOString()
  };
}

export default function HomePage() {
  const [apiKey, setApiKey] = useState('');
  const [title, setTitle] = useState('Biotech Launch Theme');
  const [useCase, setUseCase] = useState<(typeof useCaseOptions)[number]>('Launch film / brand soundtrack');
  const [mode, setMode] = useState<(typeof quickModes)[number]['name']>('Guided Pro');
  const [genre, setGenre] = useState<(typeof genreOptions)[number]>('Cinematic Electronic');
  const [mood, setMood] = useState<(typeof moodOptions)[number]>('Focused');
  const [energy, setEnergy] = useState<(typeof energyOptions)[number]>('Medium');
  const [vocalMode, setVocalMode] = useState<(typeof vocalOptions)[number]>('Optional Vocals');
  const [length, setLength] = useState<(typeof lengthOptions)[number]>('60 sec');
  const [structure, setStructure] = useState<(typeof structureOptions)[number]>('Intro → Lift → Resolve');
  const [briefNotes, setBriefNotes] = useState('Clear, uplifting, restrained, human, modern.');
  const [lyricNotes, setLyricNotes] = useState('Hopeful but restrained language with premium biotech energy.');
  const [imageUrl, setImageUrl] = useState('/generated/moodboard-minimal.webp');
  const [plan, setPlan] = useState<ProducerPlan>(emptyPlan);
  const [lyricsDraft, setLyricsDraft] = useState<LyricsDraft>(emptyLyrics);
  const [planLoading, setPlanLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [error, setError] = useState('');
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState('');
  const [snapshotLabel, setSnapshotLabel] = useState('');
  const importRef = useRef<HTMLInputElement | null>(null);

  const brief = useMemo(() => {
    return [
      `${genre} music for ${useCase}.`,
      `Mood: ${mood}.`,
      `Energy: ${energy}.`,
      `Vocal style: ${vocalMode}.`,
      `Length: ${length}.`,
      `Structure: ${structure}.`,
      briefNotes
    ].join(' ');
  }, [briefNotes, energy, genre, length, mood, structure, useCase, vocalMode]);

  const tags = useMemo(() => [genre, mood, energy, vocalMode, structure], [energy, genre, mood, structure, vocalMode]);
  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId),
    [projects, activeProjectId]
  );

  useEffect(() => {
    try {
      const storedProjects = localStorage.getItem(STORAGE_KEY);
      const storedKey = localStorage.getItem(API_KEY_STORAGE);
      if (storedProjects) {
        const parsed = JSON.parse(storedProjects) as Partial<SavedProject>[];
        setProjects(parsed.map(normalizeProject));
      }
      if (storedKey) {
        setApiKey(storedKey);
      }
    } catch {
      // ignore malformed local state for MVP
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    if (apiKey) {
      localStorage.setItem(API_KEY_STORAGE, apiKey);
    } else {
      localStorage.removeItem(API_KEY_STORAGE);
    }
  }, [apiKey]);

  function buildProjectRecord(): SavedProject {
    return {
      id: activeProjectId || `${slugify(title)}-${Date.now()}`,
      title,
      brief,
      useCase,
      mode,
      lyricNotes,
      imageUrl,
      plan,
      lyricsDraft,
      snapshots: activeProject?.snapshots || [],
      savedAt: new Date().toISOString()
    };
  }

  function loadProject(project: SavedProject) {
    setActiveProjectId(project.id);
    setTitle(project.title);
    setUseCase(project.useCase as (typeof useCaseOptions)[number]);
    setMode(project.mode as (typeof quickModes)[number]['name']);
    setLyricNotes(project.lyricNotes);
    setImageUrl(project.imageUrl);
    setPlan(project.plan);
    setLyricsDraft(project.lyricsDraft || emptyLyrics);
    setBriefNotes(project.brief);
    setStatusMessage(`Loaded ${project.title}`);
    setError('');
  }

  function saveProjectLocally() {
    const record = buildProjectRecord();
    setActiveProjectId(record.id);
    setProjects((current) => {
      const existing = current.filter((item) => item.id !== record.id);
      return [record, ...existing].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
    });
    setStatusMessage(`Saved ${record.title} to this browser`);
  }

  function createSnapshot() {
    const label = snapshotLabel.trim() || `Snapshot ${new Date().toLocaleTimeString()}`;
    const record = buildProjectRecord();
    const snapshot: ProjectSnapshot = {
      id: `${record.id}-snapshot-${Date.now()}`,
      label,
      createdAt: new Date().toISOString(),
      plan,
      lyricNotes,
      lyricsDraft,
      brief
    };

    const updatedProject: SavedProject = {
      ...record,
      snapshots: [snapshot, ...(record.snapshots || [])],
      savedAt: new Date().toISOString()
    };

    setActiveProjectId(updatedProject.id);
    setProjects((current) => {
      const existing = current.filter((item) => item.id !== updatedProject.id);
      return [updatedProject, ...existing].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
    });
    setSnapshotLabel('');
    setStatusMessage(`Created snapshot: ${label}`);
  }

  function restoreSnapshot(snapshot: ProjectSnapshot) {
    setPlan(snapshot.plan);
    setLyricNotes(snapshot.lyricNotes);
    setLyricsDraft(snapshot.lyricsDraft || emptyLyrics);
    setBriefNotes(snapshot.brief);
    setStatusMessage(`Restored snapshot: ${snapshot.label}`);
  }

  function exportCurrentProject() {
    const record = buildProjectRecord();
    downloadJson(`${slugify(record.title)}.json`, record);
    setStatusMessage(`Exported ${record.title} as JSON`);
  }

  function clearAllProjects() {
    setProjects([]);
    localStorage.removeItem(STORAGE_KEY);
    setActiveProjectId('');
    setStatusMessage('Cleared all browser-local projects');
  }

  function applyQuickRefinement(refinement: string) {
    setBriefNotes((current) => `${current} ${refinement}.`);
    setStatusMessage(`Applied refinement: ${refinement}`);
  }

  async function handleProducerGenerate() {
    setError('');
    setStatusMessage('');
    setPlanLoading(true);

    try {
      const response = await fetch('/api/venice/producer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          title,
          brief,
          useCase,
          mode,
          tags,
          lyricNotes
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Unable to generate producer plan.');
      }

      setPlan(data);
      setStatusMessage('Producer plan generated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setPlanLoading(false);
    }
  }

  async function handleMoodboardGenerate() {
    setError('');
    setStatusMessage('');
    setImageLoading(true);

    try {
      const response = await fetch('/api/venice/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, brief })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Unable to generate moodboard image.');
      }

      setImageUrl(data.dataUrl);
      setStatusMessage('Moodboard image generated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setImageLoading(false);
    }
  }

  async function handleLyricsGenerate() {
    setError('');
    setStatusMessage('');
    setLyricsLoading(true);

    try {
      const response = await fetch('/api/venice/lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          title,
          brief,
          useCase,
          lyricNotes,
          optimizedPrompt: plan.optimizedPrompt
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Unable to generate lyrics workspace draft.');
      }

      setLyricsDraft(data);
      setStatusMessage('Lyrics workspace draft generated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLyricsLoading(false);
    }
  }

  async function handleImportProject(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = normalizeProject(JSON.parse(text));

      setProjects((current) => {
        const existing = current.filter((item) => item.id !== parsed.id);
        return [parsed, ...existing].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
      });
      loadProject(parsed);
      setStatusMessage(`Imported ${parsed.title}`);
    } catch {
      setError('That JSON file could not be imported.');
    } finally {
      if (importRef.current) importRef.current.value = '';
    }
  }

  return (
    <main className="page-shell dashboard-shell">
      <header className="topbar dashboard-topbar">
        <div className="brand-lockup">
          <div className="brand-mark" />
          <div>
            <p className="eyebrow">Studio Eleven Venice</p>
            <h1 className="brand-name">Vivmusic</h1>
          </div>
        </div>

        <nav className="topnav">
          <a href="#dashboard">Dashboard</a>
          <a href="#guidance">Guidance</a>
          <a href="#api-key">API Key</a>
        </nav>
      </header>

      <section className="hero dashboard-hero">
        <div className="hero-copy">
          <p className="eyebrow">Dashboard-first music development</p>
          <h2>Pick. Shape. Refine. Create.</h2>
          <p className="hero-text">
            Vivmusic now behaves more like a dashboard — fewer blank text fields, more smart controls, faster choices, and less typing to get to a strong musical direction.
          </p>
          <div className="hero-actions">
            <button className="primary-button" onClick={handleProducerGenerate} disabled={planLoading || !apiKey}>
              {planLoading ? 'Generating…' : 'Generate plan'}
            </button>
            <button className="ghost-button" onClick={saveProjectLocally}>Save project</button>
          </div>
          {statusMessage ? <p className="status-pill">{statusMessage}</p> : null}
        </div>

        <div className="hero-visual dashboard-hero-visual">
          <div className="hero-image-card">
            <img src={imageUrl} alt="Vivmusic dashboard visual" />
          </div>
          <div className="floating-panel suggestion-panel">
            <p className="panel-label">Venice Producer</p>
            <p>{plan.producerNotes[0] || 'Choose your use case, style, mood, and structure. Venice will do the heavy lifting from there.'}</p>
          </div>
        </div>
      </section>

      <section id="dashboard" className="dashboard-grid">
        <aside className="dashboard-sidebar canvas-card">
          <div className="sidebar-section">
            <p className="panel-label">Quick Create</p>
            <label>
              <span className="field-label">Project Title</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Project title" />
            </label>
          </div>

          <div className="sidebar-section">
            <p className="panel-label">Use Case</p>
            <div className="choice-grid two-col">
              {useCaseOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`choice-chip ${useCase === option ? 'active' : ''}`}
                  onClick={() => setUseCase(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="sidebar-section">
            <p className="panel-label">Mode</p>
            <div className="segmented-row">
              {quickModes.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  className={`segment-chip ${mode === item.name ? 'active' : ''}`}
                  onClick={() => setMode(item.name)}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>

          <div className="sidebar-section compact-button-stack">
            <button type="button" className="primary-button full-button" onClick={handleProducerGenerate} disabled={planLoading || !apiKey}>
              {planLoading ? 'Generating producer plan…' : 'Generate producer plan'}
            </button>
            <button type="button" className="ghost-button full-button" onClick={handleMoodboardGenerate} disabled={imageLoading || !apiKey}>
              {imageLoading ? 'Generating moodboard…' : 'Generate moodboard image'}
            </button>
            <button type="button" className="ghost-button full-button" onClick={handleLyricsGenerate} disabled={lyricsLoading || !apiKey}>
              {lyricsLoading ? 'Generating lyrics…' : 'Generate lyrics draft'}
            </button>
          </div>
        </aside>

        <section className="dashboard-main">
          <div className="canvas-card dashboard-panel settings-panel">
            <div className="section-inline-header">
              <div>
                <p className="panel-label">Music Direction Dashboard</p>
                <h3 className="panel-title">Choose the sound without overtyping</h3>
              </div>
              <div className="mini-actions">
                <button type="button" className="ghost-button small-button" onClick={saveProjectLocally}>Save</button>
                <button type="button" className="ghost-button small-button" onClick={exportCurrentProject}>Export JSON</button>
                <button type="button" className="ghost-button small-button" onClick={() => importRef.current?.click()}>Import JSON</button>
              </div>
            </div>

            <input ref={importRef} type="file" accept="application/json" className="hidden-input" onChange={handleImportProject} />

            <div className="dashboard-control-grid">
              <DashboardChoiceGroup title="Genre" options={genreOptions} value={genre} onSelect={setGenre} />
              <DashboardChoiceGroup title="Mood" options={moodOptions} value={mood} onSelect={setMood} />
              <DashboardChoiceGroup title="Energy" options={energyOptions} value={energy} onSelect={setEnergy} compact />
              <DashboardChoiceGroup title="Vocals" options={vocalOptions} value={vocalMode} onSelect={setVocalMode} compact />
              <DashboardChoiceGroup title="Length" options={lengthOptions} value={length} onSelect={setLength} compact />
              <DashboardChoiceGroup title="Structure" options={structureOptions} value={structure} onSelect={setStructure} />
            </div>

            <div className="dashboard-notes-grid">
              <label>
                <span className="field-label">Extra Brief Notes</span>
                <textarea value={briefNotes} onChange={(e) => setBriefNotes(e.target.value)} rows={4} placeholder="Optional detail if you want it." />
              </label>
              <label>
                <span className="field-label">Lyrics / Vocal Direction</span>
                <textarea value={lyricNotes} onChange={(e) => setLyricNotes(e.target.value)} rows={4} placeholder="Optional vocal angle, hook idea, language, or emotional framing." />
              </label>
            </div>

            <div className="brief-preview-box">
              <span className="field-label">Auto-built creative brief</span>
              <div className="output-box">{brief}</div>
            </div>
          </div>

          <div className="canvas-card dashboard-panel quick-refine-panel">
            <p className="panel-label">Quick refinements</p>
            <div className="choice-grid three-col">
              {quickRefinementOptions.map((option) => (
                <button key={option} type="button" className="choice-chip" onClick={() => applyQuickRefinement(option)}>
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="canvas-card dashboard-panel producer-output-card">
            <p className="panel-label">Producer Output</p>
            {error ? <p className="error-copy">{error}</p> : null}

            <div className="output-block">
              <span className="field-label">Optimized Prompt</span>
              <div className="output-box">{plan.optimizedPrompt || 'Your optimized prompt will appear here once Venice Producer runs.'}</div>
            </div>

            <div className="output-columns">
              <OutputList title="Arrangement" items={plan.arrangement} fallback="Section logic and pacing guidance will appear here." />
              <OutputList title="Instrumentation" items={plan.instrumentation} fallback="Suggested instrumentation will appear here." />
              <OutputList title="Lyrics Direction" items={plan.lyricsDirection} fallback="Lyrics / vocal suggestions will appear here." />
              <OutputList title="Producer Notes" items={plan.producerNotes} fallback="Critical producer thinking will appear here." />
            </div>
            <OutputList title="Next Refinements" items={plan.nextRefinements} fallback="Quick next-step refinements will appear here." />
          </div>
        </section>

        <aside className="dashboard-right-rail">
          <div className="canvas-card right-rail-card">
            <p className="panel-label">Lyrics Workspace</p>
            <div className="output-block">
              <span className="field-label">Draft Title</span>
              <div className="output-box">{lyricsDraft.title || 'Your Venice-generated lyrics draft title will appear here.'}</div>
            </div>
            <div className="output-block">
              <span className="field-label">Hook</span>
              <div className="output-box">{lyricsDraft.hook || 'Your hook will appear here.'}</div>
            </div>
            <div className="output-columns lyrics-columns">
              <OutputList title="Sections" items={lyricsDraft.sections} fallback="Verse / chorus / bridge draft content will appear here." />
              <OutputList title="Performance Notes" items={lyricsDraft.performanceNotes} fallback="Delivery and performance notes will appear here." />
            </div>
          </div>

          <div className="canvas-card right-rail-card">
            <div className="section-inline-header">
              <div>
                <p className="panel-label">Project Versions</p>
                <h4>Snapshots</h4>
              </div>
            </div>
            <div className="snapshot-form-row">
              <input
                value={snapshotLabel}
                onChange={(e) => setSnapshotLabel(e.target.value)}
                placeholder="Snapshot label"
              />
              <button type="button" className="ghost-button small-button" onClick={createSnapshot}>Create</button>
            </div>

            {activeProject?.snapshots?.length ? (
              <div className="snapshot-list">
                {activeProject.snapshots.map((snapshot) => (
                  <div key={snapshot.id} className="snapshot-item">
                    <div>
                      <strong>{snapshot.label}</strong>
                      <span>{new Date(snapshot.createdAt).toLocaleString()}</span>
                    </div>
                    <button type="button" className="ghost-button small-button" onClick={() => restoreSnapshot(snapshot)}>Restore</button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted-copy compact-muted">No snapshots yet for the active project.</p>
            )}
          </div>

          <div className="canvas-card right-rail-card">
            <div className="section-inline-header">
              <div>
                <p className="panel-label">Browser-Local Projects</p>
                <h4>Recent</h4>
              </div>
              <button type="button" className="ghost-button small-button danger-button" onClick={clearAllProjects}>Clear</button>
            </div>
            {projects.length ? (
              <div className="saved-projects-grid compact-project-list">
                {projects.map((project) => (
                  <button
                    type="button"
                    key={project.id}
                    className={`saved-project-item ${project.id === activeProjectId ? 'active' : ''}`}
                    onClick={() => loadProject(project)}
                  >
                    <strong>{project.title}</strong>
                    <span>{project.mode}</span>
                    <span>{new Date(project.savedAt).toLocaleString()}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="muted-copy compact-muted">No projects saved in this browser yet.</p>
            )}
          </div>
        </aside>
      </section>

      <section id="guidance" className="content-section guidance-section">
        <div>
          <p className="eyebrow">Producer Guidance</p>
          <h3>Suggestions that feel like working with someone who knows music.</h3>
          <p className="section-copy">
            Venice should not just fill fields. It should help users think in arrangement, contrast, pacing, hook design, emotional shape, and lyrical focus.
          </p>
        </div>

        <div className="guidance-list">
          {producerSuggestions.map((suggestion) => (
            <article key={suggestion} className="guidance-item">
              <span className="guidance-index">+</span>
              <p>{suggestion}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="content-section workspace-summary-section">
        <div className="workspace-grid summary-grid">
          {workspaceCards.map((card) => (
            <article key={card.title} className="workspace-card">
              <h4>{card.title}</h4>
              <p>{card.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="api-key" className="content-section api-section">
        <div className="api-grid">
          <div className="canvas-card api-card">
            <p className="eyebrow">Bring your own API key</p>
            <h3>Add your Venice key and use the app with your own account.</h3>
            <p className="section-copy">
              Since music generation is not yet active in Venice for this setup, the current MVP uses Venice for producer intelligence, lyrics support, prompt optimization, and image generation. Later, we can connect music generation when the Venice + 11Labs pathway is ready.
            </p>

            <label>
              <span className="field-label">Venice API Key</span>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste your Venice API key"
              />
            </label>
            <p className="helper-copy">This MVP stores your key in your browser on your local machine so you do not need auth for usage.</p>
          </div>

          <div className="canvas-card api-card steps-card">
            <p className="panel-label">How to get your key</p>
            <ol className="steps-list">
              {apiSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <div className="preview-panel note-panel">
              <p className="panel-label">Deployment Note</p>
              <p>
                Railway deployment is configured for the app shell. Users can bring their own Venice API key in the browser-local MVP without needing user accounts or server-side auth.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function DashboardChoiceGroup<T extends string>({
  title,
  options,
  value,
  onSelect,
  compact = false
}: {
  title: string;
  options: readonly T[];
  value: T;
  onSelect: (value: T) => void;
  compact?: boolean;
}) {
  return (
    <div className="choice-group-card">
      <span className="field-label">{title}</span>
      <div className={`choice-grid ${compact ? 'compact-grid' : 'two-col'}`}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={`choice-chip ${value === option ? 'active' : ''}`}
            onClick={() => onSelect(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function OutputList({ title, items, fallback }: { title: string; items: string[]; fallback: string }) {
  return (
    <div className="output-list-card">
      <span className="field-label">{title}</span>
      {items.length ? (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="muted-copy compact-muted">{fallback}</p>
      )}
    </div>
  );
}
