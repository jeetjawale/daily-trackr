# Daily Tracker

A lightweight, zero-dependency personal productivity tracker that runs entirely in the browser. Track habits, tasks, sleep, meals, and daily reflections — with optional cross-device sync via Supabase.

![Daily Tracker](https://img.shields.io/badge/version-1.0.0-blue) ![License](https://img.shields.io/badge/license-MIT-green) ![No build step](https://img.shields.io/badge/build-none-brightgreen)

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
- ☁️ Optional Supabase sync — same data across all your devices
- 🔔 Browser notifications for morning check-in and evening reflection reminders
- ⟳ Copy yesterday's tasks and goal to today in one click
- 💾 Auto-save to `localStorage` with a visible save/sync indicator

---

## Getting Started

No build step, no install, no dependencies to manage.

```bash
git clone https://github.com/your-username/daily-tracker.git
cd daily-tracker
```

Then just open `index.html` in your browser — or serve it with any static file server:

```bash
# Python
python -m http.server 8080

# Node
npx serve .
```

---

## Project Structure

```
daily-tracker/
├── index.html   # App shell and markup
├── style.css    # All styles (CSS custom properties, dark mode, responsive)
└── app.js       # All app logic (no frameworks, no bundler)
```

Everything is intentionally kept in three files for simplicity and portability.

---

## Optional: Supabase Sync

To sync your data across multiple devices, set up a free Supabase project:

1. Go to [supabase.com](https://supabase.com) → create a free account → New project
2. Open the **SQL Editor** and run this once:

```sql
create table tracker_data (
  sync_key text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);
alter table tracker_data enable row level security;
create policy "public"
  on tracker_data for all
  using (true) with check (true);
```

3. Go to **Settings → API** → copy your **Project URL** and **anon public key**
4. In the app, click the ☁️ button → paste both values + choose a personal sync code → **Connect & Sync Now**

Use the same sync code on all your devices. Your data will sync automatically on every save.

> **Note:** The anon key is safe to use in the browser. The sync code acts as your private passphrase — anyone who knows it can read and write your data, so treat it like a password.

---

## Browser Notifications

Reminders are powered by the [Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API). To enable them:

1. Switch to the **Trends** view
2. Toggle on **Morning check-in** and/or **Evening reflection**
3. Grant notification permission when prompted

Times can be adjusted freely. Reminders auto-reschedule for the next day after firing. Notifications require the page to be open in a browser tab.

---

## Data Storage

All data is saved to `localStorage` under the key `dt-v7`. Nothing is sent anywhere unless you configure Supabase sync. To export or back up your data, open DevTools → Application → Local Storage and copy the value.

---

## Tech Stack

| Concern | Solution |
|---|---|
| UI | Vanilla HTML + CSS (CSS custom properties) |
| Logic | Vanilla JavaScript (ES2020, no frameworks) |
| Charts | [Chart.js 4.4](https://www.chartjs.org/) via CDN |
| Sync | [Supabase JS v2](https://supabase.com/docs/reference/javascript) via CDN (optional) |
| Fonts | [DM Sans + DM Mono](https://fonts.google.com/) via Google Fonts |

---

## License

MIT — do whatever you like with it.
