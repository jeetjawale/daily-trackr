# Daily Tracker

A lightweight, zero-dependency personal productivity tracker that runs entirely in the browser. Track habits, tasks, sleep, meals, and daily reflections — with optional cross-device sync via Firebase.

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
- ☁️ Firebase sync — sign in with email + password or magic link, data syncs automatically
- 🔔 Browser notifications for morning check-in and evening reflection
- ⟳ Copy yesterday's tasks and goal to today in one click
- 💾 Auto-save to `localStorage` with a visible save/sync indicator

---

## Getting Started

No build step required for local use.

```bash
git clone https://github.com/jeetjawale/daily-tracker.git
cd daily-tracker
```

For local dev with sync, create `firebase-config.js` in the project root (it's gitignored):

```js
window.FIREBASE_CONFIG = {
  apiKey:      'YOUR_API_KEY',
  authDomain:  'YOUR_PROJECT.firebaseapp.com',
  databaseURL: 'https://YOUR_PROJECT-default-rtdb.firebaseio.com',
  projectId:   'YOUR_PROJECT',
};
```

Then serve locally:

```bash
npx serve .
# or
python -m http.server 8080
```

Without `firebase-config.js`, the app works fully offline — sync is just disabled.

---

## Project Structure

```
daily-tracker/
├── index.html          # App shell and markup
├── style.css           # All styles (CSS custom properties, dark mode, responsive)
├── app.js              # All app logic (no frameworks, no bundler)
├── build.js            # Netlify build script — generates firebase-config.js from env vars
├── netlify.toml        # Netlify build config
├── .gitignore          # Keeps firebase-config.js out of the repo
└── firebase-config.js  # NOT committed — generated at build time
```

---

## Sync Setup (one-time, for the developer)

Users just click ☁️ and sign in — no setup on their end. You configure Firebase once.

### 1. Create a Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project**
2. **Build → Authentication → Get started** → enable **Email/Password** and **Email link (passwordless)**
3. Under Email link, add your Netlify URL to **Authorized domains** (e.g. `daily-tracker-app.netlify.app`)
4. **Build → Realtime Database → Create database → Start in test mode**
5. In the **Rules** tab, replace with:

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read":  "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    }
  }
}
```

### 2. Add environment variables in Netlify

**Site configuration → Environment variables → Add a variable:**

| Variable | Where to find it |
|---|---|
| `FIREBASE_API_KEY` | Project Settings → General → Web API Key |
| `FIREBASE_AUTH_DOMAIN` | `your-project.firebaseapp.com` |
| `FIREBASE_DATABASE_URL` | Realtime Database → URL at the top |
| `FIREBASE_PROJECT_ID` | Project Settings → General → Project ID |

### 3. Deploy

```bash
git push
```

Netlify runs `node build.js`, which generates `firebase-config.js` from env vars at build time. The file is gitignored — keys never touch the repo.

---

## Browser Notifications

1. Switch to **Trends** view
2. Toggle on **Morning check-in** and/or **Evening reflection**
3. Grant notification permission when prompted

---

## Data Storage

All data is saved to `localStorage` under the key `dt-v7`. Nothing is sent anywhere unless you sign in. To back up: DevTools → Application → Local Storage → copy the value.

---

## Tech Stack

| Concern | Solution |
|---|---|
| UI | Vanilla HTML + CSS (CSS custom properties) |
| Logic | Vanilla JavaScript (ES2020, no frameworks) |
| Charts | [Chart.js 4.4](https://www.chartjs.org/) via CDN |
| Sync | [Firebase Auth + Realtime Database](https://firebase.google.com) via CDN |
| Fonts | [DM Sans + DM Mono](https://fonts.google.com/) via Google Fonts |
| Hosting | [Netlify](https://netlify.com) |

---

## License

MIT — do whatever you like with it.
