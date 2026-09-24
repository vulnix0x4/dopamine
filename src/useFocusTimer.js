import {useCallback, useEffect, useState} from 'react';

const KEY = 'dopamine.focus';

const load = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; }
};
const save = (v) => {
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* storage unavailable */ }
};

function chime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [523.25, 659.25, 783.99].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      const at = ctx.currentTime + i * 0.18;
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.12, at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 1.6);
      o.connect(g).connect(ctx.destination);
      o.start(at);
      o.stop(at + 1.7);
    });
  } catch { /* audio unavailable */ }
}

// Deadline-based so the timer survives tab throttling and reloads.
export default function useFocusTimer() {
  const saved = load();
  const [minutes, setMinutesState] = useState(saved?.minutes ?? 25);
  const [deadline, setDeadline] = useState(saved?.deadline ?? null);
  const [remaining, setRemaining] = useState(() => {
    if (saved?.deadline) return Math.max(0, Math.ceil((saved.deadline - Date.now()) / 1000));
    return saved?.remaining ?? (saved?.minutes ?? 25) * 60;
  });
  const [task, setTask] = useState(saved?.task ?? '');
  const [done, setDone] = useState(false);
  const running = deadline != null;

  useEffect(() => { save({minutes, deadline, remaining, task}); }, [minutes, deadline, remaining, task]);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (!left) { setDeadline(null); setDone(true); chime(); }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [running, deadline]);

  useEffect(() => {
    const base = 'Dopamine — Quiet the signal';
    if (!running) { document.title = done ? 'Session complete · Dopamine' : base; return; }
    const m = String(Math.floor(remaining / 60)).padStart(2, '0'), s = String(remaining % 60).padStart(2, '0');
    document.title = `${m}:${s} · ${task || 'Focusing'}`;
  }, [running, remaining, task, done]);

  const start = useCallback(() => {
    const secs = remaining > 0 ? remaining : minutes * 60;
    setDone(false);
    setRemaining(secs);
    setDeadline(Date.now() + secs * 1000);
  }, [minutes, remaining]);
  const pause = useCallback(() => setDeadline(null), []);
  const reset = useCallback(() => { setDeadline(null); setDone(false); setRemaining(minutes * 60); }, [minutes]);
  const setMinutes = useCallback((m) => { setDeadline(null); setDone(false); setMinutesState(m); setRemaining(m * 60); }, []);

  return {minutes, setMinutes, remaining, running, done, task, setTask, start, pause, reset, total: minutes * 60};
}
