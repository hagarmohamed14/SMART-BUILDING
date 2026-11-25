# ACUD · Smart Building Management Platform

Vite + React 19 + three.js (React Three Fiber). All data is simulated demo data (tagged SIM).

## Deploy on Vercel
1. Unzip, then either:
   - **Git:** push this folder to a GitHub repo → vercel.com → *Add New → Project* → import the repo → **Deploy** (settings are read from `vercel.json`), or
   - **CLI:** `npm i -g vercel` then run `vercel --prod` inside this folder.
2. Framework preset: Vite · Build: `npm run build` · Output: `dist` · Node 20.19+.

## Run locally
`npm install` then `npm run dev` → http://localhost:5190/ (or double-click `start.bat`).

## Replaceable assets
- `public/schneider-logo.png`, `public/acud-logo.png`, `public/acud-logo-dark.png` — header logos
- `public/cams/` — CCTV frames; add `public/cams/clips.json` (`{"lobby": "lobby.mp4"}`) to play real clips
- `public/staff/<ID>.jpg` — employee photos for Access › Employee tracking (e.g. `U1002.jpg`)
- `src/assets/bg-building.jpg` — dashboard background

Dark theme CSS (`src/theme-dark.css`) is generated: after editing styles run `python tools-gen_dark.py`.
