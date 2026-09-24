import {Bell, BookOpen, Coffee, Headphones, Leaf, MessageCircle, MessagesSquare, Newspaper, Smartphone, Video, VolumeX, Wind} from 'lucide-react';

// Fixed, illustrative weights. Positive values add stimulation, negative values restore.
export const activities = [
  {id: 'reels', name: 'Short-form video', icon: Smartphone, group: 'high', weight: 20, emoji: ['📱', '🔥', '😂', '👀'],
    pings: ['📱 New reel from someone you follow', '🔥 This one has 2.1M likes', '😂 You have to see this', '📱 Just one more…']},
  {id: 'social', name: 'Social feeds', icon: MessageCircle, group: 'high', weight: 17, emoji: ['❤️', '👍', '✨', '💯'],
    pings: ['❤️ 14 people liked your post', '👀 Someone mentioned you', '➕ You have a new follower', '✨ Your post is doing numbers']},
  {id: 'youtube', name: 'YouTube', icon: Video, group: 'high', weight: 15, emoji: ['▶️', '🔴', '🍿'],
    pings: ['▶️ Up next: 47 life hacks', '🔴 A channel you follow is live', '▶️ Autoplay in 3…', '🍿 Recommended for you']},
  {id: 'notifications', name: 'Notifications', icon: Bell, group: 'high', weight: 13, emoji: ['🔔', '📦', '🎮', '⚡'],
    pings: ['🔔 12 new notifications', '📦 Your order has shipped', '🎮 Your energy is full!', '⚡ Flash sale ends soon']},
  {id: 'messages', name: 'Messages', icon: MessagesSquare, group: 'medium', weight: 7, emoji: ['💬'],
    pings: ['💬 Group chat (48 new)', '💬 “are you up?”', '💬 Call me when you can']},
  {id: 'news', name: 'News', icon: Newspaper, group: 'medium', weight: 6, emoji: ['📰', '⚠️'],
    pings: ['📰 BREAKING: developing story', '⚠️ You won’t believe what happened', '📰 5 things to know today']},
  {id: 'coffee', name: 'Coffee', icon: Coffee, group: 'medium', weight: 4, emoji: ['☕'], pings: ['☕ Refill?']},
  {id: 'music', name: 'Music', icon: Headphones, group: 'medium', weight: 3, emoji: ['🎧', '🎵'], pings: ['🎧 New drop from an artist you like']},
  {id: 'walk', name: 'A walk outside', icon: Leaf, group: 'restore', weight: -12},
  {id: 'silence', name: 'Ten minutes of silence', icon: VolumeX, group: 'restore', weight: -10},
  {id: 'reading', name: 'Reading', icon: BookOpen, group: 'restore', weight: -8},
  {id: 'breathing', name: 'Slow breathing', icon: Wind, group: 'restore', weight: -8},
];

export const groups = [
  {id: 'high', label: 'Quick hits', hint: 'Fast, bright, hard to put down'},
  {id: 'medium', label: 'Everyday inputs', hint: 'Small, constant, easy to miss'},
  {id: 'restore', label: 'Breathing room', hint: 'These lower the noise'},
];

// Things about how the day started. `weight` adds stimulation; `cap` shifts capacity directly.
export const habits = [
  {id: 'phoneFirst', name: 'Phone within 5 min of waking', emoji: '📱', weight: 8},
  {id: 'bedScroll', name: 'Scrolled in bed last night', emoji: '🌙', cap: -6},
  {id: 'earlyCoffee', name: 'Coffee right after waking', emoji: '☕', cap: -3},
  {id: 'sunlight', name: 'Got sunlight early', emoji: '☀️', cap: 6},
  {id: 'water', name: 'Drank water first', emoji: '💧', cap: 2},
];

export const scenarios = [
  {id: 'overload', label: 'Overloaded', ids: ['reels', 'notifications', 'youtube', 'social', 'messages', 'news'], habits: ['phoneFirst', 'bedScroll', 'earlyCoffee'], sleep: 6},
  {id: 'everyday', label: 'Typical', ids: ['reels', 'coffee', 'music'], habits: ['phoneFirst'], sleep: 7},
  {id: 'quiet', label: 'Slow start', ids: ['coffee', 'walk', 'reading'], habits: ['sunlight', 'water'], sleep: 8},
];

const byId = Object.fromEntries(activities.map((a) => [a.id, a]));
const habitById = Object.fromEntries(habits.map((h) => [h.id, h]));
export const getActivity = (id) => byId[id];

export const fmtTime = (mins) => {
  mins = ((Math.round(mins) % 1440) + 1440) % 1440;
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`;
};

export function simulate({selected, hours, sleep, habits: on}) {
  const picked = selected.map(getActivity).filter(Boolean);
  const hb = on.map((id) => habitById[id]).filter(Boolean);
  const weight = picked.reduce((n, a) => n + a.weight, 0) + hb.reduce((n, h) => n + (h.weight || 0), 0);
  const sleepDebt = Math.max(0, 8 - sleep);
  const cap = hb.reduce((n, h) => n + (h.cap || 0), 0) - sleepDebt * 6 - (sleep > 9.5 ? 3 : 0);
  const score = Math.round(Math.max(5, Math.min(98, 95 - weight * (hours / 4) + cap)));
  const high = picked.filter((a) => a.group === 'high').length + (on.includes('phoneFirst') ? 1 : 0);
  const medium = picked.filter((a) => a.group === 'medium').length;
  const load = high > 2 ? 'High' : high || medium > 2 ? 'Moderate' : 'Low';
  // 0 = perfectly still, 1 = maximum noise. Drives the whole page.
  const noise = Math.max(0, Math.min(1, (95 - score) / 80));
  // Short sleep fades the signal rather than spiking it.
  const fog = Math.max(0, Math.min(1, sleepDebt / 4 + (on.includes('bedScroll') ? 0.12 : 0)));
  let verdict;
  if (score >= 65) verdict = {title: 'There’s room to focus.', body: 'Your inputs leave space to settle in. Start the thing that matters while it’s this quiet.'};
  else if (sleepDebt >= 2 && high <= 1) verdict = {title: 'You’re running on empty.', body: 'The noise isn’t the problem, sleep is. Work in shorter blocks and get outside early.'};
  else if (score >= 40) verdict = {title: 'Focus will take effort.', body: 'A lot is competing for your attention. Swap one quick hit for something from breathing room.'};
  else verdict = {title: 'Your attention is overloaded.', body: 'Almost everything is pulling at you. Remove the loudest input first. Short-form video is usually the biggest spike.'};
  return {score, high, medium, load, noise, fog, sleepDebt, verdict};
}

// Capacity over the time window, 0..100. Used by the capacity chart.
export function capacityCurve(score, samples = 60) {
  return Array.from({length: samples + 1}, (_, i) => {
    const t = i / samples;
    return 96 - (96 - score) * Math.pow(t, 0.85) + Math.sin(t * 19) * 1.4 * (1 - score / 100);
  });
}

// Share state through the URL hash: #mix=reels,coffee&h=4&w=420&s=7&hb=phoneFirst
export function readHash() {
  const p = new URLSearchParams(window.location.hash.slice(1));
  const num = (k, lo, hi) => { const v = Number(p.get(k)); return p.has(k) && v >= lo && v <= hi ? v : null; };
  return {
    selected: p.has('mix') ? p.get('mix').split(',').filter((id) => byId[id]) : null,
    hours: num('h', 2, 8),
    wake: num('w', 240, 720),
    sleep: num('s', 4, 10),
    habits: p.has('hb') ? p.get('hb').split(',').filter((id) => habitById[id]) : null,
  };
}

export function writeHash({selected, hours, wake, sleep, habits: on}) {
  history.replaceState(null, '', `#mix=${selected.join(',')}&h=${hours}&w=${wake}&s=${sleep}&hb=${on.join(',')}`);
}
