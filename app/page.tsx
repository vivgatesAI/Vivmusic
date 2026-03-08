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

type StepId = 0 | 1 | 2 | 3 | 4;

const STORAGE_KEY = 'vivmusic.projects.v1';
const API_KEY_STORAGE = 'vivmusic.veniceApiKey';

const stepItems = [
  { id: 0 as StepId, label: 'Access', title: 'Add your Venice key' },
  { id: 1 as StepId, label: 'Project', title: 'Choose what you are making' },
  { id: 2 as StepId, label: 'Sound', title: 'Shape the sound' },
  { id: 3 as StepId, label: 'Details', title: 'Add custom notes' },
  { id: 4 as StepId, label: 'Create', title: 'Generate your outputs' }
];

const quickModes = ['Simple Create', 'Guided Pro', 'Advanced Studio'] as const;
const useCaseOptions = [
  'Launch film / brand soundtrack',
  'Podcast intro',
  'Product trailer',
  'Meditation / ambient bed',
  'Game cinematic cue',
  'Ad music / social clip'
] as const;
const genreOptions = ['Cinematic Electronic', 'Ambient', 'Orchestral', 'Lo-fi', 'Indie Pop', 'Trailer Score'] as const;
const moodOptions = ['Focused', 'Uplifting', 'Premium', 'Emotional', 'Dark', 'Futuristic'] as const;
const energyOptions = ['Low', 'Medium', 'High'] as const;
const vocalOptions = ['Instrumental', 'Optional Vocals', 'Vocal Forward'] as const;
const lengthOptions = ['30 sec', '45 sec', '60 sec', '90 sec'] as const;
const structureOptions = [
  'Intro → Lift → Resolve',
  'Build → Chorus → Outro',
  'Loopable Ambient Flow',
  'Trailer Rise → Impact → Tail'
] as const;
const quickRefinementOptions = ['More emotional', 'Cleaner intro', 'Bigger lift', 'Less clutter', 'More premium', 'More futuristic'] as const;

const producerSuggestions = [
  'Start with less instrumentation in the intro so the lift feels earned.',
  'Use contrast between sections instead of constant maximum intensity.',
  'For premium brand music, simplify percussion and widen the harmonic bed.',
  'If vocals feel vague, Venice can suggest hook language and lyrical framing.'
];

const apiSteps = [
  'Create a Venice account and open your API settings.',
  'Generate a Venice API key for your own use.',
  'Paste the key into the field below. In this MVP it is stored in your browser on your machine.',
  'Move through the studio one step at a time, then generate your producer plan, lyrics draft, and moodboard.'
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
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'project';
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
  const [step, setStep] = useState<StepId>(0);
  const [title, setTitle] = useState('Biotech Launch Theme');
  const [useCase, setUseCase] = useState<(typeof useCaseOptions)[number]>('Launch film / brand soundtrack');
  const [mode, setMode] = useState<(typeof quickModes)[number]>('Guided Pro');
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
  const [activeProjectId, setActiveProjectId] = useState('');
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
  const activeProject = useMemo(() => projects.find((project) => project.id === activeProjectId), [projects, activeProjectId]);

  useEffect(() => {
    try {
      const storedProjects = localStorage.getItem(STORAGE_KEY);
      const storedKey = localStorage.getItem(API_KEY_STORAGE);
      if (storedProjects) {
        const parsed = JSON.parse(storedProjects) as Partial<SavedProject>[];
        setProjects(parsed.map(normalizeProject));
      }
      if (storedKey) setApiKey(storedKey);
    } catch {
      // ignore malformed local state for MVP
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    if (apiKey) localStorage.setItem(API_KEY_STORAGE, apiKey);
    else localStorage.removeItem(API_KEY_STORAGE);
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
    setMode(project.mode as (typeof quickModes)[number]);
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

  function nextStep() {
    setStep((current) => (current < 4 ? ((current + 1) as StepId) : current));
  }

  function previousStep() {
    setStep((current) => (current > 0 ? ((current - 1) as StepId) : current));
  }

  async function handleProducerGenerate() {
    setError('');
    setStatusMessage('');
    setPlanLoading(true);
    try {
      const response = await fetch('/api/venice/producer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, title, brief, useCase, mode, tags, lyricNotes })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Unable to generate producer plan.');
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
      if (!response.ok) throw new Error(data?.error || 'Unable to generate moodboard image.');
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
        body: JSON.stringify({ apiKey, title, brief, useCase, lyricNotes, optimizedPrompt: plan.optimizedPrompt })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Unable to generate lyrics workspace draft.');
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
    <main className="page-shell wizard-shell">
      <header className="topbar wizard-topbar">
        <div className="brand-lockup">
          <div className="brand-mark" />
          <div>
            <p className="eyebrow">Studio Eleven Venice</p>
            <h1 className="brand-name">Vivmusic</h1>
          </div>
        </div>
        <nav className="topnav">
          <a href="#wizard">Studio Wizard</a>
          <a href="#saved-projects">Projects</a>
          <a href="#api-key">API Key</a>
        </nav>
      </header>

      <section className="hero wizard-hero">
        <div className="hero-copy">
          <p className="eyebrow">Step-by-step music development</p>
          <h2>One decision at a time.</h2>
          <p className="hero-text">
            Vivmusic now walks the user through a seamless guided flow. Users click or add a custom note, then move forward only when they’re ready. They can always go backward.
          </p>
          {statusMessage ? <p className="status-pill">{statusMessage}</p> : null}
        </div>
        <div className="hero-visual wizard-hero-visual">
          <div className="hero-image-card">
            <img src={imageUrl} alt="Vivmusic wizard visual" />
          </div>
          <div className="floating-panel suggestion-panel">
            <p className="panel-label">Venice Producer</p>
            <p>{plan.producerNotes[0] || 'Move step by step. Pick the intent, shape the sound, add custom notes, then generate.'}</p>
          </div>
        </div>
      </section>

      <section id="wizard" className="wizard-layout">
        <aside className="canvas-card wizard-sidebar">
          <p className="panel-label">Studio Flow</p>
          <div className="step-list">
            {stepItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`step-item ${step === item.id ? 'active' : ''} ${step > item.id ? 'complete' : ''}`}
                onClick={() => setStep(item.id)}
              >
                <span className="step-index">{item.id + 1}</span>
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.title}</small>
                </span>
              </button>
            ))}
          </div>
          <div className="wizard-summary">
            <p className="panel-label">Current Project</p>
            <strong>{title}</strong>
            <span>{useCase}</span>
            <span>{genre} · {mood} · {length}</span>
          </div>
        </aside>

        <section className="canvas-card wizard-main-panel">
          <div className="wizard-panel-header">
            <div>
              <p className="panel-label">{stepItems[step].label}</p>
              <h3 className="wizard-panel-title">{stepItems[step].title}</h3>
            </div>
            <div className="wizard-nav-actions">
              <button type="button" className="ghost-button small-button" onClick={previousStep} disabled={step === 0}>Back</button>
              <button type="button" className="primary-button small-button" onClick={nextStep} disabled={step === 4}>Next</button>
            </div>
          </div>

          {step === 0 && (
            <div className="wizard-step-content">
              <p className="section-copy narrow-copy">
                Add your Venice API key first. It stays stored in your browser on your machine for this no-auth MVP.
              </p>
              <label>
                <span className="field-label">Venice API Key</span>
                <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Paste your Venice API key" />
              </label>
              <ol className="steps-list">
                {apiSteps.map((stepText) => <li key={stepText}>{stepText}</li>)}
              </ol>
            </div>
          )}

          {step === 1 && (
            <div className="wizard-step-content">
              <label>
                <span className="field-label">Project Title</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Project title" />
              </label>
              <ChoiceGroup title="What are you making?" options={useCaseOptions} value={useCase} onSelect={setUseCase} />
              <ChoiceGroup title="How guided should the experience be?" options={quickModes} value={mode} onSelect={setMode} compact />
            </div>
          )}

          {step === 2 && (
            <div className="wizard-step-content">
              <ChoiceGroup title="Genre" options={genreOptions} value={genre} onSelect={setGenre} />
              <ChoiceGroup title="Mood" options={moodOptions} value={mood} onSelect={setMood} />
              <ChoiceGroup title="Energy" options={energyOptions} value={energy} onSelect={setEnergy} compact />
              <ChoiceGroup title="Vocals" options={vocalOptions} value={vocalMode} onSelect={setVocalMode} compact />
              <ChoiceGroup title="Length" options={lengthOptions} value={length} onSelect={setLength} compact />
              <ChoiceGroup title="Structure" options={structureOptions} value={structure} onSelect={setStructure} />
            </div>
          )}

          {step === 3 && (
            <div className="wizard-step-content">
              <label>
                <span className="field-label">Extra Brief Notes</span>
                <textarea value={briefNotes} onChange={(e) => setBriefNotes(e.target.value)} rows={5} placeholder="Optional custom detail." />
              </label>
              <label>
                <span className="field-label">Lyrics / Vocal Direction</span>
                <textarea value={lyricNotes} onChange={(e) => setLyricNotes(e.target.value)} rows={5} placeholder="Optional hook language, delivery notes, tone, or message." />
              </label>
              <ChoiceGroup title="Quick refinements" options={quickRefinementOptions} value={null} onSelect={applyQuickRefinement} threeCol />
            </div>
          )}

          {step === 4 && (
            <div className="wizard-step-content">
              <div className="brief-preview-box">
                <span className="field-label">Auto-built creative brief</span>
                <div className="output-box">{brief}</div>
              </div>

              <div className="wizard-action-grid">
                <button type="button" className="primary-button full-button" onClick={handleProducerGenerate} disabled={planLoading || !apiKey}>
                  {planLoading ? 'Generating producer plan…' : 'Generate producer plan'}
                </button>
                <button type="button" className="ghost-button full-button" onClick={handleMoodboardGenerate} disabled={imageLoading || !apiKey}>
                  {imageLoading ? 'Generating moodboard…' : 'Generate moodboard image'}
                </button>
                <button type="button" className="ghost-button full-button" onClick={handleLyricsGenerate} disabled={lyricsLoading || !apiKey}>
                  {lyricsLoading ? 'Generating lyrics…' : 'Generate lyrics draft'}
                </button>
                <button type="button" className="ghost-button full-button" onClick={saveProjectLocally}>Save project</button>
              </div>

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

              <div className="canvas-card nested-output-card">
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
          )}
        </section>
      </section>

      <section id="saved-projects" className="content-section wizard-bottom-grid">
        <div className="canvas-card wizard-bottom-card">
          <div className="section-inline-header">
            <div>
              <p className="panel-label">Browser-Local Projects</p>
              <h4>Save, load, export, and import</h4>
            </div>
            <div className="mini-actions">
              <button type="button" className="ghost-button small-button" onClick={exportCurrentProject}>Export JSON</button>
              <button type="button" className="ghost-button small-button" onClick={() => importRef.current?.click()}>Import JSON</button>
              <button type="button" className="ghost-button small-button danger-button" onClick={clearAllProjects}>Clear all</button>
            </div>
          </div>
          <input ref={importRef} type="file" accept="application/json" className="hidden-input" onChange={handleImportProject} />
          {projects.length ? (
            <div className="saved-projects-grid">
              {projects.map((project) => (
                <button key={project.id} type="button" className={`saved-project-item ${project.id === activeProjectId ? 'active' : ''}`} onClick={() => loadProject(project)}>
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

        <div className="canvas-card wizard-bottom-card">
          <div className="section-inline-header">
            <div>
              <p className="panel-label">Version Snapshots</p>
              <h4>Capture milestones while you iterate</h4>
            </div>
          </div>
          <div className="snapshot-form-row">
            <input value={snapshotLabel} onChange={(e) => setSnapshotLabel(e.target.value)} placeholder="Snapshot label" />
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
            <p className="eyebrow">Why this feels lighter</p>
            <h3>Less typing. More choosing. More flow.</h3>
            <p className="section-copy">
              The studio now walks the user through one stage at a time. They click, add a custom note only when needed, move forward, go backward, and only then reach the generation stage.
            </p>
          </div>
          <div className="canvas-card api-card steps-card">
            <p className="panel-label">How to get your key</p>
            <ol className="steps-list">
              {apiSteps.map((stepText) => <li key={stepText}>{stepText}</li>)}
            </ol>
          </div>
        </div>
      </section>
    </main>
  );
}

function ChoiceGroup<T extends string>({
  title,
  options,
  value,
  onSelect,
  compact = false,
  threeCol = false
}: {
  title: string;
  options: readonly T[];
  value: T | null;
  onSelect: (value: T) => void;
  compact?: boolean;
  threeCol?: boolean;
}) {
  const gridClass = threeCol ? 'three-col' : compact ? 'compact-grid' : 'two-col';
  return (
    <div className="choice-group-card">
      <span className="field-label">{title}</span>
      <div className={`choice-grid ${gridClass}`}>
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
          {items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : (
        <p className="muted-copy compact-muted">{fallback}</p>
      )}
    </div>
  );
}
