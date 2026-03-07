'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';

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
    summary: 'Describe a feeling, get polished musical directions instantly.'
  },
  {
    name: 'Guided Pro',
    summary: 'Build tracks with structure, mood, arrangement, and producer logic.'
  },
  {
    name: 'Advanced Studio',
    summary: 'Expose every important control without making the interface noisy.'
  }
];

const workspaceCards = [
  {
    title: 'Creative Brief',
    text: 'Turn vague ideas into clear musical direction using Venice as your producer.'
  },
  {
    title: 'Prompt Intelligence',
    text: 'Rewrite prompts, suggest arrangement changes, and iterate toward stronger output.'
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

const featureGroups = [
  {
    title: 'Project Workspace',
    items: ['Creative brief', 'Genre + mood tags', 'Track history', 'Export log']
  },
  {
    title: 'Pro Development',
    items: ['Prompt builder', 'Structure planner', 'Version compare', 'Producer notes']
  },
  {
    title: 'Venice Layer',
    items: ['Lyrics help', 'Prompt optimization', 'Creative critique', 'Image generation']
  }
];

const apiSteps = [
  'Create a Venice account and open your API settings.',
  'Generate a Venice API key for your own use.',
  'Paste that key into the secure field in the app. In this MVP it is stored in your browser on your machine.',
  'Use Venice Producer to turn your brief into pro-grade prompt directions, lyrics guidance, and refinement ideas.'
];

const defaultBrief = 'Create a premium cinematic electronic track for a biotech launch film. Clear, uplifting, restrained, human, modern.';

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
    brief: value.brief || defaultBrief,
    useCase: value.useCase || 'General music creation',
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
  const [brief, setBrief] = useState(defaultBrief);
  const [useCase, setUseCase] = useState('Launch film / brand soundtrack');
  const [mode, setMode] = useState('Guided Pro');
  const [lyricNotes, setLyricNotes] = useState('Optional future female vocal textures, hopeful but restrained language.');
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

  const tags = useMemo(() => ['premium', 'cinematic', 'electronic', 'clear', 'focused'], []);
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
    setBrief(project.brief);
    setUseCase(project.useCase);
    setMode(project.mode);
    setLyricNotes(project.lyricNotes);
    setImageUrl(project.imageUrl);
    setPlan(project.plan);
    setLyricsDraft(project.lyricsDraft || emptyLyrics);
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
    setBrief(snapshot.brief);
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

  async function handleProducerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
    <main className="page-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark" />
          <div>
            <p className="eyebrow">Studio Eleven Venice</p>
            <h1 className="brand-name">Vivmusic</h1>
          </div>
        </div>

        <nav className="topnav">
          <a href="#workspace">Workspace</a>
          <a href="#studio">Studio</a>
          <a href="#guidance">Guidance</a>
          <a href="#api-key">API Key</a>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Create music like a pro, without fighting pro software</p>
          <h2>Clear, focused music development powered by Venice.</h2>
          <p className="hero-text">
            Vivmusic is a minimal AI music studio built for fast creation, structured iteration, and real producer-style guidance.
            This MVP uses <strong>browser-local JSON storage</strong>, <strong>no auth</strong>, and is ready for <strong>Railway deployment</strong>.
          </p>

          <div className="hero-actions">
            <a className="primary-button" href="#studio">Open the studio</a>
            <a className="ghost-button" href="#api-key">How to add your API key</a>
          </div>
          {statusMessage ? <p className="status-pill">{statusMessage}</p> : null}
        </div>

        <div className="hero-visual">
          <div className="hero-image-card">
            <img src="/generated/hero-studio.webp" alt="Vivmusic studio visual" />
          </div>

          <div className="floating-panel player-panel">
            <div className="panel-header">
              <span className="panel-dot" />
              <span>Current Project</span>
            </div>
            <div className="waveform">
              <span /><span /><span /><span /><span /><span />
              <span /><span /><span /><span /><span /><span />
            </div>
            <div className="player-meta">
              <strong>{title}</strong>
              <span>{mode} • browser-local workflow • Venice producer active</span>
            </div>
          </div>

          <div className="floating-panel suggestion-panel">
            <p className="panel-label">Venice Producer</p>
            <p>{plan.producerNotes[0] || 'Reduce the intro density and widen the harmonic bed for a more premium lift.'}</p>
          </div>
        </div>
      </section>

      <section className="mode-strip">
        {quickModes.map((item) => (
          <article key={item.name} className="mode-card">
            <p className="mode-title">{item.name}</p>
            <p>{item.summary}</p>
          </article>
        ))}
      </section>

      <section id="workspace" className="content-section two-column">
        <div>
          <p className="eyebrow">Workspace</p>
          <h3>A music project environment, not just a generator.</h3>
          <p className="section-copy">
            Every track belongs to a project with prompts, notes, browser-local versions, exports, lyrics drafts, and producer feedback.
            No login, no account setup, no backend database required for the MVP.
          </p>

          <div className="workspace-grid">
            {workspaceCards.map((card) => (
              <article key={card.title} className="workspace-card">
                <h4>{card.title}</h4>
                <p>{card.text}</p>
              </article>
            ))}
          </div>
        </div>

        <aside className="studio-preview">
          <div className="preview-header">
            <span className="preview-chip">Fastest MVP</span>
            <span className="preview-status">Railway ready</span>
          </div>

          <div className="preview-panel brief-panel">
            <p className="panel-label">Project Storage</p>
            <strong>{projects.length} saved in this browser</strong>
            <p>Projects are stored locally on the user’s machine in browser storage and can be exported/imported as JSON.</p>
          </div>

          <div className="preview-panel controls-panel">
            <p className="panel-label">MVP Decisions</p>
            <div className="control-row"><span>Storage</span><b>Browser local JSON</b></div>
            <div className="control-row"><span>Auth</span><b>None</b></div>
            <div className="control-row"><span>Deploy</span><b>Railway</b></div>
            <div className="control-row"><span>Music engine</span><b>Future integration</b></div>
          </div>
        </aside>
      </section>

      <section id="studio" className="content-section studio-section">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Studio Surface</p>
            <h3>Minimal UI. Clean hierarchy. No wasted motion.</h3>
          </div>
          <p className="section-side-note">
            The interface keeps all advanced thinking available while hiding unnecessary complexity. Every panel exists to support better music decisions.
          </p>
        </div>

        <div className="studio-canvas">
          <div className="canvas-left">
            <form className="canvas-card input-card" onSubmit={handleProducerSubmit}>
              <p className="panel-label">Venice Producer Workspace</p>
              <h4>Build a real music brief</h4>
              <p className="muted-copy">
                Add your own Venice API key, describe the project, and generate producer-grade prompt direction, arrangement thinking, and lyrics support.
              </p>

              <div className="form-grid">
                <label>
                  <span className="field-label">Project Title</span>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Biotech Launch Theme" />
                </label>
                <label>
                  <span className="field-label">Use Case</span>
                  <input value={useCase} onChange={(e) => setUseCase(e.target.value)} placeholder="Launch film / podcast / trailer" />
                </label>
              </div>

              <label>
                <span className="field-label">Studio Mode</span>
                <select value={mode} onChange={(e) => setMode(e.target.value)}>
                  <option>Simple Create</option>
                  <option>Guided Pro</option>
                  <option>Advanced Studio</option>
                </select>
              </label>

              <label>
                <span className="field-label">Creative Brief</span>
                <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={6} />
              </label>

              <label>
                <span className="field-label">Lyrics / Vocal Direction</span>
                <textarea value={lyricNotes} onChange={(e) => setLyricNotes(e.target.value)} rows={4} />
              </label>

              <div className="pill-row">
                {tags.map((tag) => (
                  <span className="tag" key={tag}>{tag}</span>
                ))}
              </div>

              <div className="hero-actions compact-actions">
                <button type="submit" className="primary-button" disabled={planLoading || !apiKey}>
                  {planLoading ? 'Generating producer plan…' : 'Generate producer plan'}
                </button>
                <button type="button" className="ghost-button" onClick={handleMoodboardGenerate} disabled={imageLoading || !apiKey}>
                  {imageLoading ? 'Generating moodboard…' : 'Generate moodboard image'}
                </button>
                <button type="button" className="ghost-button" onClick={handleLyricsGenerate} disabled={lyricsLoading || !apiKey}>
                  {lyricsLoading ? 'Generating lyrics workspace…' : 'Generate lyrics draft'}
                </button>
              </div>
            </form>

            <div className="canvas-card local-project-card">
              <div className="section-inline-header">
                <div>
                  <p className="panel-label">Browser-Local Projects</p>
                  <h4>Save, load, export, and import</h4>
                </div>
                <div className="mini-actions">
                  <button type="button" className="ghost-button small-button" onClick={saveProjectLocally}>Save project</button>
                  <button type="button" className="ghost-button small-button" onClick={exportCurrentProject}>Export JSON</button>
                  <button type="button" className="ghost-button small-button" onClick={() => importRef.current?.click()}>Import JSON</button>
                  <button type="button" className="ghost-button small-button danger-button" onClick={clearAllProjects}>Clear all</button>
                </div>
              </div>

              <input ref={importRef} type="file" accept="application/json" className="hidden-input" onChange={handleImportProject} />

              {projects.length ? (
                <div className="saved-projects-grid">
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

            <div className="canvas-card snapshot-card">
              <div className="section-inline-header">
                <div>
                  <p className="panel-label">Version Snapshots</p>
                  <h4>Capture milestones while you iterate</h4>
                </div>
              </div>

              <div className="snapshot-form-row">
                <input
                  value={snapshotLabel}
                  onChange={(e) => setSnapshotLabel(e.target.value)}
                  placeholder="Snapshot label, e.g. Bigger chorus / Cleaner intro"
                />
                <button type="button" className="ghost-button small-button" onClick={createSnapshot}>Create snapshot</button>
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

            <div className="canvas-card feature-card-grid">
              {featureGroups.map((group) => (
                <article key={group.title} className="feature-card">
                  <h4>{group.title}</h4>
                  <ul>
                    {group.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>

          <div className="canvas-right">
            <div className="canvas-card image-card dynamic-image-card">
              <img src={imageUrl} alt="Minimal music moodboard" />
            </div>

            <div className="canvas-card producer-output-card">
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

            <div className="canvas-card lyrics-card">
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
          </div>
        </div>
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
