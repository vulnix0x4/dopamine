import {useEffect, useMemo, useRef, useState} from 'react';
import {ArrowDown, ArrowUpRight, Check, Github, Link2, Minimize2, Moon, Pause, Play, Plus, RotateCcw, Sun, X} from 'lucide-react';
import Field from './Field.jsx';
import useFocusTimer from './useFocusTimer.js';
import {activities, capacityCurve, groups, readHash, scenarios, simulate, writeHash} from './model.js';

const REPO = 'https://github.com/vulnix0x4/dopamine';

function useTween(value, ms = 650) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(value); from.current = value; return; }
    const start = performance.now(), a = from.current;
    let raf;
    const step = (now) => {
      const p = Math.min(1, (now - start) / ms), e = 1 - Math.pow(1 - p, 3);
      const v = a + (value - a) * e;
      from.current = v;
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}

function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || null);
  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
    try { theme ? localStorage.setItem('dopamine.theme', theme) : localStorage.removeItem('dopamine.theme'); } catch { /* ignore */ }
  }, [theme]);
  const isDark = theme ? theme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  return [isDark, () => setTheme(isDark ? 'light' : 'dark')];
}

const clock = (secs) => [Math.floor(secs / 60), secs % 60].map((n) => String(n).padStart(2, '0'));

function CapacityChart({score, compare, hours}) {
  const W = 320, H = 120, pad = 6;
  const toPath = (vals) => vals.map((v, i) => `${i ? 'L' : 'M'}${(pad + (i / (vals.length - 1)) * (W - 2 * pad)).toFixed(1)},${(H - pad - (v / 100) * (H - 2 * pad)).toFixed(1)}`).join('');
  const cur = capacityCurve(score);
  const quiet = capacityCurve(simulate(['coffee', 'walk', 'reading'], hours).score);
  const thresholdY = H - pad - 0.4 * (H - 2 * pad);
  const line = toPath(cur);
  return (
    <svg className="capacity" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <line x1={pad} x2={W - pad} y1={thresholdY} y2={thresholdY} className="cap-threshold" />
      <path d={`${line}L${W - pad},${H}L${pad},${H}Z`} className="cap-area" />
      {compare && <path d={toPath(quiet)} className="cap-ghost" />}
      <path d={line} className="cap-line" />
    </svg>
  );
}

function Chip({a, on, onToggle}) {
  const Icon = a.icon;
  return (
    <button className={`chip chip-${a.group}`} aria-pressed={on} onClick={() => onToggle(a.id)}>
      <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
      <span>{a.name}</span>
      <span className="chip-mark" aria-hidden="true">{on ? <Check size={13} strokeWidth={2.5} /> : <Plus size={13} strokeWidth={2} />}</span>
    </button>
  );
}

function FocusOverlay({timer, onClose}) {
  const ref = useRef(null);
  const [m, s] = clock(timer.remaining);
  const progress = 1 - timer.remaining / timer.total;
  useEffect(() => {
    const prev = document.activeElement;
    ref.current?.querySelector('button')?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const els = ref.current.querySelectorAll('button');
        const first = els[0], last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; prev?.focus?.(); };
  }, [onClose]);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Focus session" ref={ref}>
      <Field selected={[]} noise={0} rows={9} className="overlay-field" still={!timer.running} label="A calm, flat signal" />
      <div className="overlay-top">
        <span className="kicker"><i className={'pulse ' + (timer.running ? '' : 'paused')} />{timer.done ? 'Session complete' : timer.running ? 'Focusing' : 'Paused'}</span>
        <button className="ghost-btn" onClick={onClose}><Minimize2 size={16} />Minimize<kbd>Esc</kbd></button>
      </div>
      <div className="overlay-center">
        <p className="overlay-task">{timer.done ? 'Nice work. Take a real break before the next one.' : timer.task || 'One thing at a time.'}</p>
        <div className="overlay-clock" aria-live="off">{m}<span>:</span>{s}</div>
        <div className="overlay-progress"><i style={{transform: `scaleX(${progress})`}} /></div>
        <div className="overlay-actions">
          {timer.done ? (
            <button className="primary-btn" onClick={timer.reset}><RotateCcw size={17} />Set up another</button>
          ) : timer.running ? (
            <button className="primary-btn" onClick={timer.pause}><Pause size={17} />Pause</button>
          ) : (
            <button className="primary-btn" onClick={timer.start}><Play size={17} />Resume</button>
          )}
          <button className="ghost-btn" onClick={() => { timer.reset(); onClose(); }}><X size={16} />End session</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const initial = useMemo(readHash, []);
  const [selected, setSelected] = useState(initial.selected ?? scenarios[0].ids);
  const [hours, setHours] = useState(initial.hours ?? 4);
  const [compare, setCompare] = useState(false);
  const [overlay, setOverlay] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isDark, toggleTheme] = useTheme();
  const timer = useFocusTimer();
  const sim = simulate(selected, hours);
  const score = useTween(sim.score);
  const preset = scenarios.find((s) => s.ids.length === selected.length && s.ids.every((id) => selected.includes(id)))?.id;

  useEffect(() => { writeHash(selected, hours); }, [selected, hours]);
  useEffect(() => {
    document.documentElement.style.setProperty('--noise', sim.noise.toFixed(3));
  }, [sim.noise]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('input, textarea, select, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey || overlay) return;
      if (e.key === 'f') { e.preventDefault(); if (!timer.running) timer.start(); setOverlay(true); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [overlay, timer]);

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((i) => i !== id) : [...s, id]));
  const share = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard blocked */ }
  };
  const startFocus = () => { timer.start(); setOverlay(true); };
  const [m, s] = clock(timer.remaining);
  const sliceMins = Math.round((hours * 60) / 22);
  const quietWith = () => {
    const loudest = selected.map((id) => activities.find((a) => a.id === id)).filter((a) => a.group === 'high').sort((a, b) => b.weight - a.weight)[0];
    setSelected((cur) => [...cur.filter((id) => id !== loudest?.id), ...(cur.includes('walk') ? [] : ['walk'])]);
  };

  return (
    <>
      <a className="skip" href="#field">Skip to the simulator</a>
      <header className="nav">
        <a className="brand" href="#top" aria-label="Dopamine, home">
          <svg viewBox="0 0 28 20" aria-hidden="true"><path d="M1 15h6l3-12 4 16 3-9 2 5h8" /></svg>
          dopamine
        </a>
        <nav className="nav-links" aria-label="Sections">
          <a href="#field">Simulator</a>
          <a href="#focus">Focus</a>
          <a href="#how">How it works</a>
        </nav>
        <div className="nav-actions">
          {timer.running && !overlay && (
            <button className="nav-timer" onClick={() => setOverlay(true)} aria-label="Open focus session"><i className="pulse" />{m}:{s}</button>
          )}
          <button className="icon-btn" onClick={toggleTheme} aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}>{isDark ? <Sun size={17} /> : <Moon size={17} />}</button>
          <a className="icon-btn" href={REPO} target="_blank" rel="noreferrer" aria-label="Source on GitHub"><Github size={17} /></a>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <p className="kicker"><i className="pulse" />An attention simulator</p>
          <h1 className="headline" aria-label="Quiet the signal.">
            <span>Quiet the</span>
            <span>signal<em>.</em></span>
          </h1>
          <div className="hero-foot">
            <p className="lede">Choose what goes into your morning. Every spike in the field below is something pulling at your attention. Take things out and watch it settle.</p>
            <a className="scroll-cue" href="#field"><ArrowDown size={16} />Try it</a>
          </div>
        </section>

        <section className="instrument" id="field" aria-label="Simulator">
          <div className="field-panel">
            <div className="field-meta">
              <span>Your next {hours} hours</span>
              <span>One line ≈ {sliceMins} min</span>
            </div>
            <div className="field-axis" aria-hidden="true">
              <span>Now</span><span>+{Math.round(hours / 2)}h</span><span>+{hours}h</span>
            </div>
            <div className="field-score" aria-hidden="true"><b>{Math.round(score)}</b>/100</div>
            <Field selected={selected} noise={sim.noise} inset label={`Attention field: ${sim.load.toLowerCase()} stimulation, focus capacity ${sim.score} out of 100.`} />
          </div>

          <aside className="readout" aria-live="polite">
            <div className="readout-score">
              <span className="label">Focus capacity</span>
              <div className="score"><span>{Math.round(score)}</span><small>/100</small></div>
              <div className="meter" aria-hidden="true"><i style={{transform: `scaleX(${score / 100})`}} /><b /></div>
              <div className="meter-scale" aria-hidden="true"><span>0</span><span>Deep work line</span><span>100</span></div>
            </div>
            <dl className="readout-stats">
              <div><dt>Stimulation</dt><dd className={'load-' + sim.load.toLowerCase()}>{sim.load}</dd></div>
              <div><dt>Deep work feels</dt><dd>{sim.feel}</dd></div>
            </dl>
            <div className="verdict">
              <h2>{sim.verdict.title}</h2>
              <p>{sim.verdict.body}</p>
              {sim.high > 0 && <button className="text-btn" onClick={quietWith}>Swap your loudest input for a walk<ArrowUpRight size={14} /></button>}
            </div>
            <div className="readout-chart">
              <div className="chart-head">
                <span className="label">Capacity over time</span>
                <button className="switch" role="switch" aria-checked={compare} onClick={() => setCompare(!compare)}><i />Slow start</button>
              </div>
              <CapacityChart score={sim.score} compare={compare} hours={hours} />
            </div>
            <div className="readout-actions">
              <button className="primary-btn" onClick={startFocus}><Play size={16} />Start focusing<kbd>F</kbd></button>
              <button className="ghost-btn" onClick={share}>{copied ? <Check size={16} /> : <Link2 size={16} />}{copied ? 'Link copied' : 'Copy link'}</button>
            </div>
          </aside>

          <div className="mixer">
            <div className="mixer-bar">
              <div className="segmented" role="radiogroup" aria-label="Start from a scenario">
                {scenarios.map((sc) => (
                  <button key={sc.id} role="radio" aria-checked={preset === sc.id} onClick={() => setSelected(sc.ids)}>{sc.label}</button>
                ))}
              </div>
              <label className="range">
                <span>Window</span>
                <input type="range" min="2" max="8" step="1" value={hours} onChange={(e) => setHours(Number(e.target.value))} style={{'--p': `${((hours - 2) / 6) * 100}%`}} />
                <output>{hours}h</output>
              </label>
              <button className="text-btn" onClick={() => setSelected([])} disabled={!selected.length}><RotateCcw size={14} />Clear all</button>
            </div>
            <div className="groups">
              {groups.map((g) => (
                <fieldset key={g.id} className={'group group-' + g.id}>
                  <legend><span>{g.label}</span><small>{g.hint}</small></legend>
                  <div className="chips">
                    {activities.filter((a) => a.group === g.id).map((a) => <Chip key={a.id} a={a} on={selected.includes(a.id)} onToggle={toggle} />)}
                  </div>
                </fieldset>
              ))}
            </div>
          </div>
        </section>

        <section className="focus" id="focus" aria-labelledby="focus-title">
          <div className="focus-copy">
            <p className="kicker">Focus session</p>
            <h2 id="focus-title">One thing.<br />Nothing else.</h2>
            <p>Name the task, pick a length, and the page clears out of your way. The timer keeps running if you close the tab and come back.</p>
          </div>
          <div className="focus-card">
            <label className="task">
              <span className="label">What are you working on?</span>
              <input value={timer.task} onChange={(e) => timer.setTask(e.target.value)} placeholder="Write the intro section" maxLength={80} />
            </label>
            <div className="durations" role="radiogroup" aria-label="Session length">
              {[15, 25, 45, 90].map((n) => (
                <button key={n} role="radio" aria-checked={timer.minutes === n} onClick={() => timer.setMinutes(n)}>{n}<small>min</small></button>
              ))}
            </div>
            <div className="focus-clock" aria-hidden="true">{m}<span>:</span>{s}</div>
            <div className="focus-actions">
              {timer.running
                ? <button className="primary-btn" onClick={() => setOverlay(true)}><Play size={16} />Return to session</button>
                : <button className="primary-btn" onClick={startFocus}><Play size={16} />{timer.remaining < timer.total && timer.remaining > 0 ? 'Resume session' : 'Start session'}</button>}
              {(timer.running || timer.remaining < timer.total) && <button className="ghost-btn" onClick={timer.reset}><RotateCcw size={15} />Reset</button>}
            </div>
          </div>
        </section>

        <section className="how" id="how" aria-labelledby="how-title">
          <h2 id="how-title">How it works</h2>
          <div className="how-grid">
            <article>
              <h3>What the field shows</h3>
              <p>Each line is a slice of your time window, earliest at the top. Quick hits add tall, sharp spikes. Everyday inputs add soft bumps. Breathing room calms everything.</p>
            </article>
            <article>
              <h3>What the number means</h3>
              <p>Every activity has a fixed weight. The capacity score adds them up and scales by the window, so you can compare one mix with another. The deep work line sits at 40.</p>
            </article>
            <article>
              <h3>What it isn’t</h3>
              <p>It doesn’t measure dopamine or say anything medical. Coffee and music affect people differently. Treat it as a prompt to notice your own habits, not a verdict.</p>
            </article>
          </div>
          <p className="how-note">Everything runs in your browser. Nothing you choose or type is sent anywhere. <a href={REPO} target="_blank" rel="noreferrer">Read the source<ArrowUpRight size={13} /></a></p>
        </section>
      </main>

      <footer className="footer">
        <span className="brand small">
          <svg viewBox="0 0 28 20" aria-hidden="true"><path d="M1 15h6l3-12 4 16 3-9 2 5h8" /></svg>
          dopamine
        </span>
        <span>Open source, MIT licensed.</span>
        <a href={REPO} target="_blank" rel="noreferrer">GitHub<ArrowUpRight size={13} /></a>
      </footer>

      {overlay && <FocusOverlay timer={timer} onClose={() => setOverlay(false)} />}
    </>
  );
}
