<div align="center">
  <img src="./public/logo.svg" alt="WealthPulse Logo" width="120" />
  <h1>WealthPulse</h1>
  <p><strong>A beautifully designed, offline-first Progressive Web App to track your net worth and FIRE goals.</strong></p>
  <p>
    <a href="#features">Features</a> •
    <a href="#getting-started">Getting Started</a> •
    <a href="#tech-stack">Tech Stack</a> •
    <a href="#cloud-sync-setup">Cloud Sync</a> •
    <a href="#data-privacy">Data Privacy</a>
  </p>
</div>

<br/>

WealthPulse replaces the traditional, messy "monthly Excel sheet" with a structured, multi-currency financial dashboard. It is built natively for the web but designed to feel like a premium native application — install it to your home screen and use it completely offline.

## Features

- **Multi-Currency Support** — Add assets and liabilities in their native currencies (USD, EUR, GBP, SGD, AED, INR, and 160+ more). WealthPulse auto-fetches live exchange rates and converts everything to your chosen base currency.
- **Live Exchange Rates** — One-click rate refresh via [open.er-api.com](https://open.er-api.com) with [Frankfurter](https://www.frankfurter.app) as fallback. Stale-rate warnings appear automatically when rates are older than 30 days.
- **FIRE Tracking** — Define your Financial Independence target and let the built-in calculator project your Safe Withdrawal Rate and estimated years to retirement based on real net worth growth.
- **3-State Inclusion Chips** — Each line item carries a Σ✓ / Σ / ⊘ chip: included in NW and goals, included in NW only, or excluded entirely. Replaces cumbersome dropdowns with an at-a-glance colour-coded control.
- **Scope Toggle** — Dashboard switches between **Overall / Liquid / Investable** net worth views. Per-goal category exclusions let your FIRE number exclude illiquid assets like a primary home.
- **Net Worth Timeline** — History page shows a full Recharts area chart across all snapshots, with an optional FIRE target reference line. Search by month or note text; expand any row to see a per-category breakdown.
- **Sticky Editor Summary** — The Snapshot Editor shows a live bottom bar: Net Worth · Goals NW · Total Assets · Total Liabilities, always visible as you scroll through categories.
- **Settings Sub-Nav** — Five focused sections (Preferences · Currencies · Categories · Data & Backup · Cloud Sync) with persistent last-viewed selection.
- **Offline-First PWA** — Install directly to your iOS or Android home screen, or use it in any browser. All data is local — zero network required after first load.
- **Cool-Emerald Design System** — Custom oklch palette with Outfit display font, Inter UI font, and DM Mono for numbers. Full light and dark themes, with `prefers-reduced-motion` support throughout.
- **Data Portability** — Export your full database as a JSON backup. Import historical snapshots from Excel. Auto-safety-backup triggers before any restore operation.

## How Net Worth Is Calculated

WealthPulse offers three views of your wealth, selectable via the **Overall / Liquid / Investable** toggle on the Dashboard.

### Overall (default)
Includes **all** asset and liability categories.

```
Net Worth = Σ all asset categories − Σ all liability categories
```

### Liquid
Includes only categories flagged **Is Liquid** in the Snapshot Editor.

```
Liquid Net Worth = Σ liquid asset categories − Σ liquid liability categories
```

Liquid assets are those you can access quickly without significant loss of value — cash, bank accounts, money market funds.

### Investable
Includes only categories flagged **Is Investable**.

```
Investable Net Worth = Σ investable asset categories − Σ investable liability categories
```

Investable assets are actively compounding — stocks, mutual funds, ETFs, bonds, crypto.

### Per-Goal Exclusions
Goals support per-goal category exclusions. Exclude your primary home from a FIRE goal's calculation so retirement readiness isn't inflated by an illiquid asset. Configure in **Goals → Edit → Exclude from net worth calculation**.

---

## Getting Started

### Instant Use (Recommended)

1. Open the app URL in Chrome, Edge, or Safari
2. Click **"Add to Home Screen"** (Safari on iOS) or **"Install App"** (Chrome/Edge on desktop)
3. Launch from your home screen — fully offline from that point forward

### Run Locally

```bash
git clone https://github.com/ravindra-dave/wealthpulse.git
cd wealthpulse
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173).

### Self-Hosted (Always-On)

For a persistent local server that starts automatically on reboot, use the provided setup scripts:

**macOS:**
```bash
./setup-mac.sh
```

**Linux:**
```bash
./setup-linux.sh
```

**Windows** *(run Command Prompt as Administrator)*:
```cmd
setup-windows.bat
```

These scripts install Node.js if missing, build the production app, and configure PM2 to keep it running on port 3000 permanently.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [React 18](https://reactjs.org/) + [Vite](https://vitejs.dev/) |
| Language | TypeScript (Strict Mode) |
| Database | [Dexie.js](https://dexie.org/) (IndexedDB wrapper) |
| Styling | Vanilla CSS with oklch design tokens |
| Fonts | [@fontsource](https://fontsource.org/) — Outfit, Inter, DM Mono (PWA-safe, no CDN) |
| Icons | [Lucide React](https://lucide.dev/) |
| Charts | [Recharts](https://recharts.org/) |
| PWA | `vite-plugin-pwa` (Workbox, auto-update) |
| Exchange Rates | [open.er-api.com](https://open.er-api.com) + [Frankfurter](https://api.frankfurter.app) |

## Cloud Sync — Google Drive Setup

WealthPulse can automatically back up your data to a **hidden, app-only folder** in your Google Drive (`appDataFolder`). This folder:

- Is **invisible** in your Google Drive UI — it never clutters your files
- Is **inaccessible** to any other app — only WealthPulse can read or write to it
- **Survives browser data clears, cache wipes, and device loss**
- Uses the `drive.appdata` scope — WealthPulse **cannot** see or touch any of your other Drive files

---

### Who needs to do setup?

| Scenario | What you need to do |
|---|---|
| **Using the hosted app** | Nothing — just click **Settings → Cloud Sync → Connect Google Drive** and sign in |
| **Self-hosting or running locally** | Complete the one-time GCP setup below (~10 min), then paste your Client ID in the app |

The in-app **Setup guide** link (Settings → Cloud Sync → Setup guide) walks through these same steps inside the app.

---

### One-time GCP setup (self-hosters only)

#### Step 1 — Create a Google Cloud project

1. Go to [console.cloud.google.com/projectcreate](https://console.cloud.google.com/projectcreate) and sign in.
2. Give the project any name (e.g. *WealthPulse*) and click **Create**.

#### Step 2 — Enable the Google Drive API

1. Go to **APIs & Services → Library** (or use the [direct link](https://console.cloud.google.com/apis/library/drive.googleapis.com)).
2. Search for **Google Drive API** → click it → click **Enable**.

#### Step 3 — Configure the OAuth consent screen

1. Go to **APIs & Services → OAuth consent screen**.
2. User type: choose **External** → **Create**.
3. Fill in the three required fields: **App name**, **User support email**, and **Developer contact email**.
4. On the **Scopes** step, click **Add or remove scopes**, search for `.../auth/drive.appdata`, select it, then click **Update**.
5. On the **Test users** step, click **Add users** and add your own Google account email. Only listed test users can sign in while the app is unverified.
6. Click **Save and Continue** through the remaining steps.

#### Step 4 — Create an OAuth Client ID

1. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
2. Application type: **Web application**.
3. Under **Authorized JavaScript origins**, add every URL you'll open the app from:
   - `http://localhost:3000` — local dev / PM2 self-hosted
   - `https://your-app.vercel.app` — your Vercel deployment URL
   - `https://your-custom-domain.com` — if you use a custom domain
4. Click **Create**. The Client ID appears immediately in the confirmation dialog.

#### Step 5 — Add the Client ID to the app

The Client ID looks like `123456789012-abcdefghijklmnop.apps.googleusercontent.com`. It is **not a secret** — it's safe to store in the app.

**Option A — In-app (no rebuild needed):**

Settings → Cloud Sync → paste Client ID into the field → **Save**.

**Option B — Vercel environment variable:**

In your Vercel project: **Settings → Environment Variables**, add:

```
VITE_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
```

Then **trigger a new deployment** — Vite bakes env vars into the bundle at build time, so the value won't appear in the app until a new build runs.

**Option C — `.env.local` for local dev:**

```
VITE_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
```

---

### Troubleshooting

| Error | Fix |
|---|---|
| **Error 400: redirect_uri_mismatch** | The URL you're using (including port) isn't in the Authorized JavaScript origins list. Add it and wait ~5 minutes. |
| **Sign-in blocked / access denied** | Your Google account isn't in the Test users list. Add it in OAuth consent screen → Test users. |
| **Popup blocked** | Allow popups for the app's domain in your browser settings. |

---

### Using Google Drive sync

1. **Settings → Cloud Sync → Connect Google Drive** — sign in and grant permission.
2. WealthPulse auto-syncs after every save (5-second debounce).
3. **Sync Now** — manual sync at any time.
4. **Restore** — pick a backup from the list to restore.

---

### Security notes

- The Client ID is **not a secret** — security comes from Google only accepting OAuth requests from registered domains.
- WealthPulse never sends your financial data to any server other than your own Google account.
- Access can be revoked at [myaccount.google.com/permissions](https://myaccount.google.com/permissions).
- Backups are stored as **plaintext JSON** in your Drive's hidden app folder. End-to-end encryption is planned as a future phase.

## Data Privacy

WealthPulse is a strictly **client-side application**. It has no backend, no authentication servers, and sends zero telemetry.

All financial data is stored locally on your device inside your browser's **IndexedDB** database.

> ⚠️ **On-device security:** IndexedDB files are stored **unencrypted** on disk. On a shared computer, ensure your device has full-disk encryption enabled — [FileVault](https://support.apple.com/en-us/102541) on macOS or [BitLocker](https://learn.microsoft.com/en-us/windows/security/information-protection/bitlocker/bitlocker-overview) on Windows.

**Backups:** The JSON export creates a **plaintext** file. Store it in an encrypted location (password-protected zip, [Cryptomator](https://cryptomator.org/), etc.).

## User Guide

For a detailed walkthrough of every feature, see [docs/USER_GUIDE.md](./docs/USER_GUIDE.md).

## License

This project is licensed under the MIT License.
