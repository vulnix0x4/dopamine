import {useEffect, useRef} from 'react';
import {getActivity} from './model.js';

// A ridgeline "field": each line is one slice of the time window, stacked back to front.
// Quick hits draw tall, sharp spikes; everyday inputs draw soft bumps; breathing room damps both.

const hash = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 100000) / 100000;
};

// Smooth 1D value noise, deterministic per row.
const noise1 = (x, seed) => {
  const i = Math.floor(x), f = x - i;
  const r = (n) => {
    const s = Math.sin((n + seed * 131.7) * 127.1) * 43758.5453;
    return s - Math.floor(s);
  };
  const u = f * f * (3 - 2 * f);
  return (r(i) * (1 - u) + r(i + 1) * u) * 2 - 1;
};

const parse = (c) => {
  c = c.trim();
  if (c.startsWith('#')) {
    const n = parseInt(c.length === 4 ? c.slice(1).split('').map((x) => x + x).join('') : c.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = c.match(/[\d.]+/g);
  return m ? m.slice(0, 3).map(Number) : [0, 0, 0];
};
const mix = (a, b, t) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;

export default function Field({selected, noise, rows = 22, still = false, inset = false, fog = 0, className = '', label}) {
  const canvasRef = useRef(null);
  const state = useRef({presence: {}, noise, selected, still, fog});
  state.current.selected = selected;
  state.current.noise = noise;
  state.current.still = still;
  state.current.fog = fog;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    let raf = 0, visible = true, w = 0, h = 0, colors = null, colorsAt = 0, t = 0, last = performance.now();
    const s = state.current;
    s.smoothNoise = s.noise;

    const readColors = () => {
      const cs = getComputedStyle(canvas);
      colors = {
        paper: cs.getPropertyValue('--field-bg').trim() || '#fff',
        ink: parse(cs.getPropertyValue('--ink')),
        flare: parse(cs.getPropertyValue('--flare')),
        cobalt: parse(cs.getPropertyValue('--cobalt')),
      };
    };

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const animate = !reduce.matches && !s.still;
      if (animate) t += dt;
      if (!colors || now - colorsAt > 600) { readColors(); colorsAt = now; }

      // Ease toward targets so toggles grow and fade instead of snapping.
      const k = reduce.matches ? 1 : 1 - Math.pow(0.02, dt);
      s.smoothNoise += (s.noise - s.smoothNoise) * k;
      s.smoothFog = (s.smoothFog ?? s.fog) + (s.fog - (s.smoothFog ?? s.fog)) * k;
      const ids = new Set([...Object.keys(s.presence), ...s.selected]);
      for (const id of ids) {
        const target = s.selected.includes(id) ? 1 : 0;
        const cur = s.presence[id] ?? 0;
        const next = cur + (target - cur) * k;
        if (target === 0 && next < 0.002) delete s.presence[id];
        else s.presence[id] = next;
      }
      const active = Object.entries(s.presence).map(([id, amt]) => ({a: getActivity(id), amt, seed: hash(id)}));
      const damping = active.filter((x) => x.a.group === 'restore').reduce((n, x) => n + x.amt, 0);
      const damp = 1 / (1 + damping * 0.35);
      const n = s.smoothNoise;

      ctx.clearRect(0, 0, w, h);
      const top = h * 0.2, bottom = h * 0.94;
      const gap = (bottom - top) / (rows - 1);
      const step = w > 700 ? 3 : 2.5;
      const pad = Math.max(12, w * 0.02);
      const left = inset ? (w > 520 ? 76 : 66) : pad;
      const base = n < 0.5 ? mix(colors.cobalt, colors.ink, n * 2) : mix(colors.ink, colors.flare, (n - 0.5) * 1.1);
      const lw = w > 700 ? 1.25 : 1;

      for (let r = 0; r < rows; r++) {
        const y0 = top + r * gap;
        const rowSeed = r * 7.13;
        const pts = [];
        for (let x = left; x <= w - pad + 0.1; x += step) {
          const u = (x - left) / (w - left - pad);
          const env = Math.pow(Math.sin(Math.PI * u), 1.6);
          let lift = Math.sin(u * 7 + t * 0.55 + r * 0.45) * (2.2 + 3 * (1 - n)) * (0.6 + 0.4 * env);
          lift += noise1(u * 38 + t * 1.8, rowSeed) * n * 9 * env;
          for (const {a, amt, seed} of active) {
            if (a.group === 'restore') continue;
            const spikes = a.group === 'high' ? 2 : 1;
            for (let j = 0; j < spikes; j++) {
              const p = 0.12 + 0.76 * ((seed * 9.7 + r * 0.618 * (j + 1) + j * 0.37) % 1);
              const width = a.group === 'high' ? 0.008 + a.weight * 0.0004 : 0.04;
              const pulse = 0.72 + 0.28 * Math.sin(t * (a.group === 'high' ? 3.1 : 1.2) + seed * 40 + r + j * 2);
              const height = (a.group === 'high' ? a.weight * 6.2 : a.weight * 3.2) * (h / 520) * Math.min(1, Math.max(0.6, w / 800));
              const d = (u - p) / width;
              lift += Math.exp(-d * d) * height * pulse * amt * damp * (0.35 + 0.65 * env);
            }
          }
          const ceiling = Math.max(4, y0 - 54);
          if (lift > ceiling * 0.6) lift = ceiling * 0.6 + ceiling * 0.4 * Math.tanh((lift - ceiling * 0.6) / (ceiling * 0.4));
          pts.push(x, y0 - lift);
        }
        const trace = () => {
          ctx.beginPath();
          ctx.moveTo(pts[0], pts[1]);
          for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
        };
        // Occlude the rows behind, then stroke with a height-based gradient: peaks glow flare.
        trace();
        ctx.lineTo(pts[pts.length - 2], y0 + gap * 2);
        ctx.lineTo(pts[0], y0 + gap * 2);
        ctx.closePath();
        ctx.fillStyle = colors.paper;
        ctx.fill();
        trace();
        const g = ctx.createLinearGradient(0, y0 - 110 * (h / 520), 0, y0 - 4);
        g.addColorStop(0, mix(colors.flare, colors.ink, 0));
        g.addColorStop(0.55, mix(colors.flare, colors.ink, 0.35));
        g.addColorStop(1, base);
        ctx.strokeStyle = g;
        ctx.globalAlpha = 1 - s.smoothFog * 0.6 * (0.6 + 0.4 * Math.sin(t * 0.8 + r * 0.9) ** 2);
        ctx.lineWidth = lw;
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      if (visible && (animate || (Math.abs(s.noise - s.smoothNoise) > 0.001 || Math.abs(s.fog - s.smoothFog) > 0.002) || active.some((x) => x.amt % 1 > 0.001 && x.amt < 0.999))) {
        raf = requestAnimationFrame(draw);
      } else raf = 0;
    };

    const kick = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(draw); } };
    s.kick = kick;
    const ro = new ResizeObserver(() => { resize(); kick(); });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting && !document.hidden; if (visible) kick(); });
    io.observe(canvas);
    const onVis = () => { visible = !document.hidden; if (visible) kick(); };
    document.addEventListener('visibilitychange', onVis);
    const scheme = window.matchMedia('(prefers-color-scheme: dark)');
    const onScheme = () => { colorsAt = 0; kick(); };
    scheme.addEventListener('change', onScheme);
    reduce.addEventListener('change', kick);
    const mo = new MutationObserver(onScheme);
    mo.observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
    resize();
    kick();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect(); mo.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      scheme.removeEventListener('change', onScheme);
      reduce.removeEventListener('change', kick);
    };
  }, [rows]);

  useEffect(() => { state.current.kick?.(); }, [selected, noise, still, fog]);

  return <canvas ref={canvasRef} className={'field ' + className} role="img" aria-label={label} />;
}
