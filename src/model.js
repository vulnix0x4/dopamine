import {Bell, BookOpen, Coffee, Headphones, Leaf, MessageCircle, MessagesSquare, Newspaper, Smartphone, Video, VolumeX, Wind} from 'lucide-react';

// Fixed, illustrative weights. Positive values add stimulation, negative values restore.
export const activities = [
  {id: 'reels', name: 'Short-form video', icon: Smartphone, group: 'high', weight: 20},
  {id: 'social', name: 'Social feeds', icon: MessageCircle, group: 'high', weight: 17},
  {id: 'youtube', name: 'YouTube', icon: Video, group: 'high', weight: 15},
  {id: 'notifications', name: 'Notifications', icon: Bell, group: 'high', weight: 13},
  {id: 'messages', name: 'Messages', icon: MessagesSquare, group: 'medium', weight: 7},
  {id: 'news', name: 'News', icon: Newspaper, group: 'medium', weight: 6},
  {id: 'coffee', name: 'Coffee', icon: Coffee, group: 'medium', weight: 4},
  {id: 'music', name: 'Music', icon: Headphones, group: 'medium', weight: 3},
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

export const scenarios = [
  {id: 'everyday', label: 'Typical morning', ids: ['reels', 'coffee', 'music']},
  {id: 'quiet', label: 'Slow start', ids: ['coffee', 'walk', 'reading']},
  {id: 'overload', label: 'Overloaded', ids: ['reels', 'notifications', 'youtube', 'social', 'messages', 'news']},
];

const byId = Object.fromEntries(activities.map(a => [a.id, a]));
export const getActivity = id => byId[id];

export function simulate(selected, hours) {
  const picked = selected.map(getActivity).filter(Boolean);
  const weight = picked.reduce((n, a) => n + a.weight, 0);
  const score = Math.round(Math.max(8, Math.min(98, 95 - weight * (hours / 4))));
  const high = picked.filter(a => a.group === 'high').length;
  const medium = picked.filter(a => a.group === 'medium').length;
  const restore = picked.filter(a => a.group === 'restore').length;
  const load = high > 2 ? 'High' : high ? 'Moderate' : medium > 2 ? 'Moderate' : 'Low';
  // 0 = perfectly still, 1 = maximum noise. Drives the field and the headline.
  const noise = Math.max(0, Math.min(1, (95 - score) / 80));
  const feel = score >= 65 ? 'Approachable' : score >= 40 ? 'Effortful' : 'Uphill';
  const verdict =
    score >= 65
      ? {title: 'There’s room to focus.', body: 'Your inputs leave space to settle in. This is a good moment to start the thing that matters.'}
      : score >= 40
        ? {title: 'Focus will take effort.', body: 'A lot is competing for your attention. Swap one quick hit for something from breathing room and watch the field settle.'}
        : {title: 'Your attention is overloaded.', body: 'Almost every input is pulling at you. Remove the loudest one first — short-form video is usually the biggest spike.'};
  return {score, high, medium, restore, load, noise, feel, verdict};
}

// Capacity over the time window, sampled 0..1. Used by the capacity chart.
export function capacityCurve(score, samples = 60) {
  return Array.from({length: samples + 1}, (_, i) => {
    const t = i / samples;
    return 96 - (96 - score) * Math.pow(t, 0.85) + Math.sin(t * 19) * 1.4 * (1 - score / 100);
  });
}

// Share state through the URL hash: #mix=reels,coffee&h=4
export function readHash() {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const mix = params.get('mix');
  const h = Number(params.get('h'));
  return {
    selected: mix == null ? null : mix.split(',').filter(id => byId[id]),
    hours: h >= 2 && h <= 8 ? h : null,
  };
}

export function writeHash(selected, hours) {
  const hash = `mix=${selected.join(',')}&h=${hours}`;
  history.replaceState(null, '', `#${hash}`);
}
