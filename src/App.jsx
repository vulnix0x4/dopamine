import {useEffect, useMemo, useRef, useState} from 'react';
import {AlarmClock, ArrowDown, ArrowUpRight, BedDouble, Check, Github, Link2, Minimize2, Moon, Pause, Play, Plus, RotateCcw, Sun, Timer, VolumeX, X} from 'lucide-react';
import Field from './Field.jsx';
import {Backdrop, Confetti, fx, Jitter, Pings, Ticker} from './Chaos.jsx';
import useFocusTimer from './useFocusTimer.js';
import {activities, capacityCurve, fmtTime, groups, habits, readHash, scenarios, simulate, writeHash} from './model.js';

const REPO = 'https://github.com/vulnix0x4/dopamine';
const QUIET_AT = 0.25;

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

function useReveal() {
  useEffect(() => {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('in')), {rootMargin: '0px 0px -8% 0px'});
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

const clock = (secs) => [Math.floor(secs / 60), secs % 60].map((n) => String(n).padStart(2, '0'));
const center = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
const buzz = (p) => { try { navigator.vibrate?.(p); } catch { /* unsupported */ } };
const shake = () => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const el = document.documentElement;
  el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
};

function CapacityChart({score, compare, quietScore}) {
  const W = 320, H = 120, pad = 6;
  const toPath = (vals) => vals.map((v, i) => `${i ? 'L' : 'M'}${(pad + (i / (vals.length - 1)) * (W - 2 * pad)).toFixed(1)},${(H - pad - (v / 100) * (H - 2 * pad)).toFixed(1)}`).join('');
  const line = toPath(capacityCurve(score));
  const thresholdY = H - pad - 0.4 * (H - 2 * pad);
  return (
    <svg className="capacity" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <line x1={pad} x2={W - pad} y1={thresholdY} y2={thresholdY} className="cap-threshold" />
      <path d={`${line}L${W - pad},${H}L${pad},${H}Z`} className="cap-area" />
      {compare && <path d={toPath(capacityCurve(quietScore))} className="cap-ghost" />}
      <path d={line} className="cap-line" />
    </svg>
  );
}

function Chip({a, on, onToggle}) {
  const Icon = a.icon;
  return (
    <button className={`chip chip-${a.group}`} aria-pressed={on} onClick={(e) => onToggle(a, e.currentTarget)}>
      <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
      <span className="chip-name">{a.name}</span>
      <span className="chip-weight" aria-hidden="true">{a.weight > 0 ? '+' : '−'}{Math.abs(a.weight)}</span>
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
  const start = scenarios[0];
  const [selected, setSelected] = useState(initial.selected ?? start.ids);
  const [hb, setHb] = useState(initial.habits ?? start.habits);
  const [hours, setHours] = useState(initial.hours ?? 4);
  const [wake, setWake] = useState(initial.wake ?? 420);
  const [sleep, setSleep] = useState(initial.sleep ?? start.sleep);
  const [compare, setCompare] = useState(false);
  const [overlay, setOverlay] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pings, setPings] = useState(0);
  const [isDark, toggleTheme] = useTheme();
  const timer = useFocusTimer();
  const state = {selected, hours, wake, sleep, habits: hb};
  const sim = simulate(state);
  const quietScore = simulate({...state, selected: scenarios[2].ids, habits: scenarios[2].habits, sleep: 8}).score;
  const score = useTween(sim.score);
  const quiet = sim.noise < QUIET_AT;
  const preset = scenarios.find((sc) => sc.ids.length === selected.length && sc.ids.every((id) => selected.includes(id)))?.id;
  useReveal();

  useEffect(() => { writeHash(state); }, [selected, hours, wake, sleep, hb]);
  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--noise', sim.noise.toFixed(3));
    root.setProperty('--pop', Math.max(0, Math.min(1, (sim.noise - 0.4) * 2.2)).toFixed(3));
  }, [sim.noise]);

  // Payoff: crossing into quiet gets a soft burst of calm.
  const wasQuiet = useRef(quiet);
  useEffect(() => {
    if (quiet && !wasQuiet.current) fx.burst(innerWidth / 2, innerHeight * 0.6, ['💙', '🫧', '🌿', '✨'], {count: 22, calm: true});
    wasQuiet.current = quiet;
  }, [quiet]);

  // Ambient emoji drift, faster the noisier the morning.
  const live = useRef({});
  live.current = {noise: sim.noise, overlay, emoji: selected.flatMap((id) => activities.find((a) => a.id === id).emoji || [])};
  useEffect(() => {
    let t;
    const tick = () => {
      const {noise, overlay: o, emoji} = live.current;
      if (noise >= QUIET_AT && !o && emoji.length) fx.float(emoji);
      t = setTimeout(tick, noise < QUIET_AT ? 1200 : 1500 - noise * 1150 + Math.random() * 400);
    };
    tick();
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('input, textarea, select, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey || overlay) return;
      if (e.key === 'f') { e.preventDefault(); if (!timer.running) timer.start(); setOverlay(true); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [overlay, timer]);

  const toggle = (a, el) => {
    const adding = !selected.includes(a.id);
    setSelected((cur) => (cur.includes(a.id) ? cur.filter((i) => i !== a.id) : [...cur, a.id]));
    if (!adding) return;
    const [x, y] = center(el);
    if (a.group === 'restore') { fx.burst(x, y, ['💙', '🫧', '🌿'], {count: 8, calm: true}); buzz(6); }
    else { fx.burst(x, y, a.emoji, {count: a.group === 'high' ? 18 : 7}); buzz(a.group === 'high' ? [10, 40, 10] : 8); if (a.group === 'high') shake(); }
  };
  const toggleHabit = (h, el) => {
    const adding = !hb.includes(h.id);
    setHb((cur) => (cur.includes(h.id) ? cur.filter((i) => i !== h.id) : [...cur, h.id]));
    if (adding) { const [x, y] = center(el); fx.burst(x, y, [h.emoji], {count: 8, calm: (h.cap || 0) > 0}); buzz(8); }
  };
  const applyScenario = (sc) => { setSelected(sc.ids); setHb(sc.habits); setSleep(sc.sleep); };
  const muteAll = () => { setSelected(['walk', 'silence']); setHb((cur) => cur.filter((id) => id !== 'phoneFirst' && id !== 'bedScroll')); };
  const share = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard blocked */ }
  };
  const startFocus = () => { timer.start(); setOverlay(true); };
  const [m, s] = clock(timer.remaining);
  const sliceMins = Math.round((hours * 60) / 22);
  const loudest = selected.map((id) => activities.find((a) => a.id === id)).filter((a) => a.group === 'high').sort((a, b) => b.weight - a.weight)[0];
  const swapLoudest = () => setSelected((cur) => [...cur.filter((id) => id !== loudest?.id), ...(cur.includes('walk') ? [] : ['walk'])]);
  const sources = [
    ...selected.flatMap((id) => activities.find((a) => a.id === id).pings || []),
    ...(hb.includes('phoneFirst') ? ['📱 You’ve picked up your phone 38 times'] : []),
  ];
  // Peak window: many people are most alert a few hours after waking (illustrative).
  const peakStart = 2, peakEnd = 4.5;
  const band = {top: Math.min(1, peakStart / hours), bottom: Math.min(1, peakEnd / hours)};
  const headline = quiet ? 'Your brain, finally quiet.' : 'This is your brain on your phone.';

  return (
    <>
      <Backdrop />
      <Confetti />
      <Pings noise={sim.noise} sources={sources} paused={overlay} onPing={() => setPings((p) => p + 1)} />
      <a className="skip" href="#field">Skip to the simulator</a>
      <header className="nav">
        <a className="brand" href="#top" aria-label="Dopamine, home">
          <svg viewBox="0 0 28 20" aria-hidden="true"><path d="M1 15h6l3-12 4 16 3-9 2 5h8" /></svg>
          dopamine
          {pings > 0 && !quiet && <span className="badge" key={pings} aria-hidden="true">{pings > 99 ? '99+' : pings}</span>}
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
        <Ticker noise={sim.noise} slim />
        <div className="wrap">
        <section className="hero">
          <p className="kicker"><i className="pulse" />{quiet ? 'Quiet mode · you did that' : 'Live · an overloaded morning, simulated'}</p>
          <h1 className="headline" aria-label={headline} key={headline}>
            <Jitter text={headline} />
          </h1>
          <p className="lede">
            {quiet
              ? 'Notice how the page stopped yelling at you? That’s what fewer inputs feel like. Now’s a good time to focus on one thing.'
              : 'This whole page is running a busy morning: feeds, pings, autoplay, news. Turn things off below and watch everything calm down.'}
          </p>
          <div className="noise-meter" role="meter" aria-label="Noise level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(sim.noise * 100)}>
            <div className="noise-head">
              <span className="label">Noise level</span>
              <span className="noise-val">{Math.round(sim.noise * 100)}%</span>
            </div>
            <div className="noise-bars" aria-hidden="true">
              {Array.from({length: 24}, (_, i) => <i key={i} className={i < Math.round(sim.noise * 24) ? 'on' : ''} style={{'--i': i}} />)}
            </div>
            <div className="noise-foot">{pings} fake {pings === 1 ? 'ping' : 'pings'} since you got here</div>
          </div>
          <div className="hero-actions">
            {quiet
              ? <button className="primary-btn big" onClick={startFocus}><Play size={18} />Start focusing</button>
              : <button className="primary-btn big" onClick={muteAll}><VolumeX size={18} />Mute everything</button>}
            <a className="ghost-btn big" href="#field"><ArrowDown size={17} />{quiet ? 'Tweak your morning' : 'Turn things off one by one'}</a>
          </div>
          <ol className="steps">
            <li><b>1</b>Tap what’s in your morning</li>
            <li><b>2</b>Watch the page react</li>
            <li><b>3</b>Get it quiet, then focus</li>
          </ol>
        </section>
        </div>

        <Ticker noise={sim.noise} />

        <div className="wrap">
        <section className="instrument" id="field" aria-label="Simulator">
          <div className="section-head reveal">
            <h2>Build your morning</h2>
            <p>Each line is a slice of your next {hours} hours, starting at {fmtTime(wake)}. Every spike is something grabbing your attention. Short sleep makes the lines fade.</p>
          </div>
          <div className="field-panel">
            <div className="field-meta">
              <span>From {fmtTime(wake)}</span>
              <span>One line ≈ {sliceMins} min</span>
            </div>
            {band.top < 1 && (
              <div className="peak-band" style={{'--t': band.top, '--b': band.bottom}} aria-hidden="true"><span>Peak window</span></div>
            )}
            <div className="field-axis" aria-hidden="true">
              <span>{fmtTime(wake)}</span><span>{fmtTime(wake + hours * 30)}</span><span>{fmtTime(wake + hours * 60)}</span>
            </div>
            <div className="field-score" aria-hidden="true"><b>{Math.round(score)}</b>/100</div>
            <Field selected={selected} noise={sim.noise} fog={sim.fog} inset label={`Attention field: ${sim.load.toLowerCase()} stimulation, focus capacity ${sim.score} out of 100.`} />
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
              <div><dt>Sleep</dt><dd className={sim.sleepDebt >= 2 ? 'load-high' : sim.sleepDebt ? '' : 'load-low'}>{sim.sleepDebt ? `${sim.sleepDebt}h short` : 'Rested'}</dd></div>
              <div className="wide"><dt>Peak window</dt><dd>{fmtTime(wake + peakStart * 60)}–{fmtTime(wake + peakEnd * 60)}</dd></div>
            </dl>
            <div className="verdict">
              <h3>{sim.verdict.title}</h3>
              <p>{sim.verdict.body}</p>
              {loudest && <button className="text-btn" onClick={swapLoudest}>Swap {loudest.name.toLowerCase()} for a walk<ArrowUpRight size={14} /></button>}
            </div>
            <div className="readout-chart">
              <div className="chart-head">
                <span className="label">Capacity over time</span>
                <button className="switch" role="switch" aria-checked={compare} onClick={() => setCompare(!compare)}><i />vs. slow start</button>
              </div>
              <CapacityChart score={sim.score} compare={compare} quietScore={quietScore} />
            </div>
            <div className="readout-actions">
              <button className="primary-btn" onClick={startFocus}><Play size={16} />Start focusing<kbd>F</kbd></button>
              <button className="ghost-btn" onClick={share}>{copied ? <Check size={16} /> : <Link2 size={16} />}{copied ? 'Copied' : 'Share'}</button>
            </div>
          </aside>

          <div className="mixer">
            <div className="mixer-bar">
              <div className="segmented" role="radiogroup" aria-label="Start from a scenario">
                {scenarios.map((sc) => (
                  <button key={sc.id} role="radio" aria-checked={preset === sc.id} onClick={() => applyScenario(sc)}>{sc.label}</button>
                ))}
              </div>
              <button className="text-btn" onClick={() => setSelected([])} disabled={!selected.length}><RotateCcw size={14} />Clear inputs</button>
            </div>

            <fieldset className="body-clock reveal">
              <legend><span>Your body clock</span><small>When you woke up and how you slept shift everything</small></legend>
              <div className="sliders">
                <label className="slider">
                  <span className="slider-label"><AlarmClock size={16} />Woke up at</span>
                  <output>{fmtTime(wake)}</output>
                  <input type="range" min="270" max="660" step="15" value={wake} onChange={(e) => setWake(Number(e.target.value))} style={{'--p': `${((wake - 270) / 390) * 100}%`}} />
                </label>
                <label className="slider">
                  <span className="slider-label"><BedDouble size={16} />Hours of sleep</span>
                  <output>{sleep}h</output>
                  <input type="range" min="4" max="10" step="0.5" value={sleep} onChange={(e) => setSleep(Number(e.target.value))} style={{'--p': `${((sleep - 4) / 6) * 100}%`}} />
                </label>
                <label className="slider">
                  <span className="slider-label"><Timer size={16} />Hours to plan</span>
                  <output>{hours}h</output>
                  <input type="range" min="2" max="8" step="1" value={hours} onChange={(e) => setHours(Number(e.target.value))} style={{'--p': `${((hours - 2) / 6) * 100}%`}} />
                </label>
              </div>
              <div className="habits">
                {habits.map((h) => (
                  <button key={h.id} className={'habit ' + ((h.cap || 0) > 0 ? 'good' : 'bad')} aria-pressed={hb.includes(h.id)} onClick={(e) => toggleHabit(h, e.currentTarget)}>
                    <span className="habit-emoji" aria-hidden="true">{h.emoji}</span>{h.name}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="groups">
              {groups.map((g) => (
                <fieldset key={g.id} className={'group group-' + g.id + ' reveal'}>
                  <legend><span>{g.label}</span><small>{g.hint}</small></legend>
                  <div className="chips">
                    {activities.filter((a) => a.group === g.id).map((a) => <Chip key={a.id} a={a} on={selected.includes(a.id)} onToggle={toggle} />)}
                  </div>
                </fieldset>
              ))}
            </div>
          </div>
        </section>
        </div>

        <Ticker noise={sim.noise} reverse />

        <div className="wrap">
        <section className="focus reveal" id="focus" aria-labelledby="focus-title">
          <div className="focus-copy">
            <p className="kicker">Focus session</p>
            <h2 id="focus-title">One thing.<br />Nothing else.</h2>
            <p>Name the task, pick a length, and the page clears out of your way. No pings, no tickers. The timer keeps running if you close the tab and come back.</p>
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

        <section className="how reveal" id="how" aria-labelledby="how-title">
          <h2 id="how-title">How it works</h2>
          <div className="how-grid">
            <article>
              <h3>The page is the simulation</h3>
              <p>Everything you pick adds or removes noise. The noise drives the field, the pings, the tickers, even how hard the headline shakes. Quiet it down and the whole page calms with it.</p>
            </article>
            <article>
              <h3>Your body clock counts</h3>
              <p>Short sleep lowers capacity and fades the field. Grabbing your phone first thing counts as a quick hit. Early sunlight and water help a little. Many people are sharpest a few hours after waking, which is where the peak window sits.</p>
            </article>
            <article>
              <h3>What it isn’t</h3>
              <p>It doesn’t measure dopamine or say anything medical. Every weight is fixed and illustrative, and real people vary a lot. Treat it as a prompt to notice your own habits, not a verdict.</p>
            </article>
          </div>
          <p className="how-note">Everything runs in your browser. Nothing you choose or type is sent anywhere. <a href={REPO} target="_blank" rel="noreferrer">Read the source<ArrowUpRight size={13} /></a></p>
        </section>
        </div>
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
