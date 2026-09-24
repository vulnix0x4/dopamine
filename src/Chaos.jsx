import {Fragment, useEffect, useRef, useState} from 'react';

// Everything here is decorative: it exists to make the page feel like the morning you picked.
// It all scales with --noise, stays out of the way of taps, and turns off with reduced motion.

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const fx = {burst: () => {}};

export function Confetti() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current, ctx = canvas.getContext('2d');
    let parts = [], raf = 0, last = 0, dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const frame = (now) => {
      const dt = Math.min(0.033, (now - last) / 1000 || 0.016); last = now;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      parts = parts.filter((p) => (p.life -= dt) > 0);
      for (const p of parts) {
        p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
        ctx.save();
        ctx.globalAlpha = Math.min(1, p.life * 2);
        ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.font = `${p.size}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(p.e, 0, 0);
        ctx.restore();
      }
      raf = parts.length ? requestAnimationFrame(frame) : 0;
    };
    fx.burst = (x, y, emojis, {count = 14, calm = false} = {}) => {
      if (reduced()) return;
      for (let i = 0; i < count; i++) {
        const a = calm ? -Math.PI / 2 + (Math.random() - 0.5) * 1.4 : Math.random() * Math.PI * 2;
        const v = calm ? 60 + Math.random() * 90 : 240 + Math.random() * 380;
        parts.push({
          x, y, e: emojis[i % emojis.length],
          vx: Math.cos(a) * v, vy: Math.sin(a) * v - (calm ? 0 : 220),
          g: calm ? -30 : 900, r: 0, vr: (Math.random() - 0.5) * (calm ? 1 : 12),
          size: calm ? 16 + Math.random() * 10 : 18 + Math.random() * 16, life: calm ? 1.8 + Math.random() : 1 + Math.random() * 0.6,
        });
      }
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
    };
    resize();
    addEventListener('resize', resize);
    return () => { removeEventListener('resize', resize); cancelAnimationFrame(raf); fx.burst = () => {}; };
  }, []);
  return <canvas ref={ref} className="confetti" aria-hidden="true" />;
}

// Fake notifications. Rate climbs with noise; they never take pointer events.
export function Pings({noise, sources, paused, onPing}) {
  const [items, setItems] = useState([]);
  const live = useRef({noise, sources, paused, onPing});
  live.current = {noise, sources, paused, onPing};
  useEffect(() => {
    let timer, id = 0, recent = [];
    const schedule = () => {
      const n = live.current.noise;
      const wait = n < 0.25 ? 1500 : (7500 - n * 5300) * (0.7 + Math.random() * 0.6);
      timer = setTimeout(() => {
        const {noise: nn, sources: src, paused: p, onPing: cb} = live.current;
        if (nn >= 0.25 && !p && !document.hidden && src.length && !reduced()) {
          const fresh = src.filter((t) => !recent.includes(t));
          const pool = fresh.length ? fresh : src;
          const text = pool[Math.floor(Math.random() * pool.length)];
          recent = [...recent.slice(-3), text];
          const key = ++id;
          const max = innerWidth < 640 ? 1 : 3;
          setItems((cur) => [...cur.slice(-(max - 1)), {key, text, tilt: (Math.random() - 0.5) * 4}]);
          setTimeout(() => setItems((cur) => cur.filter((t) => t.key !== key)), 3600);
          cb?.();
        }
        schedule();
      }, wait);
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => { if (paused || noise < 0.25) setItems([]); }, [paused, noise < 0.25]);
  return (
    <div className="pings" aria-hidden="true">
      {items.map((t) => (
        <div key={t.key} className="ping" style={{'--tilt': `${t.tilt}deg`}}>
          <span className="ping-app">now</span>
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}

const LOUD = ['+1 LIKE', '🔔 NEW', '🔥 TRENDING', '▶ UP NEXT', '💬 48 UNREAD', '⚡ LIMITED TIME', '👀 SEEN', '📈 GOING VIRAL', '❤️ 2.1K', '🔴 LIVE', '✨ FOR YOU', '📰 BREAKING'];
const QUIET = ['nothing new', 'you’re all caught up', 'breathe in', 'breathe out', 'nothing new', 'one thing at a time'];

export function Ticker({noise, reverse = false}) {
  const words = noise < 0.25 ? QUIET : LOUD;
  const row = [...words, ...words];
  return (
    <div className={'ticker ' + (noise < 0.25 ? 'is-quiet' : '') + (reverse ? ' reverse' : '')} aria-hidden="true">
      <div className="ticker-track">
        {[0, 1].map((k) => (
          <span key={k}>{row.map((w, i) => <b key={i}>{w}<i>✦</i></b>)}</span>
        ))}
      </div>
    </div>
  );
}

export function Backdrop() {
  return (
    <div className="backdrop" aria-hidden="true">
      <i /><i /><i /><i />
    </div>
  );
}

// Letters that shake, recolor and split as the page gets louder.
const COLORS = ['var(--n1)', 'var(--n2)', 'var(--n3)', 'var(--n4)', 'var(--n5)'];
export function Jitter({text}) {
  const seeded = (i, k) => { const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return s - Math.floor(s); };
  let i = 0;
  return (
    <span className="jitter" aria-hidden="true">
      {text.split(' ').map((word, w) => (
        <Fragment key={w}><span className="jw">
          {[...word].map((ch) => {
            const n = i++;
            return (
              <span key={n} className="jl" style={{
                '--jx': (seeded(n, 1) - 0.5) * 10, '--jy': (seeded(n, 2) - 0.5) * 12, '--jr': (seeded(n, 3) - 0.5) * 14,
                '--jd': `${0.18 + seeded(n, 4) * 0.3}s`, '--jdl': `${-seeded(n, 5)}s`, '--c': COLORS[n % COLORS.length],
              }}>{ch}</span>
            );
          })}
        </span>{' '}</Fragment>
      ))}
    </span>
  );
}
