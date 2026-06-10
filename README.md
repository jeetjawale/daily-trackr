# Daily Tracker

A lightweight, zero-dependency personal productivity tracker that runs entirely in the browser. Track habits, tasks, sleep, meals, and daily reflections — now with live Supabase cloud sync and local-first guest mode.

![version](https://img.shields.io/badge/version-2.0.0-blue) ![license](https://img.shields.io/badge/license-MIT-green) ![netlify](https://img.shields.io/badge/build-netlify-brightgreen)

---

## Features

**Day view**
- 📌 **Pinned recurring tasks** — add once, appears every day
- ✅ **Daily tasks** — add, complete, and delete per-day tasks
- 😴 **Sleep tracking** — fuzzy time input (`10:30pm`, `6am`) with automatic duration and quality label
- 🍽 **Meal log** — breakfast, lunch, dinner, snacks
- ✅ **Habit tracker** — custom habits with emoji icons and streak counters
- 📝 **Notes** — freeform scratchpad
- 🌙 **End-of-day reflection** — daily win + tomorrow's focus
- 📊 **Daily score** — live % based on habits, tasks, and pinned items completed

**Week view**
- 7-day overview grid with per-day scores and habit dots
- Weekly summary: avg score, days logged, best streak
- Habit completion table with Mon–Sun breakdown

**Trends view**
- 30-day score chart
- Sleep duration chart (colour-coded: green ≥ 7h, amber ≥ 5h, red < 5h)
- Habit completion bar chart
- Aggregate stats: avg score, days logged, total habits done, best day

**Other**
- 🌗 Dark / light mode (auto-detects system preference on first visit)
- ☁️ Live Supabase cloud sync — full user authentication and automatic data sync across devices
- 🔔 Browser notifications — daily reminders fully implemented and accurately scheduled
- ⟳ Copy yesterday's tasks and goal to today in one click
- 💾 Auto-save to `localStorage` with a visible save/sync indicator and background cloud upserts

---

## Getting Started

No build step required for local use.

```bash
git clone https://github.com/jeetjawale/daily-tracker.git
cd daily-tracker
```

For local dev with sync, copy `supabase-config.example.js` to `supabase-config.js` in the project root and fill in your project values:

```js
window.SUPABASE_CONFIG = {
  url: 'https://YOUR_PROJECT.supabase.co',
  anonKey: 'YOUR_SUPABASE_ANON_KEY',
};
```

Use the browser anon key only. Do not put a service role key in this file.

Then serve locally:

```bash
npx serve .
# or
python -m http.server 8080
```

Without `supabase-config.js`, the app works fully offline in a local guest mode.

---

## Project Structure

```
daily-tracker/
├── index.html          # App shell and markup
├── style.css           # All styles (CSS custom properties, dark mode, responsive)
├── app.js              # All app logic (no frameworks, no bundler)
├── supabase.js         # Supabase auth + sync helpers
├── supabase-schema.sql # Supabase schema + RLS policies
├── netlify.toml        # Netlify build config
├── supabase-config.example.js
└── supabase-config.js  # Local/project-specific browser config
```

---

## Sync Setup (one-time, for the developer)

Live auth and cloud sync behavior are fully wired. To set it up on your own fork:

### 1. Create a Supabase project

1. Create a project in [supabase.com](https://supabase.com)
2. In **Authentication → Providers**, enable **Email**
3. In **SQL Editor**, run [`supabase-schema.sql`](supabase-schema.sql)
4. In **Project Settings → API**, copy the project URL and anon key
5. Create `supabase-config.js` from `supabase-config.example.js` with those values

### 2. Deploy

```bash
git push
```

Netlify serves the app as static files. The deployed site will automatically fetch your actual database config via environment variables or a deployed `supabase-config.js`. The anon key is intended for browser use; do not use a service role key.

---

## Browser Notifications

The app supports scheduled browser notifications for morning check-ins and evening reflections. Ensure you grant notification permissions when prompted.

---

## Data Storage

For guest users, all data is saved to `localStorage` under isolated keys. When signed in, data syncs to the Supabase Postgres database. You can seamlessly import guest data to your account on sign-up!

---

## Tech Stack

| Concern | Solution |
|---|---|
| UI | Vanilla HTML + CSS (CSS custom properties) |
| Logic | Vanilla JavaScript (ES2020, no frameworks) |
| Charts | [Chart.js 4.4](https://www.chartjs.org/) via CDN |
| Sync | [Supabase Auth + Postgres](https://supabase.com) via CDN |
| Fonts | [DM Sans + DM Mono](https://fonts.google.com/) via Google Fonts |
| Hosting | [Netlify](https://netlify.com) |

---

## License

MIT — do whatever you like with it.
