# dopamine

**Quiet the signal.** Live at **[focus.whattheflip.lol](https://focus.whattheflip.lol)**.

An attention simulator: choose what goes into your morning and watch a live signal field react, then start a focus session.

![Dopamine](public/og.png)

## What it does

- **The page is the simulation.** It opens on an overloaded morning: fake notifications, screaming tickers, neon, a headline that won't sit still. Turn inputs off and the whole page calms down until it's quiet enough to focus.
- **Your body clock.** Wake time, hours of sleep, and habits like grabbing your phone first thing or getting early sunlight all shift the score. Short sleep fades the field; a peak window marks when many people are sharpest.
- **The field.** A ridgeline plot of your time window. Each line is a slice of time. Quick hits (short-form video, feeds, notifications) add sharp spikes. Everyday inputs add soft bumps. Breathing room calms everything.
- **The headline reacts.** It's set in [Anybody](https://fonts.google.com/specimen/Anybody), a variable font. Calm days set it wide and light. Noisy days crush it narrow, heavy, and twitching.
- **Focus sessions.** Name a task, pick 15/25/45/90 minutes, press <kbd>F</kbd>. The page clears to a fullscreen timer. It survives reloads, shows the countdown in the tab title, and chimes when time is up.
- **Shareable mixes.** Your selection lives in the URL hash, so you can copy a link to any scenario.
- Light and dark themes, full keyboard support, `prefers-reduced-motion` respected, and nothing leaves your browser.

> This is a metaphor for attention, not a measurement of dopamine or a medical model. Activity weights are fixed and illustrative.

## Develop

```sh
npm install
npm run dev
```

## Deploy

Hosted on Cloudflare Workers static assets (see `wrangler.jsonc`).

```sh
npm run deploy
```

## Stack

React 19, Vite, Canvas 2D, Lucide icons. Type: Anybody, Hanken Grotesk, Martian Mono.

## License

MIT
